import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X } from "lucide-react";

/*
 * IMAGE SYSTEM USAGE GUIDE
 * ========================
 *
 * This game supports custom images for map tiles, player, AI agents, and world items.
 *
 * 1. MAP TILES (NEW TILEMAP SYSTEM!):
 *    TWO OPTIONS:
 *
 *    OPTION A - Simple (deprecated but still works):
 *    - Set ASSETS.mapTileUrl to a single tile image
 *    - Image will be repeated as a pattern across the map
 *
 *    OPTION B - Tilemap with multiple terrain types (RECOMMENDED):
 *    - Set ASSETS.tileImages with URLs for each TileType
 *    - Each tile in gameState.tiles can be a different type
 *    - Supports: GRASS, WATER, STONE, SAND, DIRT
 *    - Set ASSETS.tileSize to control tile dimensions (default: 10)
 *
 *    Example:
 *      tileImages: {
 *        [TileType.GRASS]: "/assets/grass.png",
 *        [TileType.WATER]: "/assets/water.png",
 *        [TileType.STONE]: "/assets/stone.png"
 *      }
 *
 *    Generate tilemap from backend or use generateExampleTilemap()
 *
 * 2. WORLD ITEMS (NEW!):
 *    - Place items/objects anywhere in the world
 *    - Support for both static images and animated sprite sheets
 *    - Items can be interactive (player can collect/interact)
 *    - Items highlighted when player is nearby
 *
 *    Example static item:
 *      {
 *        id: "chest-1",
 *        name: "Treasure Chest",
 *        position: { x: 30, y: 30 },
 *        imageUrl: "/assets/chest.png",
 *        size: 5,
 *        interactive: true,
 *        description: "A mysterious chest..."
 *      }
 *
 *    Example animated item:
 *      {
 *        id: "crystal-1",
 *        name: "Magic Crystal",
 *        position: { x: 70, y: 40 },
 *        spriteSheet: {
 *          url: "/assets/crystal.png",
 *          frameCount: 4,
 *          frameWidth: 32,
 *          frameHeight: 32,
 *          fps: 6
 *        },
 *        size: 3,
 *        interactive: true
 *      }
 *
 * 3. PLAYER SPRITE:
 *    - Set ASSETS.defaultPlayerImageUrl for the default player image
 *    - Or set gameState.player.imageUrl dynamically using setPlayerImage()
 *    - Leave undefined to use the default blue circle
 *
 * 4. AGENT SPRITES:
 *    - Set ASSETS.defaultAgentImageUrl for a default agent image
 *    - Or include imageUrl in your backend agent data for per-agent images
 *    - Leave undefined to use the default colored circles
 *
 * 5. SPRITE SHEET ANIMATIONS:
 *    - Support for animated sprites using sprite sheets
 *    - Two formats supported:
 *      A) Horizontal strip (1 row) - default
 *      B) 2D grid (multiple rows and columns)
 *    - Priority: spriteSheet > imageUrl > default circle
 *
 *    HORIZONTAL STRIP (1 row):
 *    [Frame1][Frame2][Frame3][Frame4]
 *
 *    Example configuration:
 *      spriteSheet: {
 *        url: "/assets/warrior-walk.png",
 *        frameCount: 4,
 *        frameWidth: 32,
 *        frameHeight: 32,
 *        fps: 8,
 *        loop: true
 *        // columns: omit or set to frameCount for horizontal
 *      }
 *
 *    2D GRID (multiple rows):
 *    [Frame1][Frame2]
 *    [Frame3][Frame4]
 *
 *    Example configuration:
 *      spriteSheet: {
 *        url: "/assets/warrior-walk.png",
 *        frameCount: 4,
 *        frameWidth: 32,
 *        frameHeight: 32,
 *        columns: 2,        // 2 frames per row!
 *        fps: 8,
 *        loop: true
 *      }
 *
 *    Frame order: Left to right, top to bottom (like reading)
 *    Each agent can have unique sprite sheet via backend
 *    Use ASSETS.defaultPlayerSpriteSheet or defaultAgentSpriteSheet for defaults
 *
 * 5. SPRITE ANIMATIONS - IDLE/WALK (PLAYER ONLY, NEW!):
 *    - Support for separate idle and walk animations for the player
 *    - Automatically switches between idle/walk based on movement
 *    - Sprites flip horizontally based on movement direction (left/right)
 *    - Priority: spriteAnimations > spriteSheet > imageUrl > circle
 *
 *    Example configuration:
 *      defaultPlayerSpriteAnimations: {
 *        idle: {                        // Idle animation (optional)
 *          url: "/assets/player-idle.png",
 *          frameCount: 4,
 *          frameWidth: 32,
 *          frameHeight: 32,
 *          fps: 4,
 *          loop: true
 *        },
 *        walk: {                        // Walk animation (required)
 *          url: "/assets/player-walk.png",
 *          frameCount: 6,
 *          frameWidth: 32,
 *          frameHeight: 32,
 *          fps: 8,
 *          loop: true
 *        }
 *      }
 *
 *    - If idle is omitted, first frame of walk animation is shown when idle
 *    - Sprite automatically flips when moving left (faces left)
 *    - Design sprites facing RIGHT by default for best results
 *
 * 7. SPRITE SIZE:
 *    - Adjust ASSETS.spriteSize to match your image dimensions
 *    - Default is 8 world units
 *    - Adjust ASSETS.itemSize for world items (default: 4)
 *    - Adjust ASSETS.tileSize for tilemap tiles (default: 10)
 *    - Recommended: Use consistent sizes for all sprites
 *
 * 8. EXAMPLE SETUP:
 *    // Horizontal strip (1D)
 *    const ASSETS: AssetConfig = {
 *      mapTileUrl: "/assets/grass.png",
 *      defaultPlayerSpriteSheet: {
 *        url: "/assets/player-walk.png",
 *        frameCount: 4,
 *        frameWidth: 32,
 *        frameHeight: 32,
 *        fps: 8
 *        // columns omitted = horizontal strip
 *      },
 *      spriteSize: 8,
 *    };
 *
 *    // 2D grid format
 *    const ASSETS: AssetConfig = {
 *      mapTileUrl: "/assets/grass.png",
 *      defaultPlayerSpriteSheet: {
 *        url: "/assets/player-walk.png",
 *        frameCount: 4,
 *        frameWidth: 32,
 *        frameHeight: 32,
 *        columns: 2,  // 2×2 grid!
 *        fps: 8
 *      },
 *      spriteSize: 8,
 *    };
 *
 * 9. BACKEND INTEGRATION:
 *    AGENTS:
 *    - Include imageUrl OR spriteSheet field in your agent API responses
 *    - Each agent can have its own unique image or animation
 *    - Example agent response with static image:
 *      {
 *        id: "agent-1",
 *        name: "Merchant",
 *        position: { x: 50, y: 50 },
 *        imageUrl: "/assets/merchant.png",  // Static image
 *        balance: 125.50,
 *        inventory: [...]
 *      }
 *    - Example agent response with sprite sheet:
 *      {
 *        id: "agent-2",
 *        name: "Warrior",
 *        position: { x: 75, y: 60 },
 *        spriteSheet: {                     // Animated sprite
 *          url: "/assets/warrior-idle.png",
 *          frameCount: 6,
 *          frameWidth: 32,
 *          frameHeight: 32,
 *          fps: 10
 *        },
 *        balance: 125.50,  // $SUI balance (optional)
 *        inventory: [      // Optional inventory array
 *          {
 *            id: "item-1",
 *            name: "Health Potion",
 *            quantity: 3,
 *            icon: "🧪",
 *            rarity: "common"
 *          },
 *          {
 *            id: "item-2",
 *            name: "Magic Sword",
 *            quantity: 1,
 *            icon: "⚔️",
 *            rarity: "legendary"
 *          }
 *        ]
 *      }
 *
 *    TILEMAP & ITEMS (from backend):
 *    - Return tiles array with {x, y, type} for each grid tile
 *    - Return items array with WorldItem objects
 *    - Items can be static images or animated sprite sheets
 *    - See generateExampleTilemap() and generateExampleItems() for examples
 *
 * 10. AGENT BALANCE & INVENTORY:
 *    - balance: Number representing $SUI tokens the agent holds
 *    - inventory: Array of items the agent carries
 *    - Rarity levels: 'common' | 'rare' | 'epic' | 'legendary'
 *    - Items show with color coding based on rarity
 *    - Up to 2 items shown in modal, with count of remaining items
 *
 * 11. IMAGE RECOMMENDATIONS:
 *    - Use PNG format with transparency for sprites
 *    - Recommended sprite size: 32x32px to 64x64px
 *    - Tile size: 32x32px or 64x64px for seamless tiling
 *    - Item size: 16x16px to 32x32px
 *    - Sprite sheets: horizontal strip or 2D grid format
 *    - Design sprites facing RIGHT for proper horizontal flipping
 *    - Optimize images for web (use tools like TinyPNG)
 *
 * 12. PERFORMANCE TIPS:
 *    - Keep sprite images small (< 50KB each)
 *    - Keep tile images small (< 10KB each)
 *    - Use CDN or local hosting for better load times
 *    - Images are cached by the browser automatically
 *    - For large tilemaps, consider chunking/culling off-screen tiles
 */

