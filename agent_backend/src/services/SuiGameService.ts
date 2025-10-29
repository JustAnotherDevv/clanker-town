import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { GameWorld, Position, WorldItem } from "./GameWorld";
import { ElasticsearchService } from "./ElasticSearchService";

export enum ResourceType {
  WOOD = 0,
  STONE = 1,
  EMERALD = 2,
}

export interface GameMatchInfo {
  objectId: string;
  creator: string;
  participants: string[];
}

export interface PlayerResourcesInfo {
  objectId: string;
  gameId: string;
  owner: string;
  wood: number;
  stone: number;
  emerald: number;
}

export interface GeneratorInfo {
  objectId: string;
  gameId: string;
  resourceType: ResourceType;
  x: number;
  y: number;
  owner: string;
  level: number;
  generationRate: number;
  maxCap: number;
  unclaimed: number;
  lastClaimTime: number;
  lastRecapturedBy: string;
  lastRecapturedFrom: string;
}

export interface TradeProposalInfo {
  objectId: string;
  gameId: string;
  proposer: string;
  target: string;
  woodOffered: number;
  stoneOffered: number;
  emeraldOffered: number;
  woodRequested: number;
  stoneRequested: number;
  emeraldRequested: number;
}

export class SuiGameService {
  private suiClient: SuiClient;
  private packageId: string;
  private currentGameId: string | null = null;
  private gameWorld: GameWorld;
  private esService?: ElasticsearchService;

  constructor(
    suiClient: SuiClient,
    packageId: string,
    gameWorld: GameWorld,
    esService?: ElasticsearchService
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.gameWorld = gameWorld;
    this.esService = esService;
  }

  setCurrentGame(gameId: string) {
    this.currentGameId = gameId;
  }

  getCurrentGameId(): string | null {
    return this.currentGameId;
  }

  async createMatch(
    creatorKeypair: Ed25519Keypair,
    participants: string[],
    initialWood: number = 100,
    initialStone: number = 100,
    initialEmerald: number = 50
  ): Promise<string> {
    const tx = new TransactionBlock();

    tx.moveCall({
      target: `${this.packageId}::resource_game::create_match`,
      arguments: [
        tx.pure(participants, "vector<address>"),
        tx.pure(initialWood, "u64"),
        tx.pure(initialStone, "u64"),
        tx.pure(initialEmerald, "u64"),
      ],
    });

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: creatorKeypair,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (obj) => obj.type === "created"
    );
    const gameObject = createdObjects?.find((obj) =>
      obj.objectType?.includes("GameMatch")
    );

    if (gameObject && "objectId" in gameObject) {
      this.currentGameId = gameObject.objectId;
      return gameObject.objectId;
    }

