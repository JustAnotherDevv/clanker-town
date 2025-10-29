import { v4 as uuidv4 } from "uuid";
import { ElasticsearchService } from "./ElasticSearchService";

export interface Position {
  x: number;
  y: number;
}

export interface GameAgent {
  id: string;
  lettaAgentId: string;
  name: string;
  position: Position;
  description: string;
  createdAt: Date;
  suiAddress: string;
  suiPublicKey: string;
  suiPrivateKey: string;
}

// Tile system
export enum TileType {
  GRASS = "grass",
  WATER = "water",
  STONE = "stone",
  SAND = "sand",
  DIRT = "dirt",
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
}

export interface SpriteSheet {
  url: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  loop?: boolean;
  columns?: number;
}

// World objects
export interface WorldItem {
  id: string;
  name: string;
  position: Position;
  imageUrl?: string;
  spriteSheet?: SpriteSheet;
  size?: number;
  interactive?: boolean;
  description?: string;
  collectedBy?: string;
  collectedAt?: Date;
}

export class GameWorld {
  private agents: Map<string, GameAgent> = new Map();
  private items: Map<string, WorldItem> = new Map();
  private tiles: Tile[] = [];
  private worldWidth: number;
  private worldHeight: number;
  private tileSize: number = 10;
  private esService?: ElasticsearchService;
  private persistenceEnabled: boolean = false;

  constructor(
    width: number = 100,
    height: number = 100,
    esService?: ElasticsearchService
  ) {
    this.worldWidth = width;
    this.worldHeight = height;
    this.esService = esService;
    this.persistenceEnabled = !!esService;
  }

  /**
   * Initialize the world - load from Elasticsearch or generate defaults
   */
  async initialize(): Promise<void> {
    if (this.persistenceEnabled && this.esService) {
      await this.loadFromElasticsearch();
    } else {
      this.tiles = this.generateDefaultTilemap();
      this.generateDefaultItems();
    }
  }

  /**
   * Load all data from Elasticsearch
   */
  private async loadFromElasticsearch(): Promise<void> {
    if (!this.esService) return;

    try {
      console.log("📥 Loading world data from Elasticsearch...");

      const config = await this.esService.getWorldConfig();
      if (config) {
        this.worldWidth = config.width;
        this.worldHeight = config.height;
        this.tileSize = config.tileSize;
        console.log(
          `  ✓ Loaded world config: ${config.width}x${config.height}`
        );
      } else {
        await this.esService.saveWorldConfig(
          this.worldWidth,
          this.worldHeight,
          this.tileSize
        );
      }

      const tiles = await this.esService.getAllTiles();
      if (tiles.length > 0) {
        this.tiles = tiles;
        console.log(`  ✓ Loaded ${tiles.length} tiles`);
      } else {
        this.tiles = this.generateDefaultTilemap();
        await this.esService.saveTiles(this.tiles);
        console.log(
          `  ✓ Generated and saved ${this.tiles.length} default tiles`
        );
      }

      const items = await this.esService.getAllItems();
      this.items.clear();
      items.forEach((item) => {
        this.items.set(item.id, item);
      });
      if (items.length > 0) {
        console.log(`  ✓ Loaded ${items.length} items`);
      } else {
        this.generateDefaultItems();
        console.log(`  ✓ Generated ${this.items.size} default items`);
      }

      const agents = await this.esService.getAllAgents();
      this.agents.clear();
      agents.forEach((agent) => {
        this.agents.set(agent.id, agent);
      });
      console.log(`  ✓ Loaded ${agents.length} agents`);

      console.log("✅ World data loaded successfully from Elasticsearch");
    } catch (error) {
      console.error("❌ Error loading from Elasticsearch:", error);
      console.log("⚠️  Falling back to default world generation");
      this.tiles = this.generateDefaultTilemap();
      this.generateDefaultItems();
    }
  }

