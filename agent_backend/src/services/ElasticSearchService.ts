import { Client } from "@elastic/elasticsearch";
import { GameAgent, WorldItem, Tile, Position } from "./GameWorld";

export interface PlayerData {
  id: string;
  name?: string;
  position: Position;
  inventory: string[];
  collectedItems: string[];
  lastActive: Date;
  metadata?: Record<string, any>;
}

export class ElasticsearchService {
  private client: Client;
  private readonly AGENTS_INDEX = "game_agents";
  private readonly ITEMS_INDEX = "game_items";
  private readonly TILES_INDEX = "game_tiles";
  private readonly PLAYERS_INDEX = "game_players";
  private readonly WORLD_CONFIG_INDEX = "game_world_config";

  constructor(
    node: string = "http://localhost:9200",
    apiKey?: string,
    cloudId?: string
  ) {
    if (cloudId && apiKey) {
      this.client = new Client({
        cloud: { id: cloudId },
        auth: { apiKey },
      });
    } else if (apiKey) {
      this.client = new Client({
        node,
        auth: { apiKey },
      });
    } else {
      this.client = new Client({ node });
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.createIndexIfNotExists(this.AGENTS_INDEX, {
        properties: {
          id: { type: "keyword" },
          lettaAgentId: { type: "keyword" },
          name: { type: "text" },
          description: { type: "text" },
          position: {
            properties: {
              x: { type: "float" },
              y: { type: "float" },
            },
          },
          createdAt: { type: "date" },
          suiAddress: { type: "keyword" },
          suiPublicKey: { type: "keyword" },
          suiPrivateKey: { type: "keyword", index: false },
        },
      });

      await this.createIndexIfNotExists(this.ITEMS_INDEX, {
        properties: {
          id: { type: "keyword" },
          name: { type: "text" },
          position: {
            properties: {
              x: { type: "float" },
              y: { type: "float" },
            },
          },
          imageUrl: { type: "keyword" },
          size: { type: "float" },
          interactive: { type: "boolean" },
          description: { type: "text" },
          collectedBy: { type: "keyword" },
          collectedAt: { type: "date" },
          spriteSheet: {
            properties: {
              url: { type: "keyword" },
              frameCount: { type: "integer" },
              frameWidth: { type: "integer" },
              frameHeight: { type: "integer" },
              fps: { type: "integer" },
              loop: { type: "boolean" },
              columns: { type: "integer" },
            },
          },
        },
      });

      await this.createIndexIfNotExists(this.TILES_INDEX, {
        properties: {
          x: { type: "integer" },
          y: { type: "integer" },
          type: { type: "keyword" },
        },
      });

      await this.createIndexIfNotExists(this.PLAYERS_INDEX, {
        properties: {
          id: { type: "keyword" },
          name: { type: "text" },
          position: {
            properties: {
              x: { type: "float" },
              y: { type: "float" },
            },
          },
          inventory: { type: "keyword" },
          collectedItems: { type: "keyword" },
          lastActive: { type: "date" },
          metadata: { type: "object", enabled: false },
        },
      });

      await this.createIndexIfNotExists(this.WORLD_CONFIG_INDEX, {
        properties: {
          width: { type: "integer" },
          height: { type: "integer" },
          tileSize: { type: "integer" },
          updatedAt: { type: "date" },
        },
      });
    } catch (error) {
      console.error("Error initializing Elasticsearch indices:", error);
      throw error;
    }
  }

  private async createIndexIfNotExists(
    index: string,
    mappings: any
  ): Promise<void> {
    const exists = await this.client.indices.exists({ index });

    if (!exists) {
      await this.client.indices.create({
        index,
        body: {
          mappings,
        },
      });
    }
  }

  async saveAgent(agent: GameAgent): Promise<void> {
    await this.client.index({
      index: this.AGENTS_INDEX,
      id: agent.id,
      document: agent,
      refresh: true,
    });
  }