    throw new Error("Failed to create game match");
  }

  async createGenerators(
    creatorKeypair: Ed25519Keypair,
    gameId: string,
    resourceType: ResourceType,
    positions: Position[]
  ): Promise<string[]> {
    const tx = new TransactionBlock();

    const xCoords = positions.map((p) => Math.floor(p.x));
    const yCoords = positions.map((p) => Math.floor(p.y));

    const clockObjectId = "0x6";

    tx.moveCall({
      target: `${this.packageId}::resource_game::create_generators`,
      arguments: [
        tx.object(gameId),
        tx.pure(resourceType, "u8"),
        tx.pure(xCoords, "vector<u64>"),
        tx.pure(yCoords, "vector<u64>"),
        tx.object(clockObjectId),
      ],
    });

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: creatorKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (obj) => obj.type === "created" && obj.objectType?.includes("Generator")
    );

    const generatorIds =
      createdObjects
        ?.map((obj) => ("objectId" in obj ? obj.objectId : null))
        .filter((id) => id !== null) || [];

    await this.syncGeneratorsToWorld();

    return generatorIds as string[];
  }

  async syncGeneratorsToWorld(): Promise<void> {
    if (!this.currentGameId) return;

    const generators = await this.getAllGenerators(this.currentGameId);

    for (const gen of generators) {
      const resourceName = this.getResourceName(gen.resourceType);
      const ownerName =
        gen.owner === "0x0"
          ? "Unclaimed"
          : `Owner: ${gen.owner.slice(0, 8)}...`;

      const existingItem = this.gameWorld
        .getAllItems()
        .find((item) => item.id === `gen_${gen.objectId}`);

      const item: Omit<WorldItem, "id"> = {
        name: `${resourceName} Generator`,
        position: { x: gen.x, y: gen.y },
        spriteSheet: {
          url: `/assets/generator_${resourceName.toLowerCase()}.png`,
          frameCount: 8,
          frameWidth: 64,
          frameHeight: 64,
          fps: 8,
          loop: true,
        },
        size: 6,
        interactive: true,
        description: `Level ${gen.level} ${resourceName} Generator. ${ownerName}. Rate: ${gen.generationRate}/min. Unclaimed: ${gen.unclaimed}/${gen.maxCap}`,
        collectedBy: gen.owner !== "0x0" ? gen.owner : undefined,
      };

      if (existingItem) {
        Object.assign(existingItem, item);
      } else {
        await this.gameWorld.addItem({
          ...item,
        });
      }
    }
  }

  async claimGenerator(
    claimerKeypair: Ed25519Keypair,
    gameId: string,
    generatorId: string
  ): Promise<void> {
    const tx = new TransactionBlock();
    const clockObjectId = "0x6";

    tx.moveCall({
      target: `${this.packageId}::resource_game::claim_generator`,
      arguments: [
        tx.object(gameId),
        tx.object(generatorId),
        tx.object(clockObjectId),
      ],
    });

    await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: claimerKeypair,
      options: {
        showEffects: true,
      },
    });

    await this.syncGeneratorsToWorld();
  }

  async claimResources(
    ownerKeypair: Ed25519Keypair,
    generatorId: string,
    playerResourcesId: string
  ): Promise<void> {
    const tx = new TransactionBlock();
    const clockObjectId = "0x6";

    tx.moveCall({
      target: `${this.packageId}::resource_game::claim_resources`,
      arguments: [
        tx.object(generatorId),
        tx.object(playerResourcesId),
        tx.object(clockObjectId),
      ],
    });

    await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: ownerKeypair,
      options: {
        showEffects: true,
      },
    });
  }

  async recaptureGenerator(
    attackerKeypair: Ed25519Keypair,
    gameId: string,
    generatorId: string,
    attackerResourcesId: string
  ): Promise<void> {
    const tx = new TransactionBlock();
    const clockObjectId = "0x6";

    tx.moveCall({
      target: `${this.packageId}::resource_game::recapture_generator`,
      arguments: [
        tx.object(gameId),
        tx.object(generatorId),
        tx.object(attackerResourcesId),
        tx.object(clockObjectId),
      ],
    });

    await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: attackerKeypair,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    await this.syncGeneratorsToWorld();
  }

  async proposeTrade(
    proposerKeypair: Ed25519Keypair,
    gameId: string,
    proposerResourcesId: string,
    targetAddress: string,
    offer: { wood: number; stone: number; emerald: number },
    request: { wood: number; stone: number; emerald: number }
  ): Promise<string> {
    const tx = new TransactionBlock();

    tx.moveCall({
      target: `${this.packageId}::resource_game::propose_trade`,
      arguments: [
        tx.object(gameId),
        tx.object(proposerResourcesId),
        tx.pure(targetAddress, "address"),
        tx.pure(offer.wood, "u64"),
        tx.pure(offer.stone, "u64"),
        tx.pure(offer.emerald, "u64"),
        tx.pure(request.wood, "u64"),
        tx.pure(request.stone, "u64"),
        tx.pure(request.emerald, "u64"),
      ],
    });

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: proposerKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (obj) =>
        obj.type === "created" && obj.objectType?.includes("TradeProposal")
    );

    if (
      createdObjects &&
      createdObjects.length > 0 &&
      "objectId" in createdObjects[0]
    ) {
      return createdObjects[0].objectId;
    }

    throw new Error("Failed to create trade proposal");
  }

  async acceptTrade(
    accepterKeypair: Ed25519Keypair,
    proposalId: string,
    proposerResourcesId: string,
    accepterResourcesId: string
  ): Promise<void> {
    const tx = new TransactionBlock();

    tx.moveCall({
      target: `${this.packageId}::resource_game::accept_trade`,
      arguments: [
        tx.object(proposalId),
        tx.object(proposerResourcesId),
        tx.object(accepterResourcesId),
      ],
    });

    await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: accepterKeypair,
      options: {
        showEffects: true,
      },
    });
  }

  async cancelTrade(
    cancellerKeypair: Ed25519Keypair,
    proposalId: string
  ): Promise<void> {
    const tx = new TransactionBlock();

    tx.moveCall({
      target: `${this.packageId}::resource_game::cancel_trade`,
      arguments: [tx.object(proposalId)],
    });

    await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: cancellerKeypair,
      options: {
        showEffects: true,
      },
    });
  }

  async getAllGenerators(gameId: string): Promise<GeneratorInfo[]> {
    try {
      const generators: GeneratorInfo[] = [];

      try {
        const gameObject = await this.suiClient.getObject({
          id: gameId,
          options: {
            showContent: true,
          },
        });

        if (gameObject.data?.content && "fields" in gameObject.data.content) {
          const gameFields = gameObject.data.content.fields as any;
          const participants = gameFields.participants as string[];

          for (const participant of participants) {
            const response = await this.suiClient.getOwnedObjects({
              owner: participant,
              filter: {
                StructType: `${this.packageId}::resource_game::Generator`,
              },
              options: {
                showContent: true,
              },
            });

            for (const obj of response.data) {
              if (obj.data?.content && "fields" in obj.data.content) {
                const fields = obj.data.content.fields as any;
                if (fields.game_id === gameId) {
                  generators.push({
                    objectId: obj.data.objectId,
                    gameId: fields.game_id,
                    resourceType: parseInt(fields.resource_type),
                    x: parseInt(fields.x),
                    y: parseInt(fields.y),
                    owner: fields.owner,
                    level: parseInt(fields.level),
                    generationRate: parseInt(fields.generation_rate),
                    maxCap: parseInt(fields.max_cap),
                    unclaimed: parseInt(fields.unclaimed),
                    lastClaimTime: parseInt(fields.last_claim_time),
                    lastRecapturedBy: fields.last_recaptured_by,
                    lastRecapturedFrom: fields.last_recaptured_from,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          "Could not query generators via game participants:",
          error
        );
      }

      return generators;
    } catch (error) {
      console.error("Error getting generators:", error);
      return [];
    }
  }

  async getPlayerResources(
    address: string
  ): Promise<PlayerResourcesInfo | null> {
    const response = await this.suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${this.packageId}::resource_game::PlayerResources`,
      },
      options: {
        showContent: true,
      },
    });

    if (response.data.length === 0) return null;

    const obj = response.data[0];
    if (obj.data?.content && "fields" in obj.data.content) {
      const fields = obj.data.content.fields as any;
      return {
        objectId: obj.data.objectId,
        gameId: fields.game_id,
        owner: fields.owner,
        wood: parseInt(fields.wood),
        stone: parseInt(fields.stone),
        emerald: parseInt(fields.emerald),
      };
    }

    return null;
  }

  async getAllTradeProposals(): Promise<TradeProposalInfo[]> {
    try {
      const proposals: TradeProposalInfo[] = [];

      if (!this.currentGameId) {
        return proposals;
      }

      const gameObject = await this.suiClient.getObject({
        id: this.currentGameId,
        options: {
          showContent: true,
        },
      });

      if (gameObject.data?.content && "fields" in gameObject.data.content) {
        const gameFields = gameObject.data.content.fields as any;
        const participants = gameFields.participants as string[];

        const seenProposals = new Set<string>();

        for (const participant of participants) {
          const response = await this.suiClient.getOwnedObjects({
            owner: participant,
            filter: {
              StructType: `${this.packageId}::resource_game::TradeProposal`,
            },
            options: {
              showContent: true,
            },
          });

          for (const obj of response.data) {
            if (obj.data?.content && "fields" in obj.data.content) {
              const fields = obj.data.content.fields as any;

              if (!seenProposals.has(obj.data.objectId)) {
                seenProposals.add(obj.data.objectId);

                proposals.push({
                  objectId: obj.data.objectId,
                  gameId: fields.game_id,
                  proposer: fields.proposer,
                  target: fields.target,
                  woodOffered: parseInt(fields.wood_offered),
                  stoneOffered: parseInt(fields.stone_offered),
                  emeraldOffered: parseInt(fields.emerald_offered),
                  woodRequested: parseInt(fields.wood_requested),
                  stoneRequested: parseInt(fields.stone_requested),
                  emeraldRequested: parseInt(fields.emerald_requested),
                });
              }
            }
          }
        }
      }

      return proposals;
    } catch (error) {
      console.error("Error getting trade proposals:", error);
      return [];
    }
  }

  async getTradeProposalsForAgent(
    agentAddress: string
  ): Promise<TradeProposalInfo[]> {
    const allProposals = await this.getAllTradeProposals();
    return allProposals.filter(
      (p) => p.proposer === agentAddress || p.target === agentAddress
    );
  }

  async getGameMatch(gameId: string): Promise<GameMatchInfo | null> {
    const response = await this.suiClient.getObject({
      id: gameId,
      options: {
        showContent: true,
      },
    });

    if (response.data?.content && "fields" in response.data.content) {
      const fields = response.data.content.fields as any;
      return {
        objectId: gameId,
        creator: fields.creator,
        participants: fields.participants,
      };
    }

    return null;
  }

  private getResourceName(resourceType: ResourceType): string {
    switch (resourceType) {
      case ResourceType.WOOD:
        return "Wood";
      case ResourceType.STONE:
        return "Stone";
      case ResourceType.EMERALD:
        return "Emerald";
      default:
        return "Unknown";
    }
  }

  async getGeneratorsNearPosition(
    gameId: string,
    position: Position,
    range: number
  ): Promise<GeneratorInfo[]> {
    const allGenerators = await this.getAllGenerators(gameId);
    return allGenerators.filter((gen) => {
      const distance = Math.sqrt(
        Math.pow(gen.x - position.x, 2) + Math.pow(gen.y - position.y, 2)
      );
      return distance <= range;
    });
  }

  shouldRecaptureGenerator(
    generator: GeneratorInfo,
    agentAddress: string,
    agentMemory: string
  ): boolean {
    if (generator.owner === agentAddress) return false;

    if (generator.owner === "0x0") return false;

    const hostileKeywords = [
      "hostile",
      "enemy",
      "unfriendly",
      "attacked",
      "stole",
      "aggressive",
      "threat",
    ];

    const ownerMention = generator.owner.toLowerCase();
    const memoryLower = agentMemory.toLowerCase();

    return hostileKeywords.some(
      (keyword) =>
        memoryLower.includes(keyword) &&
        memoryLower.includes(ownerMention.slice(0, 8))
    );
  }
}