  /**
   * Generate a default tilemap with some variety
   */
  private generateDefaultTilemap(): Tile[] {
    const tiles: Tile[] = [];
    const tilesX = Math.ceil(this.worldWidth / this.tileSize);
    const tilesY = Math.ceil(this.worldHeight / this.tileSize);

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        let type = TileType.GRASS;

        if (x >= 3 && x <= 5 && y >= 3 && y <= 5) {
          type = TileType.WATER;
        } else if (x === 7 || y === 7) {
          type = TileType.STONE;
        } else if ((x + y) % 7 === 0) {
          type = TileType.SAND;
        }

        tiles.push({ x, y, type });
      }
    }

    return tiles;
  }

  /**
   * Generate default items in the world
   */
  private generateDefaultItems(): void {
    const defaultItems: Omit<WorldItem, "id">[] = [
      {
        name: "Ancient Tree",
        position: { x: 20, y: 60 },
        imageUrl: "/assets/tree.png",
        size: 8,
        interactive: false,
        description: "A massive ancient oak tree",
      },
      {
        name: "Treasure Chest",
        position: { x: 30, y: 30 },
        imageUrl: "/assets/chest.png",
        size: 5,
        interactive: true,
        description: "A mysterious treasure chest...",
      },
      {
        name: "Magic Crystal",
        position: { x: 70, y: 40 },
        spriteSheet: {
          url: "/assets/crystal.png",
          frameCount: 4,
          frameWidth: 32,
          frameHeight: 32,
          fps: 6,
          loop: true,
        },
        size: 3,
        interactive: true,
        description: "A glowing magic crystal",
      },
    ];

    defaultItems.forEach((item) => {
      const id = uuidv4();
      const newItem = { id, ...item };
      this.items.set(id, newItem);

      if (this.persistenceEnabled && this.esService) {
        this.esService.saveItem(newItem).catch((error) => {
          console.error("Error saving default item:", error);
        });
      }
    });
  }

  /**
   * Add an agent to the world
   */
  async addAgent(
    lettaAgentId: string,
    name: string,
    description: string,
    suiAddress: string,
    suiPublicKey: string,
    suiPrivateKey: string,
    position?: Position
  ): Promise<GameAgent> {
    const agentId = uuidv4();
    const randomPosition = position || this.getRandomPosition();

    const agent: GameAgent = {
      id: agentId,
      lettaAgentId,
      name,
      description,
      position: randomPosition,
      createdAt: new Date(),
      suiAddress,
      suiPublicKey,
      suiPrivateKey,
    };

    this.agents.set(agentId, agent);

    if (this.persistenceEnabled && this.esService) {
      await this.esService.saveAgent(agent);
    }

    return agent;
  }

  /**
   * Get an agent by game ID
   */
  getAgent(agentId: string): GameAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get an agent by Letta agent ID
   */
  getAgentByLettaId(lettaAgentId: string): GameAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.lettaAgentId === lettaAgentId) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Update agent position
   */
  async updateAgentPosition(
    agentId: string,
    position: Position
  ): Promise<GameAgent | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    agent.position = {
      x: Math.max(0, Math.min(position.x, this.worldWidth)),
      y: Math.max(0, Math.min(position.y, this.worldHeight)),
    };

    if (this.persistenceEnabled && this.esService) {
      await this.esService.updateAgentPosition(agentId, agent.position);
    }

    return agent;
  }

  /**
   * Get all agents
   */
  getAllAgents(): GameAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents within a certain range of a position
   */
  getAgentsInRange(position: Position, range: number): GameAgent[] {
    return this.getAllAgents().filter((agent) => {
      const distance = Math.sqrt(
        Math.pow(agent.position.x - position.x, 2) +
          Math.pow(agent.position.y - position.y, 2)
      );
      return distance <= range;
    });
  }

  /**
   * Remove an agent from the world
   */
  async removeAgent(agentId: string): Promise<boolean> {
    const deleted = this.agents.delete(agentId);

    if (deleted && this.persistenceEnabled && this.esService) {
      await this.esService.deleteAgent(agentId);
    }

    return deleted;
  }

  /**
   * Get all tiles
   */
  getAllTiles(): Tile[] {
    return this.tiles;
  }

  /**
   * Set custom tilemap
   */
  async setTilemap(tiles: Tile[]): Promise<void> {
    this.tiles = tiles;

    if (this.persistenceEnabled && this.esService) {
      await this.esService.saveTiles(tiles);
    }
  }

  /**
   * Get tile at specific grid position
   */
  getTileAt(x: number, y: number): Tile | undefined {
    return this.tiles.find((tile) => tile.x === x && tile.y === y);
  }

  /**
   * Update a specific tile
   */
  async updateTile(x: number, y: number, type: TileType): Promise<boolean> {
    const tile = this.getTileAt(x, y);
    if (tile) {
      tile.type = type;

      if (this.persistenceEnabled && this.esService) {
        await this.esService.updateTile(x, y, type);
      }

      return true;
    }
    return false;
  }

  /**
   * Get all items (excluding collected ones)
   */
  getAllItems(): WorldItem[] {
    return Array.from(this.items.values()).filter((item) => !item.collectedBy);
  }

  /**
   * Get a specific item
   */
  getItem(itemId: string): WorldItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * Add an item to the world
   */
  async addItem(item: Omit<WorldItem, "id">): Promise<WorldItem> {
    const id = uuidv4();
    const newItem: WorldItem = { id, ...item };
    this.items.set(id, newItem);

    if (this.persistenceEnabled && this.esService) {
      await this.esService.saveItem(newItem);
    }

    return newItem;
  }

  /**
   * Remove an item from the world
   */
  async removeItem(itemId: string): Promise<boolean> {
    const deleted = this.items.delete(itemId);

    if (deleted && this.persistenceEnabled && this.esService) {
      await this.esService.deleteItem(itemId);
    }

    return deleted;
  }

  /**
   * Mark item as collected by a player
   */
  async collectItem(
    itemId: string,
    playerId: string
  ): Promise<WorldItem | null> {
    const item = this.items.get(itemId);
    if (!item || item.collectedBy) {
      return null;
    }

    item.collectedBy = playerId;
    item.collectedAt = new Date();

    if (this.persistenceEnabled && this.esService) {
      await this.esService.updateItemCollection(
        itemId,
        playerId,
        item.collectedAt
      );
      await this.esService.addItemToPlayerInventory(playerId, itemId);
    }

    return item;
  }

  /**
   * Get items within range of a position
   */
  getItemsInRange(position: Position, range: number): WorldItem[] {
    return this.getAllItems().filter((item) => {
      const distance = Math.sqrt(
        Math.pow(item.position.x - position.x, 2) +
          Math.pow(item.position.y - position.y, 2)
      );
      return distance <= range;
    });
  }

  /**
   * Get a random position within world bounds
   */
  private getRandomPosition(): Position {
    return {
      x: Math.floor(Math.random() * this.worldWidth),
      y: Math.floor(Math.random() * this.worldHeight),
    };
  }

  /**
   * Get world dimensions
   */
  getWorldDimensions() {
    return {
      width: this.worldWidth,
      height: this.worldHeight,
    };
  }

  /**
   * Get tile size
   */
  getTileSize(): number {
    return this.tileSize;
  }
}