// Types
interface Position {
  x: number;
  y: number;
}

interface SpriteSheet {
  url: string; // URL to sprite sheet image
  frameCount: number; // Total number of frames
  frameWidth: number; // Width of each frame in pixels
  frameHeight: number; // Height of each frame in pixels
  fps?: number; // Frames per second (default: 8)
  loop?: boolean; // Loop animation (default: true)
  columns?: number; // Number of columns in grid (default: frameCount for horizontal strip)
  playStop?: number;
}

interface SpriteAnimations {
  idle?: SpriteSheet; // Idle animation (or null to use first frame of walk)
  walk: SpriteSheet; // Walk animation
}

interface Agent {
  id: string;
  lettaAgentId: string;
  name: string;
  position: Position;
  description: string;
  createdAt: string;
  imageUrl?: string; // Optional static image URL for agent sprite
  spriteSheet?: SpriteSheet; // Optional sprite sheet for animation (takes priority over imageUrl)
  spriteAnimations?: SpriteAnimations; // Optional separate idle/walk animations (takes priority over spriteSheet)
  balance?: number; // $SUI balance (optional, from backend)
  inventory?: InventoryItem[]; // Agent's inventory (optional, from backend)
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  icon?: string; // Optional emoji or icon
  rarity?: "common" | "rare" | "epic" | "legendary";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Tile system for world map
enum TileType {
  GRASS = "grass",
  WATER = "water",
  STONE = "stone",
  SAND = "sand",
  DIRT = "dirt",
  // Add more tile types as needed
}

interface Tile {
  x: number; // Grid position X
  y: number; // Grid position Y
  type: TileType; // Type of tile
}

// Items/objects that can be placed in the world
interface WorldItem {
  id: string;
  name: string;
  position: Position; // World coordinates (not grid)
  imageUrl?: string; // Static image URL
  spriteSheet?: SpriteSheet; // Animated sprite sheet
  size?: number; // Optional custom size (defaults to ASSETS.itemSize)
  interactive?: boolean; // Can player interact with this item?
  description?: string; // Description shown when interacting
}

interface GameState {
  player: {
    position: Position;
    name: string;
    imageUrl?: string; // Optional static image URL for player sprite
    spriteSheet?: SpriteSheet; // Optional sprite sheet for animation
    spriteAnimations?: SpriteAnimations; // Optional separate idle/walk animations
    facingRight: boolean; // Direction player is facing (for sprite flipping)
    isMoving: boolean; // Whether player is currently moving
  };
  agents: Agent[];
  nearbyAgents: Agent[];
  selectedAgent: Agent | null;
  chatHistory: ChatMessage[];
  historicalChatHistory: ChatMessage[]; // Messages from previous sessions
  currentSessionStart: number; // Index where current session starts
  isLoading: boolean;
  worldDimensions: { width: number; height: number };
  tiles: Tile[]; // Tilemap for world background
  items: WorldItem[]; // Items placed in the world
  nearbyItems: WorldItem[]; // Items near the player
}

// Asset configuration - customize these URLs for your game
interface AssetConfig {
  // Background tiles - can be single or multiple types
  mapTileUrl?: string; // Default/fallback tile image (deprecated - use tileImages instead)
  tileImages?: Record<TileType, string>; // URLs for each tile type
  tileSize?: number; // Size of each tile in world units (default: 10)

  // Player sprites
  defaultPlayerImageUrl?: string; // Default player sprite (static)
  defaultPlayerSpriteSheet?: SpriteSheet; // Default player sprite sheet (animated)
  defaultPlayerSpriteAnimations?: SpriteAnimations; // Default player animations (idle/walk)

  // Agent sprites
  defaultAgentImageUrl?: string; // Default agent sprite if agent doesn't have one
  defaultAgentSpriteSheet?: SpriteSheet; // Default agent sprite sheet (animated)
  defaultAgentSpriteAnimations?: SpriteAnimations; // Default agent animations (idle/walk)