  async getAgent(agentId: string): Promise<GameAgent | null> {
    try {
      const result = await this.client.get({
        index: this.AGENTS_INDEX,
        id: agentId,
      });
      return result._source as GameAgent;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAllAgents(): Promise<GameAgent[]> {
    const result = await this.client.search({
      index: this.AGENTS_INDEX,
      query: { match_all: {} },
      size: 10000,
    });

    return result.hits.hits.map((hit: any) => hit._source as GameAgent);
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.client.delete({
      index: this.AGENTS_INDEX,
      id: agentId,
      refresh: true,
    });
  }

  async updateAgentPosition(
    agentId: string,
    position: Position
  ): Promise<void> {
    await this.client.update({
      index: this.AGENTS_INDEX,
      id: agentId,
      doc: { position },
      refresh: true,
    });
  }

  async saveItem(item: WorldItem): Promise<void> {
    await this.client.index({
      index: this.ITEMS_INDEX,
      id: item.id,
      document: item,
      refresh: true,
    });
  }

  async getItem(itemId: string): Promise<WorldItem | null> {
    try {
      const result = await this.client.get({
        index: this.ITEMS_INDEX,
        id: itemId,
      });
      return result._source as WorldItem;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAllItems(): Promise<WorldItem[]> {
    const result = await this.client.search({
      index: this.ITEMS_INDEX,
      query: { match_all: {} },
      size: 10000,
    });

    return result.hits.hits.map((hit: any) => hit._source as WorldItem);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.client.delete({
      index: this.ITEMS_INDEX,
      id: itemId,
      refresh: true,
    });
  }

  async updateItemCollection(
    itemId: string,
    playerId: string,
    collectedAt: Date
  ): Promise<void> {
    await this.client.update({
      index: this.ITEMS_INDEX,
      id: itemId,
      doc: {
        collectedBy: playerId,
        collectedAt: collectedAt,
      },
      refresh: true,
    });
  }

  async saveTiles(tiles: Tile[]): Promise<void> {
    if (tiles.length === 0) return;

    const body = tiles.flatMap((tile) => [
      { index: { _index: this.TILES_INDEX, _id: `${tile.x}_${tile.y}` } },
      tile,
    ]);

    await this.client.bulk({
      body,
      refresh: true,
    });
  }

  async getAllTiles(): Promise<Tile[]> {
    const result = await this.client.search({
      index: this.TILES_INDEX,
      query: { match_all: {} },
      size: 10000,
    });

    return result.hits.hits.map((hit: any) => hit._source as Tile);
  }

  async updateTile(x: number, y: number, type: string): Promise<void> {
    await this.client.update({
      index: this.TILES_INDEX,
      id: `${x}_${y}`,
      doc: { type },
      refresh: true,
    });
  }

  async savePlayer(player: PlayerData): Promise<void> {
    await this.client.index({
      index: this.PLAYERS_INDEX,
      id: player.id,
      document: {
        ...player,
        lastActive: new Date(),
      },
      refresh: true,
    });
  }

  async getPlayer(playerId: string): Promise<PlayerData | null> {
    try {
      const result = await this.client.get({
        index: this.PLAYERS_INDEX,
        id: playerId,
      });
      return result._source as PlayerData;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAllPlayers(): Promise<PlayerData[]> {
    const result = await this.client.search({
      index: this.PLAYERS_INDEX,
      query: { match_all: {} },
      size: 10000,
    });

    return result.hits.hits.map((hit: any) => hit._source as PlayerData);
  }

  async updatePlayerPosition(
    playerId: string,
    position: Position
  ): Promise<void> {
    await this.client.update({
      index: this.PLAYERS_INDEX,
      id: playerId,
      doc: {
        position,
        lastActive: new Date(),
      },
      refresh: true,
    });
  }

  async addItemToPlayerInventory(
    playerId: string,
    itemId: string
  ): Promise<void> {
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    const inventory = player.inventory || [];
    const collectedItems = player.collectedItems || [];

    if (!inventory.includes(itemId)) {
      inventory.push(itemId);
    }
    if (!collectedItems.includes(itemId)) {
      collectedItems.push(itemId);
    }

    await this.client.update({
      index: this.PLAYERS_INDEX,
      id: playerId,
      doc: {
        inventory,
        collectedItems,
        lastActive: new Date(),
      },
      refresh: true,
    });
  }

  async saveWorldConfig(
    width: number,
    height: number,
    tileSize: number
  ): Promise<void> {
    await this.client.index({
      index: this.WORLD_CONFIG_INDEX,
      id: "current",
      document: {
        width,
        height,
        tileSize,
        updatedAt: new Date(),
      },
      refresh: true,
    });
  }

  async getWorldConfig(): Promise<{
    width: number;
    height: number;
    tileSize: number;
  } | null> {
    try {
      const result = await this.client.get({
        index: this.WORLD_CONFIG_INDEX,
        id: "current",
      });
      return result._source as any;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    const indices = [
      this.AGENTS_INDEX,
      this.ITEMS_INDEX,
      this.TILES_INDEX,
      this.PLAYERS_INDEX,
      this.WORLD_CONFIG_INDEX,
    ];

    for (const index of indices) {
      try {
        await this.client.deleteByQuery({
          index,
          query: { match_all: {} },
          refresh: true,
        });
      } catch (error) {
        console.error(`Error clearing index ${index}:`, error);
      }
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}
