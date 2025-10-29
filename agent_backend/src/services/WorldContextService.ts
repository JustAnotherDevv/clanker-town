import { GameWorld, GameAgent, Position } from "./GameWorld";
import { ElasticsearchService, PlayerData } from "./ElasticSearchService";
import { SuiGameService, GeneratorInfo } from "./SuiGameService";

export interface AgentContext {
  selfInfo: string;
  nearbyAgents: string;
  nearbyItems: string;
  nearbyPlayers: string;
  nearbyGenerators: string;
  resourcesInfo: string;
  tradeProposals: string;
  worldInfo: string;
  fullContext: string;
}

export class WorldContextServiceExtended {
  constructor(
    private gameWorld: GameWorld,
    private esService: ElasticsearchService | undefined,
    private suiGameService: SuiGameService | undefined
  ) {}

  async generateAgentContext(
    agent: GameAgent,
    contextRange: number = 20
  ): Promise<AgentContext> {
    const selfInfo = await this.buildSelfInfo(agent);
    const nearbyAgents = this.buildNearbyAgentsInfo(agent, contextRange);
    const nearbyItems = this.buildNearbyItemsInfo(agent, contextRange);
    const nearbyPlayers = await this.buildNearbyPlayersInfo(
      agent,
      contextRange
    );
    const nearbyGenerators = await this.buildNearbyGeneratorsInfo(
      agent,
      contextRange
    );
    const resourcesInfo = await this.buildResourcesInfo(agent);
    const tradeProposals = await this.buildTradeProposalsInfo(agent);
    const worldInfo = await this.buildWorldInfo();

    const fullContext = [
      "=== CURRENT CONTEXT ===",
      selfInfo,
      resourcesInfo,
      nearbyAgents,
      nearbyPlayers,
      nearbyGenerators,
      nearbyItems,
      tradeProposals,
      worldInfo,
      "===================",
    ]
      .filter((section) => section.length > 0)
      .join("\n\n");

    return {
      selfInfo,
      nearbyAgents,
      nearbyItems,
      nearbyPlayers,
      nearbyGenerators,
      resourcesInfo,
      tradeProposals,
      worldInfo,
      fullContext,
    };
  }

  private async buildSelfInfo(agent: GameAgent): Promise<string> {
    const parts = [
      "YOUR CURRENT STATUS:",
      `- Name: ${agent.name}`,
      `- Description: ${agent.description}`,
      `- Current Position: (${Math.round(agent.position.x)}, ${Math.round(
        agent.position.y
      )})`,
      `- Your Sui Wallet Address: ${agent.suiAddress}`,
    ];

    if (this.suiGameService) {
      try {
        const resources = await this.suiGameService.getPlayerResources(
          agent.suiAddress
        );
        if (resources) {
          parts.push(
            `- Your Resources: ${resources.wood} Wood, ${resources.stone} Stone, ${resources.emerald} Emerald`
          );
        }
      } catch (error) {}
    }

    parts.push(
      `- You are currently in the game world. Remember to roleplay as your character.`
    );

    return parts.join("\n");
  }

  private buildNearbyAgentsInfo(agent: GameAgent, range: number): string {
    const nearbyAgents = this.gameWorld
      .getAgentsInRange(agent.position, range)
      .filter((a) => a.id !== agent.id);

    if (nearbyAgents.length === 0) {
      return "NEARBY NPCs:\n- None within visible range";
    }

    const agentDescriptions = nearbyAgents.map((nearbyAgent) => {
      const distance = this.calculateDistance(
        agent.position,
        nearbyAgent.position
      );
      const direction = this.getDirection(agent.position, nearbyAgent.position);
      return `- ${nearbyAgent.name} (${nearbyAgent.suiAddress.slice(
        0,
        8
      )}...): ${nearbyAgent.description} (${Math.round(
        distance
      )} units ${direction})`;
    });

    return ["NEARBY NPCs:", ...agentDescriptions].join("\n");
  }

  private buildNearbyItemsInfo(agent: GameAgent, range: number): string {
    const nearbyItems = this.gameWorld.getItemsInRange(agent.position, range);

    if (nearbyItems.length === 0) {
      return "NEARBY ITEMS:\n- None within visible range";
    }

    const itemDescriptions = nearbyItems.map((item) => {
      const distance = this.calculateDistance(agent.position, item.position);
      const direction = this.getDirection(agent.position, item.position);
      const interactiveTag = item.interactive ? " [Interactive]" : "";
      return `- ${item.name}${interactiveTag}: ${
        item.description || "No description"
      } (${Math.round(distance)} units ${direction})`;
    });

    return ["NEARBY ITEMS:", ...itemDescriptions].join("\n");
  }