  // Sizes
  spriteSize: number; // Size of sprite images in world units
  itemSize?: number; // Default size for world items (default: 4)
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Camera viewport configuration - adjust these to change visible area
const CAMERA_VIEWPORT_WIDTH = 50;
const CAMERA_VIEWPORT_HEIGHT = 50;

// Movement and camera tuning - adjust these for feel
const PLAYER_MOVE_SPEED = 20; // Units per second
const CAMERA_LERP_FACTOR = 0.15; // 0.1 = very smooth, 0.3 = snappy (range: 0.05-0.5)

// Asset configuration - customize with your image URLs
// QUICK START:
// 1. Add your images to /public/assets/ folder
// 2. Uncomment and update URLs below:
//    mapTileUrl: "/assets/grass.png"
//    defaultPlayerImageUrl: "/assets/player.png"
//    defaultAgentImageUrl: "/assets/npc.png"
// 3. Adjust spriteSize to match your images
//
// ⚠️ IMPORTANT - TRANSPARENCY SUPPORT:
// - Use PNG (.png) or WebP (.webp) for sprites with transparent backgrounds
// - JPG/JPEG (.jpg/.jpeg) DO NOT support transparency - they will show background
// - For best results with pixel art: use PNG format
//
// 🐛 TROUBLESHOOTING:
// If your WebP/PNG files still show a background:
// - The image file has a solid background color baked in (not actual transparency)
// - Use remove.bg to remove the background and re-export as PNG
// - See TRANSPARENCY_FIX_GUIDE.md for detailed instructions
const ASSETS: AssetConfig = {
  // TILEMAP - Define different tile types for your world
  // Option 1: Single tile for everything (deprecated but still works)
  // mapTileUrl: "/assets/shrooms_grass.jpeg",

  // Option 2: Different tiles for different terrain types (recommended)
  tileImages: {
    [TileType.GRASS]: "/assets/magic_muddy_grass.jpeg",
    // "/assets/shrooms_grass.jpeg",
    [TileType.WATER]: "/assets/water.jpeg",
    [TileType.STONE]: "/assets/stone_tile.png",
    [TileType.SAND]: "/assets/grass_hole.webp",
    [TileType.DIRT]: "/assets/grass_dirt_patch.webp",
    // "/assets/magic_grassy.webp",
    // "/assets/shrooms_grass.jpeg",
  },
  tileSize: 10, // Size of each tile in world units

  // PLAYER - Choose one: static image OR sprite sheet animation OR sprite animations (idle/walk)
  // defaultPlayerImageUrl: "/assets/warrior_1.webp", // Static player image
  // defaultPlayerSpriteSheet: {                    // OR animated player sprite (single animation)
  //   url: "/assets/player-walk.png",
  //   frameCount: 4,
  //   frameWidth: 32,
  //   frameHeight: 32,
  //   fps: 8,
  //   loop: true
  // },

  defaultPlayerSpriteAnimations: {
    // OR separate idle/walk animations
    idle: {
      // Idle animation (can be same sprite sheet showing just first frame)
      url: "/assets/k_i_b.png",
      frameCount: 4, // Just show first frame when idle
      frameWidth: 512,
      frameHeight: 512,
      columns: 2,
      fps: 3,
      loop: true,
    },
    walk: {
      // Walk animation
      url: "/assets/k_w_b.png",
      frameCount: 4,
      frameWidth: 512,
      frameHeight: 512,
      columns: 2, // 2x2 grid: frames arranged in 2 columns
      fps: 4,
      loop: true,
    },
  },

  // AGENTS - Choose one: static image OR sprite sheet animation
  // defaultAgentImageUrl: "/assets/shroom_wizard_no_bg.png", // Static agent image
  // defaultAgentSpriteSheet: {                  // OR animated agent sprite
  //   url: "/assets/npc-idle.png",
  //   frameCount: 4,
  //   frameWidth: 32,
  //   frameHeight: 32,
  //   fps: 6,
  //   loop: true
  // },

  defaultAgentSpriteSheet: {
    // OR animated agent sprite
    url: "/assets/druid_1_idle_b.png",
    playStop: 3,
    frameCount: 9,
    frameWidth: 512,
    frameHeight: 512,
    columns: 3,
    fps: 1.7,
    loop: true,
  },

  spriteSize: 8, // Size of sprites in world units (adjust based on your images)
  itemSize: 4, // Default size for world items
};

// LocalStorage helpers for chat history
const CHAT_HISTORY_PREFIX = "letta_rpg_chat_";

const saveChatHistory = (agentId: string, messages: ChatMessage[]) => {
  try {
    const serializedMessages = messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }));
    localStorage.setItem(
      `${CHAT_HISTORY_PREFIX}${agentId}`,
      JSON.stringify(serializedMessages)
    );
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
};

const loadChatHistory = (agentId: string): ChatMessage[] => {
  try {
    const stored = localStorage.getItem(`${CHAT_HISTORY_PREFIX}${agentId}`);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return parsed.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

// Animated Sprite Component for sprite sheet animations
interface AnimatedSpriteProps {
  spriteSheet: SpriteSheet;
  x: number;
  y: number;
  size: number;
  flipX?: boolean; // Flip sprite horizontally
}

function AnimatedSprite({
  spriteSheet,
  x,
  y,
  size,
  flipX = false,
}: AnimatedSpriteProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const fps = spriteSheet.fps || 8;
  const loop = spriteSheet.loop !== false; // Default to true
  const columns = spriteSheet.columns || spriteSheet.frameCount; // Default to horizontal strip

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prevFrame) => {
        const nextFrame = prevFrame + 1;
        if (nextFrame >= spriteSheet?.playStop) {
          return loop ? 0 : spriteSheet?.playStop - 1;
        }
        if (nextFrame >= spriteSheet.frameCount) {
          return loop ? 0 : spriteSheet.frameCount - 1;
        }
        return nextFrame;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [spriteSheet.frameCount, fps, loop]);

  const halfSize = size / 2;

  // Calculate which frame to show (position in 2D grid)
  const row = Math.floor(currentFrame / columns);
  const col = currentFrame % columns;
  const sourceX = col * spriteSheet.frameWidth;
  const sourceY = row * spriteSheet.frameHeight;

  // Calculate scaling factor to fit frame into world size
  const scaleX = size / spriteSheet.frameWidth;
  const scaleY = size / spriteSheet.frameHeight;

  return (
    <g>
      <defs>
        {/* Clip to only show the current frame area */}
        <clipPath id={`sprite-clip-${x}-${y}`}>
          <rect x={x - halfSize} y={y - halfSize} width={size} height={size} />
        </clipPath>
      </defs>

      {/* The sprite sheet image, positioned to show current frame */}
      <image
        href={spriteSheet.url}
        x={x - halfSize - sourceX * scaleX}
        y={y - halfSize - sourceY * scaleY}
        width={columns * spriteSheet.frameWidth * scaleX}
        height={
          Math.ceil(spriteSheet.frameCount / columns) *
          spriteSheet.frameHeight *
          scaleY
        }
        clipPath={`url(#sprite-clip-${x}-${y})`}
        style={{ pointerEvents: "none" }}
        preserveAspectRatio="none"
        transform={flipX ? `scale(-1, 1) translate(${-2 * x}, 0)` : undefined}
      />
    </g>
  );
}

// Helper function to generate an example tilemap
// You can replace this with data from your backend
function generateExampleTilemap(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  const tileSize = ASSETS.tileSize || 10;
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);

  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      // Example pattern - mostly grass with some water and stone
      let type = TileType.GRASS;

      // Create a small water area
      if (x >= 3 && x <= 5 && y >= 3 && y <= 5) {
        //  type = TileType.STONE;
        type = TileType.WATER;
        // type = TileType.DIRT;
      }
      // Create a stone path
      else if (x === 7 || y === 7) {
        // type = TileType.WATER;
        type = TileType.DIRT;
      }
      // Some sand patches
      else if ((x + y) % 7 === 0) {
        type = TileType.SAND;
      }

      tiles.push({ x, y, type });
    }
  }

  return tiles;
}

// Helper function to generate example items
// You can replace this with data from your backend
function generateExampleItems(): WorldItem[] {
  return [
    // {
    //   id: "item-1",
    //   name: "Treasure Chest",
    //   position: { x: 30, y: 30 },
    //   imageUrl: "/assets/chest.png", // Static image
    //   size: 5,
    //   interactive: true,
    //   description: "A mysterious treasure chest...",
    // },
    // {
    //   id: "item-2",
    //   name: "Magic Crystal",
    //   position: { x: 70, y: 40 },
    //   spriteSheet: {
    //     // Animated item
    //     url: "/assets/crystal.png",
    //     frameCount: 4,
    //     frameWidth: 32,
    //     frameHeight: 32,
    //     fps: 6,
    //     loop: true,
    //   },
    //   size: 3,
    //   interactive: true,
    //   description: "A glowing magic crystal",
    // },
    // {
    //   id: "item-3",
    //   name: "Tree",
    //   position: { x: 20, y: 60 },
    //   imageUrl: "/assets/tree.png",
    //   size: 8,
    //   interactive: false,
    // },
  ];
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    player: {
      position: { x: 50, y: 50 },
      name: "You",
      facingRight: true, // Default facing direction
      isMoving: false, // Initially not moving
    },
    agents: [],
    nearbyAgents: [],
    selectedAgent: null,
    chatHistory: [],
    historicalChatHistory: [],
    currentSessionStart: 0,
    isLoading: false,
    worldDimensions: { width: 100, height: 100 },
    // tiles: generateExampleTilemap(100, 100), // Generate example tilemap
    // items: generateExampleItems(), // Generate example items
    tiles: [], // Will be loaded from backend
    items: [], // Will be loaded from backend
    nearbyItems: [],
  });

  // Camera offset for smooth following
  const [cameraOffset, setCameraOffset] = useState<Position>({ x: 0, y: 0 });

  const keysPressed = useRef<Record<string, boolean>>({});
  const lastFrameTime = useRef<number>(0);
  const cameraPosition = useRef<Position>({ x: 0, y: 0 });

  // Fetch agents on mount
  // useEffect(() => {
  //   fetchAgents();
  //   const interval = setInterval(fetchAgents, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    fetchWorldData(); // Gets tiles, items, agents, dimensions
    const interval = setInterval(fetchAgents, 1000); // Keep polling for agent updates
    return () => clearInterval(interval);
  }, []);

  // Fetch world dimensions on mount
  useEffect(() => {
    fetchWorldDimensions();
  }, []);

  // Initialize camera position centered on player
  useEffect(() => {
    const initialCameraX =
      gameState.player.position.x - CAMERA_VIEWPORT_WIDTH / 2;
    const initialCameraY =
      gameState.player.position.y - CAMERA_VIEWPORT_HEIGHT / 2;

    cameraPosition.current = {
      x: Math.max(0, initialCameraX),
      y: Math.max(0, initialCameraY),
    };

    setCameraOffset(cameraPosition.current);
  }, []); // Only run once on mount

  // Keyboard input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Unified game loop with requestAnimationFrame for smooth movement and camera
  useEffect(() => {
    let animationFrameId: number;

    const gameLoop = (currentTime: number) => {
      // Calculate delta time for frame-independent movement
      const deltaTime = lastFrameTime.current
        ? (currentTime - lastFrameTime.current) / 1000
        : 0;
      lastFrameTime.current = currentTime;

      setGameState((prevState) => {
        // Disable movement when chat dialog is open
        if (prevState.selectedAgent !== null) {
          return prevState;
        }

        const newPos = { ...prevState.player.position };
        const { width, height } = prevState.worldDimensions;

        // Calculate movement direction
        let moveX = 0;
        let moveY = 0;

        if (
          keysPressed.current["w"] ||
          keysPressed.current["arrowup"] ||
          keysPressed.current[" "]
        ) {
          moveY -= 1;
        }
        if (keysPressed.current["s"] || keysPressed.current["arrowdown"]) {
          moveY += 1;
        }
        if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) {
          moveX -= 1;
        }
        if (keysPressed.current["d"] || keysPressed.current["arrowright"]) {
          moveX += 1;
        }

        // Normalize diagonal movement so speed is consistent in all directions
        const moved = moveX !== 0 || moveY !== 0;

        // Determine facing direction (only update if moving horizontally)
        let newFacingRight = prevState.player.facingRight;
        if (moveX > 0) {
          newFacingRight = true; // Moving right
        } else if (moveX < 0) {
          newFacingRight = false; // Moving left
        }

        if (moved) {
          const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
          moveX = (moveX / magnitude) * PLAYER_MOVE_SPEED * deltaTime;
          moveY = (moveY / magnitude) * PLAYER_MOVE_SPEED * deltaTime;

          newPos.x = Math.max(0, Math.min(width, newPos.x + moveX));
          newPos.y = Math.max(0, Math.min(height, newPos.y + moveY));
        }

        // Update camera position smoothly
        const targetCameraX = newPos.x - CAMERA_VIEWPORT_WIDTH / 2;
        const targetCameraY = newPos.y - CAMERA_VIEWPORT_HEIGHT / 2;

        // Smooth camera lerp
        cameraPosition.current.x +=
          (targetCameraX - cameraPosition.current.x) * CAMERA_LERP_FACTOR;
        cameraPosition.current.y +=
          (targetCameraY - cameraPosition.current.y) * CAMERA_LERP_FACTOR;

        // Clamp camera to world boundaries
        const maxX = Math.max(0, width - CAMERA_VIEWPORT_WIDTH);
        const maxY = Math.max(0, height - CAMERA_VIEWPORT_HEIGHT);
        cameraPosition.current.x = Math.max(
          0,
          Math.min(maxX, cameraPosition.current.x)
        );
        cameraPosition.current.y = Math.max(
          0,
          Math.min(maxY, cameraPosition.current.y)
        );

        // Update camera state
        setCameraOffset({
          x: cameraPosition.current.x,
          y: cameraPosition.current.y,
        });

        if (moved) {
          // Check for nearby agents
          const nearby = prevState.agents.filter(
            (agent) =>
              Math.sqrt(
                Math.pow(agent.position.x - newPos.x, 2) +
                  Math.pow(agent.position.y - newPos.y, 2)
              ) <= 15
          );

          // Check for nearby items
          const nearbyItems = prevState.items.filter(
            (item) =>
              Math.sqrt(
                Math.pow(item.position.x - newPos.x, 2) +
                  Math.pow(item.position.y - newPos.y, 2)
              ) <= 10
          );

          return {
            ...prevState,
            player: {
              ...prevState.player,
              position: newPos,
              facingRight: newFacingRight,
              isMoving: true,
            },
            nearbyAgents: nearby,
            nearbyItems: nearbyItems,
          };
        }

        // Not moving - update isMoving to false but keep position and facing
        return {
          ...prevState,
          player: {
            ...prevState.player,
            isMoving: false,
          },
        };
      });

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  // API Functions
  const fetchAgents = async () => {
    try {
      const response = await fetch(`${API_BASE}/agents`);
      const data = await response.json();
      if (data.success && data.agents) {
        setGameState((prev) => {
          // Only update if agents have actually changed
          const agentsChanged =
            JSON.stringify(prev.agents) !== JSON.stringify(data.agents);

          if (!agentsChanged) {
            return prev;
          }

          // MOCK DATA FOR TESTING: Uncomment to add fake balance & inventory to agents
          // const agentsWithMockData = data.agents.map((agent: Agent, index: number) => ({
          //   ...agent,
          //   balance: Math.random() * 1000,
          //   inventory: index === 0 ? [
          //     { id: "1", name: "Health Potion", quantity: 5, icon: "🧪", rarity: "common" },
          //     { id: "2", name: "Magic Sword", quantity: 1, icon: "⚔️", rarity: "legendary" },
          //     { id: "3", name: "Shield", quantity: 1, icon: "🛡️", rarity: "rare" },
          //   ] : []
          // }));

          return {
            ...prev,
            agents: data.agents, // Replace with agentsWithMockData to test
          };
        });
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  };

  const fetchWorldDimensions = async () => {
    try {
      const response = await fetch(`${API_BASE}/world/dimensions`);
      const data = await response.json();
      if (data.success) {
        setGameState((prev) => ({
          ...prev,
          worldDimensions: data.dimensions,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch world dimensions:", error);
    }
  };

  const fetchWorldData = async () => {
    try {
      const response = await fetch(`${API_BASE}/world`);
      const data = await response.json();
      if (data.success && data.world) {
        setGameState((prev) => ({
          ...prev,
          worldDimensions: data.world.dimensions,
          tiles: data.world.tiles || [],
          items: data.world.items || [],
          agents: data.world.agents || prev.agents,
        }));
        console.log("✅ Loaded world data:", {
          tiles: data.world.tiles?.length,
          items: data.world.items?.length,
          agents: data.world.agents?.length,
        });
      }
    } catch (error) {
      console.error("Failed to fetch world data:", error);
    }
  };

  const sendMessage = useCallback(
    async (message: string) => {
      if (!gameState.selectedAgent || !message.trim()) return;

      const agentId = gameState.selectedAgent.id; // Capture agent ID to avoid stale closure
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      // Update state with user message
      setGameState((prev) => ({
        ...prev,
        chatHistory: [...prev.chatHistory, userMessage],
        isLoading: true,
      }));

      try {
        const response = await fetch(`${API_BASE}/agents/${agentId}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        });

        const data = await response.json();

        if (data.success) {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: data.agentResponse,
            timestamp: new Date(),
          };

          // Update state with assistant message
          setGameState((prev) => {
            const newChatHistory = [...prev.chatHistory, assistantMessage];

            // Save to localStorage after each exchange
            if (prev.selectedAgent) {
              saveChatHistory(prev.selectedAgent.id, newChatHistory);
            }

            return {
              ...prev,
              chatHistory: newChatHistory,
              isLoading: false,
            };
          });
        } else {
          // Handle error case
          setGameState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        setGameState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    },
    [gameState.selectedAgent]
  );

  const selectAgent = (agent: Agent) => {
    // Clear any pressed keys to prevent movement after closing dialog
    keysPressed.current = {};

    // Load historical chat history for this agent
    const historicalMessages = loadChatHistory(agent.id);

    setGameState((prev) => ({
      ...prev,
      selectedAgent: agent,
      historicalChatHistory: historicalMessages,
      chatHistory: historicalMessages, // Start with historical messages
      currentSessionStart: historicalMessages.length, // Mark where new session begins
    }));
  };

  const closeChat = () => {
    // Save chat history before closing
    if (gameState.selectedAgent && gameState.chatHistory.length > 0) {
      saveChatHistory(gameState.selectedAgent.id, gameState.chatHistory);
    }

    // Clear any pressed keys to prevent movement after closing dialog
    keysPressed.current = {};

    setGameState((prev) => ({
      ...prev,
      selectedAgent: null,
      chatHistory: [],
      historicalChatHistory: [],
      currentSessionStart: 0,
    }));
  };

  const clearChatHistory = () => {
    if (gameState.selectedAgent) {
      // Clear from localStorage
      localStorage.removeItem(
        `${CHAT_HISTORY_PREFIX}${gameState.selectedAgent.id}`
      );

      // Update state
      setGameState((prev) => ({
        ...prev,
        chatHistory: [],
        historicalChatHistory: [],
        currentSessionStart: 0,
      }));
    }
  };

  // Helper function to update player image (can be called from your backend)
  const setPlayerImage = (imageUrl: string) => {
    setGameState((prev) => ({
      ...prev,
      player: {
        ...prev.player,
        imageUrl,
      },
    }));
  };

  // Helper function to update agent images (called when agents are fetched)
  // Your backend can include imageUrl in the agent data
  const updateAgentImages = (agentId: string, imageUrl: string) => {
    setGameState((prev) => ({
      ...prev,
      agents: prev.agents.map((agent) =>
        agent.id === agentId ? { ...agent, imageUrl } : agent
      ),
    }));
  };

  const calculateDistance = (pos1: Position, pos2: Position) => {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
    );
  };

  // Calculate viewBox with camera following player
  const viewBox = `${cameraOffset.x} ${cameraOffset.y} ${CAMERA_VIEWPORT_WIDTH} ${CAMERA_VIEWPORT_HEIGHT}`;

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden w-screen">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm p-4">
        <h1 className="text-2xl font-bold text-white">🎮 Letta RPG World</h1>
        <p className="text-sm text-slate-400 mt-1">
          Position: ({gameState.player.position.x.toFixed(1)},{" "}
          {gameState.player.position.y.toFixed(1)}) | Nearby Agents:{" "}
          {gameState.nearbyAgents.length} | Nearby Items:{" "}
          {gameState.nearbyItems.length}
          {gameState.selectedAgent && (
            <span className="ml-2 text-orange-400">
              🔒 Movement Disabled (In Chat)
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Use WASD or Arrow Keys to move. Approach agents and items to interact.
        </p>
      </div>

      {/* Main Game Area */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Map Canvas */}
        <div className="flex-1 relative bg-slate-950 rounded-lg border border-slate-700 overflow-hidden shadow-lg">
          <svg
            width="100%"
            height="100%"
            viewBox={viewBox}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            style={{
              willChange: "transform",
              imageRendering: "pixelated", // Crisp rendering for pixel art
            }}
          >
            {/* Grid background or tile pattern */}
            <defs>
              {/* Define patterns for each tile type */}
              {ASSETS.tileImages &&
                Object.entries(ASSETS.tileImages).map(
                  ([tileType, imageUrl]) => (
                    <pattern
                      key={tileType}
                      id={`tile-${tileType}`}
                      x="0"
                      y="0"
                      width={ASSETS.tileSize || 10}
                      height={ASSETS.tileSize || 10}
                      patternUnits="userSpaceOnUse"
                    >
                      <image
                        href={imageUrl}
                        x="0"
                        y="0"
                        width={ASSETS.tileSize || 10}
                        height={ASSETS.tileSize || 10}
                        preserveAspectRatio="none"
                      />
                    </pattern>
                  )
                )}

              {/* Fallback pattern if using old mapTileUrl */}
              {ASSETS.mapTileUrl && !ASSETS.tileImages && (
                <pattern
                  id="mapTiles"
                  x="0"
                  y="0"
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <image
                    href={ASSETS.mapTileUrl}
                    x="0"
                    y="0"
                    width="10"
                    height="10"
                    preserveAspectRatio="none"
                  />
                </pattern>
              )}

              {/* Grid pattern fallback */}
              <pattern
                id="grid"
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 5 0 L 0 0 0 5"
                  fill="none"
                  stroke="rgba(71, 85, 105, 0.2)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>

            {/* Render tilemap */}
            {ASSETS.tileImages && gameState.tiles.length > 0 ? (
              // Render individual tiles with different types
              gameState.tiles.map((tile, index) => (
                <rect
                  key={`tile-${index}`}
                  x={tile.x * (ASSETS.tileSize || 10)}
                  y={tile.y * (ASSETS.tileSize || 10)}
                  width={ASSETS.tileSize || 10}
                  height={ASSETS.tileSize || 10}
                  fill={`url(#tile-${tile.type})`}
                />
              ))
            ) : (
              // Fallback to single background tile
              <rect
                width={gameState.worldDimensions.width}
                height={gameState.worldDimensions.height}
                fill={ASSETS.mapTileUrl ? "url(#mapTiles)" : "url(#grid)"}
              />
            )}

            {/* World boundary indicator */}
            <rect
              x="0"
              y="0"
              width={gameState.worldDimensions.width}
              height={gameState.worldDimensions.height}
              fill="none"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />

            {/* World Items */}
            {gameState.items.map((item) => {
              const isNearby = gameState.nearbyItems.some(
                (i) => i.id === item.id
              );
              const itemSize = item.size || ASSETS.itemSize || 4;
              const halfSize = itemSize / 2;

              return (
                <g key={item.id}>
                  {/* Highlight nearby interactive items */}
                  {isNearby && item.interactive && (
                    <circle
                      cx={item.position.x}
                      cy={item.position.y}
                      r={itemSize + 1}
                      fill="rgba(251, 191, 36, 0.1)"
                      stroke="rgba(251, 191, 36, 0.5)"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                    />
                  )}

                  {/* Item sprite - animated or static */}
                  {item.spriteSheet ? (
                    <AnimatedSprite
                      spriteSheet={item.spriteSheet}
                      x={item.position.x}
                      y={item.position.y}
                      size={itemSize}
                    />
                  ) : item.imageUrl ? (
                    <image
                      href={item.imageUrl}
                      x={item.position.x - halfSize}
                      y={item.position.y - halfSize}
                      width={itemSize}
                      height={itemSize}
                      opacity={isNearby ? 1 : 0.8}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : (
                    // Fallback to colored square if no image
                    <rect
                      x={item.position.x - halfSize}
                      y={item.position.y - halfSize}
                      width={itemSize}
                      height={itemSize}
                      fill={item.interactive ? "#fbbf24" : "#64748b"}
                      opacity={isNearby ? 1 : 0.6}
                    />
                  )}

                  {/* Item label (only show nearby interactive items) */}
                  {isNearby && item.interactive && (
                    <>
                      <rect
                        x={item.position.x - 8}
                        y={item.position.y + halfSize + 1}
                        width="16"
                        height="3"
                        fill="rgba(0, 0, 0, 0.7)"
                        rx="1"
                        className="pointer-events-none"
                      />
                      <text
                        x={item.position.x}
                        y={item.position.y + halfSize + 3.5}
                        textAnchor="middle"
                        fontSize="1.5"
                        fill="#fbbf24"
                        className="pointer-events-none select-none"
                      >
                        {item.name.length > 8
                          ? item.name.substring(0, 8) + "."
                          : item.name}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Agents */}
            {gameState.agents.map((agent) => {
              const isNearby = gameState.nearbyAgents.some(
                (a) => a.id === agent.id
              );
              const distance = calculateDistance(
                gameState.player.position,
                agent.position
              );

              // Determine which sprite/image to use for this agent
              const agentSpriteSheet =
                agent.spriteSheet || ASSETS.defaultAgentSpriteSheet;
              const agentImageUrl = !agentSpriteSheet
                ? agent.imageUrl || ASSETS.defaultAgentImageUrl
                : null;
              const halfSize = ASSETS.spriteSize / 2;

              return (
                <g key={agent.id}>
                  {/* Selection circle for nearby agents */}
                  {isNearby && (
                    <circle
                      cx={agent.position.x}
                      cy={agent.position.y}
                      r="16"
                      fill="rgba(34, 197, 94, 0.1)"
                      stroke="rgba(34, 197, 94, 0.5)"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                  )}

                  {/* Agent sprite - animated sprite sheet, static image, or circle fallback */}
                  {agentSpriteSheet ? (
                    // Animated sprite sheet
                    <AnimatedSprite
                      spriteSheet={agentSpriteSheet}
                      x={agent.position.x}
                      y={agent.position.y}
                      size={ASSETS.spriteSize}
                    />
                  ) : agentImageUrl ? (
                    // Static image
                    <image
                      href={agentImageUrl}
                      x={agent.position.x - halfSize}
                      y={agent.position.y - halfSize}
                      width={ASSETS.spriteSize}
                      height={ASSETS.spriteSize}
                      opacity={isNearby ? 1 : 0.7}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : (
                    // Fallback to circle if no image or sprite sheet
                    <circle
                      cx={agent.position.x}
                      cy={agent.position.y}
                      r="2"
                      fill={isNearby ? "#22c55e" : "#f97316"}
                      opacity={isNearby ? 1 : 0.6}
                    />
                  )}

                  {/* Agent label (only show nearby) */}
                  {isNearby && (
                    <>
                      {!agentImageUrl && !agentSpriteSheet && (
                        <text
                          x={agent.position.x}
                          y={agent.position.y - 5}
                          textAnchor="middle"
                          fontSize="2.5"
                          fill="#22c55e"
                          className="pointer-events-none select-none font-bold"
                        >
                          {agent.name.charAt(0)}
                        </text>
                      )}
                      <rect
                        x={agent.position.x - 8}
                        y={
                          agent.position.y + (agentImageUrl ? halfSize + 1 : 4)
                        }
                        width="16"
                        height="3"
                        fill="rgba(0, 0, 0, 0.7)"
                        rx="1"
                        className="pointer-events-none"
                      />
                      <text
                        x={agent.position.x}
                        y={
                          agent.position.y +
                          (agentImageUrl ? halfSize + 3.5 : 6.5)
                        }
                        textAnchor="middle"
                        fontSize="1.5"
                        fill="#e2e8f0"
                        className="pointer-events-none select-none"
                      >
                        {agent.name.length > 8
                          ? agent.name.substring(0, 8) + "."
                          : agent.name}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Player */}
            <g>
              {(() => {
                // Priority: spriteAnimations > spriteSheet > imageUrl > default
                const playerSpriteAnimations =
                  gameState.player.spriteAnimations ||
                  ASSETS.defaultPlayerSpriteAnimations;
                const playerSpriteSheet = !playerSpriteAnimations
                  ? gameState.player.spriteSheet ||
                    ASSETS.defaultPlayerSpriteSheet
                  : null;
                const playerImageUrl =
                  !playerSpriteAnimations && !playerSpriteSheet
                    ? gameState.player.imageUrl || ASSETS.defaultPlayerImageUrl
                    : null;
                const halfSize = ASSETS.spriteSize / 2;

                // Determine which sprite sheet to use based on movement state
                const currentSpriteSheet = playerSpriteAnimations
                  ? gameState.player.isMoving
                    ? playerSpriteAnimations.walk
                    : playerSpriteAnimations.idle || playerSpriteAnimations.walk
                  : playerSpriteSheet;

                // Determine if sprite should be flipped (only flip when facing left)
                const flipSprite = !gameState.player.facingRight;

                return currentSpriteSheet ? (
                  // Animated player sprite (with idle/walk support)
                  <>
                    <AnimatedSprite
                      spriteSheet={currentSpriteSheet}
                      x={gameState.player.position.x}
                      y={gameState.player.position.y}
                      size={ASSETS.spriteSize}
                      flipX={flipSprite}
                    />
                    {/* Glow effect around player */}
                    <circle
                      cx={gameState.player.position.x}
                      cy={gameState.player.position.y}
                      r={halfSize + 1}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="0.5"
                      opacity="0.5"
                    />
                  </>
                ) : playerImageUrl ? (
                  // Static player image sprite
                  <>
                    <image
                      href={playerImageUrl}
                      x={gameState.player.position.x - halfSize}
                      y={gameState.player.position.y - halfSize}
                      width={ASSETS.spriteSize}
                      height={ASSETS.spriteSize}
                      style={{ pointerEvents: "none" }}
                      transform={
                        flipSprite
                          ? `scale(-1, 1) translate(${
                              -2 * gameState.player.position.x
                            }, 0)`
                          : undefined
                      }
                    />
                    {/* Glow effect around player */}
                    <circle
                      cx={gameState.player.position.x}
                      cy={gameState.player.position.y}
                      r={halfSize + 1}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="0.5"
                      opacity="0.5"
                    />
                  </>
                ) : (
                  // Fallback to circle
                  <>
                    <circle
                      cx={gameState.player.position.x}
                      cy={gameState.player.position.y}
                      r="2"
                      fill="#3b82f6"
                    />
                    <circle
                      cx={gameState.player.position.x}
                      cy={gameState.player.position.y}
                      r="3.5"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1"
                      opacity="0.5"
                    />
                    <text
                      x={gameState.player.position.x}
                      y={gameState.player.position.y - 5}
                      textAnchor="middle"
                      fontSize="2.5"
                      fill="#3b82f6"
                      className="pointer-events-none select-none font-bold"
                    >
                      P
                    </text>
                  </>
                );
              })()}
            </g>
          </svg>

          {/* Map Info Panel */}
          <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded p-3 text-xs text-slate-300 max-w-xs">
            <div className="font-semibold mb-2 text-white">📊 World Stats</div>
            <div>Total Agents: {gameState.agents.length}</div>
            <div>Nearby: {gameState.nearbyAgents.length}</div>
            <div className="mt-2 text-slate-400">
              Approach agents to interact. Target range: 15 units
            </div>
            <div className="mt-2 text-slate-500 text-[10px]">
              Camera: ({Math.round(cameraOffset.x)},{" "}
              {Math.round(cameraOffset.y)})
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="text-slate-400 text-[10px] mb-1">🎨 Assets:</div>
              <div className="text-[10px] space-y-0.5">
                <div
                  className={
                    ASSETS.mapTileUrl ? "text-green-400" : "text-slate-500"
                  }
                >
                  Map: {ASSETS.mapTileUrl ? "✓ Custom" : "✗ Default Grid"}
                </div>
                <div
                  className={
                    gameState.player.imageUrl || ASSETS.defaultPlayerImageUrl
                      ? "text-green-400"
                      : "text-slate-500"
                  }
                >
                  Player:{" "}
                  {gameState.player.imageUrl || ASSETS.defaultPlayerImageUrl
                    ? "✓ Custom"
                    : "✗ Default Circle"}
                </div>
                <div
                  className={
                    ASSETS.defaultAgentImageUrl
                      ? "text-green-400"
                      : "text-slate-500"
                  }
                >
                  Agents:{" "}
                  {ASSETS.defaultAgentImageUrl
                    ? "✓ Custom"
                    : "✗ Default Circles"}
                </div>
              </div>
            </div>
          </div>

          {/* No Agents Message */}
          {gameState.agents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-lg font-semibold mb-2">📭 No Agents Yet</p>
                <p className="text-sm">
                  Create agents from your backend to see them here
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nearby Agents Panel */}
        <div className="w-64 bg-slate-800 border border-slate-700 rounded-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-900/50">
            <h2 className="font-bold text-white">👥 Nearby NPCs</h2>
            <p className="text-xs text-slate-400 mt-1">
              {gameState.nearbyAgents.length} agent(s) nearby
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {gameState.nearbyAgents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No agents nearby. Move around to find NPCs!
                </p>
              ) : (
                gameState.nearbyAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className={`w-full text-left p-3 rounded border transition-all ${
                      gameState.selectedAgent?.id === agent.id
                        ? "bg-blue-900 border-blue-500"
                        : "bg-slate-700 border-slate-600 hover:bg-slate-600"
                    }`}
                  >
                    <div className="font-semibold text-white">{agent.name}</div>
                    <p className="text-xs text-slate-300 mt-1">
                      {agent.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Distance:{" "}
                      {calculateDistance(
                        gameState.player.position,
                        agent.position
                      ).toFixed(1)}
                      m
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Chat Dialog */}
      <Dialog open={gameState.selectedAgent !== null} onOpenChange={closeChat}>
        <DialogContent className="w-full max-w-3xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                <span className="text-white">Talking to </span>
                <span className="text-orange-400">
                  {gameState.selectedAgent?.name}
                </span>
                {gameState.historicalChatHistory.length > 0 && (
                  <span className="ml-2 text-xs text-slate-400">
                    ({gameState.historicalChatHistory.length} previous messages)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {gameState.chatHistory.length > 0 && (
                  <button
                    onClick={clearChatHistory}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors text-slate-300"
                    title="Clear chat history"
                  >
                    Clear History
                  </button>
                )}
                <button
                  onClick={closeChat}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Agent Info Panel - Balance & Inventory */}
          {gameState.selectedAgent && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
              {/* Balance Section */}
              <div className="bg-slate-800/80 backdrop-blur rounded-lg p-3 border border-emerald-900/50 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">💰</span>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Balance
                  </span>
                </div>
                <div className="text-2xl font-bold text-emerald-400 drop-shadow-lg">
                  {gameState.selectedAgent.balance !== undefined
                    ? `${gameState.selectedAgent.balance.toFixed(2)}`
                    : "0.00"}
                  <span className="text-base text-emerald-500/80 ml-1">
                    $SUI
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  {gameState.selectedAgent.balance !== undefined &&
                  gameState.selectedAgent.balance > 1000 ? (
                    <>
                      <span>💎</span> Wealthy agent
                    </>
                  ) : gameState.selectedAgent.balance !== undefined &&
                    gameState.selectedAgent.balance > 100 ? (
                    <>
                      <span>💵</span> Well-off
                    </>
                  ) : (
                    <>
                      <span>🪙</span> Starting out
                    </>
                  )}
                </div>
              </div>

              {/* Inventory Section */}
              <div className="bg-slate-800/80 backdrop-blur rounded-lg p-3 border border-amber-900/50 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎒</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Inventory
                    </span>
                  </div>
                  {gameState.selectedAgent.inventory &&
                    gameState.selectedAgent.inventory.length > 0 && (
                      <span className="text-xs text-amber-400 font-semibold">
                        {gameState.selectedAgent.inventory.length}
                      </span>
                    )}
                </div>
                <div className="text-sm text-slate-300">
                  {gameState.selectedAgent.inventory &&
                  gameState.selectedAgent.inventory.length > 0 ? (
                    <div className="space-y-1.5 max-h-16 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                      {gameState.selectedAgent.inventory
                        .slice(0, 2)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-xs bg-slate-900/50 rounded px-2 py-1"
                          >
                            <span className="flex items-center gap-1.5">
                              {item.icon && (
                                <span className="text-sm">{item.icon}</span>
                              )}
                              <span
                                className={`truncate max-w-[120px] ${
                                  item.rarity === "legendary"
                                    ? "text-amber-400 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                                    : item.rarity === "epic"
                                    ? "text-purple-400 font-semibold"
                                    : item.rarity === "rare"
                                    ? "text-blue-400"
                                    : "text-slate-300"
                                }`}
                              >
                                {item.name}
                              </span>
                            </span>
                            <span className="text-slate-500 font-mono text-[10px] ml-2">
                              ×{item.quantity}
                            </span>
                          </div>
                        ))}
                      {gameState.selectedAgent.inventory.length > 2 && (
                        <div className="text-xs text-slate-400 text-center pt-1 border-t border-slate-700/50">
                          <span className="text-amber-400">
                            +{gameState.selectedAgent.inventory.length - 2}
                          </span>{" "}
                          more items
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-3 bg-slate-900/30 rounded">
                      📦 Empty inventory
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col h-[32rem] bg-slate-900 rounded border border-slate-700">
            {/* Chat History */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {gameState.chatHistory.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    <p className="text-sm">
                      👋 Start a conversation with{" "}
                      {gameState.selectedAgent?.name}
                    </p>
                  </div>
                ) : (
                  <>
                    {gameState.chatHistory.map((message, idx) => (
                      <div key={idx}>
                        {/* Session divider - show before first new message */}
                        {idx === gameState.currentSessionStart && idx > 0 && (
                          <div className="flex items-center gap-2 my-4">
                            <div className="flex-1 h-px bg-slate-600"></div>
                            <span className="text-xs text-slate-400 px-2">
                              📅 New Session - {new Date().toLocaleDateString()}
                            </span>
                            <div className="flex-1 h-px bg-slate-600"></div>
                          </div>
                        )}

                        <div
                          className={`flex ${
                            message.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.role === "user"
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-slate-700 text-slate-100 rounded-bl-none"
                            } ${
                              idx < gameState.currentSessionStart
                                ? "opacity-70"
                                : ""
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.role === "user"
                                  ? "text-blue-200"
                                  : "text-slate-400"
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                              {idx < gameState.currentSessionStart && (
                                <span className="ml-1 text-[10px]">
                                  (Previous)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {gameState.isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 text-slate-100 px-4 py-2 rounded-lg rounded-bl-none">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <ChatInput
              onSendMessage={sendMessage}
              isLoading={gameState.isLoading}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Chat Input Component
interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-slate-700 flex gap-2 bg-slate-800">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Say something..."
        disabled={isLoading}
        className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
      />
      <Button
        onClick={handleSend}
        disabled={isLoading || !input.trim()}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? (
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-white rounded-full animate-bounce" />
            <div
              className="w-1 h-1 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            />
            <div
              className="w-1 h-1 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
          </div>
        ) : (
          <>
            <Send size={16} className="mr-2" />
            Send
          </>
        )}
      </Button>
    </div>
  );
}