  private async buildNearbyPlayersInfo(
    agent: GameAgent,
    range: number
  ): Promise<string> {
    if (!this.esService) {
      return "NEARBY PLAYERS:\n- Player tracking not available";
    }

    try {
      const allPlayers = await this.esService.getAllPlayers();
      const nearbyPlayers = allPlayers.filter((player) => {
        const distance = this.calculateDistance(
          agent.position,
          player.position
        );
        return distance <= range;
      });

      if (nearbyPlayers.length === 0) {
        return "NEARBY PLAYERS:\n- No players within visible range";
      }

      const playerDescriptions = await Promise.all(
        nearbyPlayers.map(async (player) => {
          const distance = this.calculateDistance(
            agent.position,
            player.position
          );
          const direction = this.getDirection(agent.position, player.position);

          let resourceInfo = "";
          if (this.suiGameService && player.metadata?.suiAddress) {
            try {
              const resources = await this.suiGameService.getPlayerResources(
                player.metadata.suiAddress
              );
              if (resources) {
                resourceInfo = ` [Resources: ${resources.wood}W, ${resources.stone}S, ${resources.emerald}E]`;
              }
            } catch (error) {}
          }

          return `- ${player.name || "Adventurer"}${resourceInfo} (${Math.round(
            distance
          )} units ${direction})`;
        })
      );

      return ["NEARBY PLAYERS:", ...playerDescriptions].join("\n");
    } catch (error) {
      console.error("Error fetching nearby players:", error);
      return "NEARBY PLAYERS:\n- Error loading player information";
    }
  }

  private async buildNearbyGeneratorsInfo(
    agent: GameAgent,
    range: number
  ): Promise<string> {
    if (!this.suiGameService) {
      return "NEARBY GENERATORS:\n- Generator tracking not available";
    }

    try {
      const gameId = this.suiGameService.getCurrentGameId();
      if (!gameId) {
        return "NEARBY GENERATORS:\n- No active game";
      }

      const generators = await this.suiGameService.getGeneratorsNearPosition(
        gameId,
        agent.position,
        range
      );

      if (generators.length === 0) {
        return "NEARBY GENERATORS:\n- None within visible range";
      }

      const generatorDescriptions = generators.map((gen) => {
        const distance = this.calculateDistance(agent.position, {
          x: gen.x,
          y: gen.y,
        });
        const direction = this.getDirection(agent.position, {
          x: gen.x,
          y: gen.y,
        });
        const resourceName = this.getResourceName(gen.resourceType);
        const ownerInfo =
          gen.owner === "0x0"
            ? "[UNCLAIMED - You can claim this!]"
            : gen.owner === agent.suiAddress
            ? "[OWNED BY YOU]"
            : `[Owned by ${gen.owner.slice(0, 8)}...]`;

        const statusInfo =
          gen.owner !== "0x0"
            ? ` Level ${gen.level}, Rate: ${gen.generationRate}/min, Unclaimed: ${gen.unclaimed}/${gen.maxCap}`
            : "";

        return `- ${resourceName} Generator ${ownerInfo}${statusInfo} (${Math.round(
          distance
        )} units ${direction})`;
      });

      return [
        "NEARBY GENERATORS:",
        ...generatorDescriptions,
        "\nACTIONS AVAILABLE:",
        "- Claim unclaimed generators using /claim_generator",
        "- Claim resources from your generators using /claim_resources",
        "- Recapture enemy generators using /recapture_generator",
      ].join("\n");
    } catch (error) {
      console.error("Error fetching nearby generators:", error);
      return "NEARBY GENERATORS:\n- Error loading generator information";
    }
  }

  private async buildResourcesInfo(agent: GameAgent): Promise<string> {
    if (!this.suiGameService) {
      return "YOUR RESOURCES:\n- Resource tracking not available";
    }

    try {
      const resources = await this.suiGameService.getPlayerResources(
        agent.suiAddress
      );

      if (!resources) {
        return "YOUR RESOURCES:\n- Not yet initialized (join a game first)";
      }

      return [
        "YOUR RESOURCES:",
        `- Wood: ${resources.wood}`,
        `- Stone: ${resources.stone}`,
        `- Emerald: ${resources.emerald}`,
        `- Resource Object ID: ${resources.objectId}`,
      ].join("\n");
    } catch (error) {
      return "YOUR RESOURCES:\n- Error loading resources";
    }
  }

  private async buildTradeProposalsInfo(agent: GameAgent): Promise<string> {
    if (!this.suiGameService) {
      return "TRADE PROPOSALS:\n- Trading not available";
    }

    try {
      const proposals = await this.suiGameService.getTradeProposalsForAgent(
        agent.suiAddress
      );

      if (proposals.length === 0) {
        return "TRADE PROPOSALS:\n- No pending trade proposals";
      }

      const proposalDescriptions = proposals.map((proposal) => {
        const isProposer = proposal.proposer === agent.suiAddress;
        const otherParty = isProposer ? proposal.target : proposal.proposer;
        const role = isProposer ? "YOU PROPOSED" : "PROPOSED TO YOU";

        const offering = `${proposal.woodOffered}W, ${proposal.stoneOffered}S, ${proposal.emeraldOffered}E`;
        const requesting = `${proposal.woodRequested}W, ${proposal.stoneRequested}S, ${proposal.emeraldRequested}E`;

        return `- [${role}] Trade with ${otherParty.slice(
          0,
          8
        )}...: Offering ${offering} for ${requesting} (ID: ${proposal.objectId.slice(
          0,
          8
        )}...)`;
      });

      return [
        "TRADE PROPOSALS:",
        ...proposalDescriptions,
        "\nACTIONS AVAILABLE:",
        "- Propose trades using /propose_trade",
        "- Accept incoming trades using /accept_trade",
        "- Cancel your proposals using /cancel_trade",
      ].join("\n");
    } catch (error) {
      console.error("Error fetching trade proposals:", error);
      return "TRADE PROPOSALS:\n- Error loading trade information";
    }
  }

  private async buildWorldInfo(): Promise<string> {
    const dimensions = this.gameWorld.getWorldDimensions();
    const allAgents = this.gameWorld.getAllAgents();
    const allItems = this.gameWorld.getAllItems();

    const parts = [
      "WORLD INFORMATION:",
      `- World Size: ${dimensions.width}x${dimensions.height} units`,
      `- Total NPCs in world: ${allAgents.length}`,
      `- Total items in world: ${allItems.length}`,
    ];

    if (this.suiGameService) {
      const gameId = this.suiGameService.getCurrentGameId();
      if (gameId) {
        try {
          const generators = await this.suiGameService.getAllGenerators(gameId);
          parts.push(`- Total generators in game: ${generators.length}`);

          const gameInfo = await this.suiGameService.getGameMatch(gameId);
          if (gameInfo) {
            parts.push(
              `- Game participants: ${gameInfo.participants.length} players`
            );
          }
        } catch (error) {}
      }
    }

    parts.push(
      `- Remember: You can move around, interact with items, manage generators, trade resources, and converse with players and other NPCs`
    );

    return parts.join("\n");
  }

  private calculateDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
    );
  }

  private getDirection(from: Position, to: Position): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (angle >= -22.5 && angle < 22.5) return "to the East";
    if (angle >= 22.5 && angle < 67.5) return "to the Southeast";
    if (angle >= 67.5 && angle < 112.5) return "to the South";
    if (angle >= 112.5 && angle < 157.5) return "to the Southwest";
    if (angle >= 157.5 || angle < -157.5) return "to the West";
    if (angle >= -157.5 && angle < -112.5) return "to the Northwest";
    if (angle >= -112.5 && angle < -67.5) return "to the North";
    if (angle >= -67.5 && angle < -22.5) return "to the Northeast";

    return "nearby";
  }

  private getResourceName(resourceType: number): string {
    switch (resourceType) {
      case 0:
        return "Wood";
      case 1:
        return "Stone";
      case 2:
        return "Emerald";
      default:
        return "Unknown";
    }
  }

  async generateActionContext(agent: GameAgent): Promise<string> {
    const context = await this.generateAgentContext(agent, 30);

    const actionGuidance = [
      "\n=== AI DECISION GUIDANCE ===",
      "Based on your current situation, consider these actions:",
      "",
      "GENERATOR MANAGEMENT:",
      "- If you see unclaimed generators nearby, consider claiming them",
      "- Claim resources from your generators when they have accumulated resources",
      "- Consider recapturing generators from hostile agents (check your memories)",
      "",
      "TRADING:",
      "- Review incoming trade proposals and decide to accept or refuse based on fairness",
      "- Propose trades with other agents if you need specific resources",
      "- Consider the strategic value of resources (Emerald is typically more valuable)",
      "",
      "SOCIAL INTERACTIONS:",
      "- Be friendly with cooperative agents",
      "- Be cautious with agents who have attacked you before",
      "- Share information about unclaimed generators with allies",
      "",
      "REMEMBER:",
      "- Your goal is to gather resources and control generators",
      "- Build alliances through fair trading",
      "- Protect your generators from hostile takeovers",
      "=========================",
    ].join("\n");

    return context.fullContext + actionGuidance;
  }
}
