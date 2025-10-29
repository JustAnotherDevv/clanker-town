import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { LettaClient } from "./services/LettaClient";
import { GameWorld } from "./services/GameWorld";
import { ElasticsearchService } from "./services/ElasticSearchService";
import { WorldContextServiceExtended } from "./services/WorldContextService";
import { SuiGameService } from "./services/SuiGameService";
import { createAgentRoutesExtended } from "./routes/agents";
import { createWorldRoutes } from "./routes/world";
import { createPlayerRoutes } from "./routes/players";
import { createSuiGameRoutes } from "./routes/suiGame";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const LETTA_API_KEY = process.env.LETTA_API_KEY;
const LETTA_API_BASE_URL =
  process.env.LETTA_API_BASE_URL || "https://api.letta.com";
const WORLD_WIDTH = parseInt(process.env.WORLD_WIDTH || "100");
const WORLD_HEIGHT = parseInt(process.env.WORLD_HEIGHT || "100");
const ELASTICSEARCH_NODE =
  process.env.ELASTICSEARCH_NODE || "http://localhost:9200";
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;
const ELASTICSEARCH_CLOUD_ID = process.env.ELASTICSEARCH_CLOUD_ID;
const ENABLE_PERSISTENCE =
  process.env.ENABLE_PERSISTENCE?.toLowerCase() !== "false";

const SUI_NETWORK = (process.env.SUI_NETWORK || "testnet") as
  | "devnet"
  | "testnet"
  | "mainnet";

if (!LETTA_API_KEY) {
  console.error("Error: LETTA_API_KEY environment variable is not set");
  process.exit(1);
}

if (!process.env.SUI_PACKAGE_ID) {
  console.error("Error: SUI_PACKAGE_ID environment variable is not set");
  process.exit(1);
}

const SUI_PACKAGE_ID: string = process.env.SUI_PACKAGE_ID;

const suiClient = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

app.use(express.json());
app.use(cors());

let esService: ElasticsearchService | undefined;
let gameWorld: GameWorld;
let worldContextService: WorldContextServiceExtended;
let suiGameService: SuiGameService;
const lettaClient = new LettaClient(LETTA_API_KEY, LETTA_API_BASE_URL);

async function initializeServices() {
  try {
    if (ENABLE_PERSISTENCE) {
      esService = new ElasticsearchService(
        ELASTICSEARCH_NODE,
        ELASTICSEARCH_API_KEY,
        ELASTICSEARCH_CLOUD_ID
      );

      const isConnected = await esService.ping();
      if (!isConnected) {
        esService = undefined;
      } else {
        await esService.initialize();
      }
    }

    gameWorld = new GameWorld(WORLD_WIDTH, WORLD_HEIGHT, esService);
    await gameWorld.initialize();

    suiGameService = new SuiGameService(
      suiClient,
      SUI_PACKAGE_ID,
      gameWorld,
      esService
    );

    worldContextService = new WorldContextServiceExtended(
      gameWorld,
      esService,
      suiGameService
    );

    app.use("/api", createWorldRoutes(gameWorld));
    app.use(
      "/api",
      createAgentRoutesExtended(
        lettaClient,
        gameWorld,
        worldContextService,
        suiClient,
        suiGameService
      )
    );
    app.use("/api", createSuiGameRoutes(suiGameService, gameWorld));

    if (esService) {
      app.use("/api", createPlayerRoutes(esService, worldContextService));
    }

    app.get("/health", async (req, res) => {
      const esConnected = esService ? await esService.ping() : false;

      let suiConnected = false;
      try {
        await suiClient.getLatestCheckpointSequenceNumber();
        suiConnected = true;
      } catch (e) {}

      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        persistence: {
          enabled: ENABLE_PERSISTENCE,
          elasticsearch: esConnected ? "connected" : "disconnected",
        },
        network: {
          sui: {
            network: SUI_NETWORK,
            connected: suiConnected,
            packageId: SUI_PACKAGE_ID,
          },
        },
        game: {
          currentGameId: suiGameService.getCurrentGameId(),
        },
        features: {
          worldContext: true,
          agentAwareness: true,
          resourceGame: true,
          generators: true,
          trading: true,
        },
      });
    });

    app.get("/", (req, res) => {
      res.json({
        name: "Letta RPG Backend with Sui Resource Game",
        version: "2.0.0",
        persistence: {
          enabled: ENABLE_PERSISTENCE,
          elasticsearch: !!esService,
        },
        network: {
          sui: {
            network: SUI_NETWORK,
            packageId: SUI_PACKAGE_ID,
          },
        },
        game: {
          currentGameId: suiGameService.getCurrentGameId(),
        },
        features: {
          worldContext: "Agents have awareness of their surroundings",
          agentAwareness: "Agents know about nearby players, items, and NPCs",
          agentWallets: "Agents have their own Sui wallets",
          resourceGame: "Blockchain-based resource management game",
          generators: "Resource generators on the map",
          trading: "P2P trading between agents and players",
          aiDecisions: "AI agents make autonomous decisions",
        },
        documentation: {
          world: "GET /api/world",
          health: "GET /health",
          getGame: "GET /api/game",
          createGame: "POST /api/game",
          syncGenerators: "POST /api/game/sync",
          getGenerators: "GET /api/game/generators",
          getNearbyGenerators:
            "GET /api/game/generators/nearby?x=0&y=0&range=20",
          createGenerators: "POST /api/game/generators",
          claimGenerator: "POST /api/game/generators/:generatorId/claim",
          recaptureGenerator:
            "POST /api/game/generators/:generatorId/recapture",
          claimResources:
            "POST /api/game/generators/:generatorId/claim-resources",
          getPlayerResources: "GET /api/game/resources/:address",
          getTrades: "GET /api/game/trades",
          getAgentTrades: "GET /api/game/trades/agent/:address",
          proposeTrade: "POST /api/game/trades",
          acceptTrade: "POST /api/game/trades/:proposalId/accept",
          cancelTrade: "POST /api/game/trades/:proposalId/cancel",
          createAgent: "POST /api/agents",
          getAgents: "GET /api/agents",
          nearbyAgents: "GET /api/agents/nearby?x=0&y=0&range=20",
          chatWithAgent: "POST /api/agents/:agentId/chat",
          getAgentContext: "GET /api/agents/:agentId/context",
          updatePosition: "PATCH /api/agents/:agentId/position",
          agentClaimGenerator:
            "POST /api/agents/:agentId/actions/claim-generator",
          agentClaimResources:
            "POST /api/agents/:agentId/actions/claim-resources",
          agentRecaptureGenerator:
            "POST /api/agents/:agentId/actions/recapture-generator",
          agentProposeTrade: "POST /api/agents/:agentId/actions/propose-trade",
          agentAcceptTrade: "POST /api/agents/:agentId/actions/accept-trade",
          agentRefuseTrade: "POST /api/agents/:agentId/actions/refuse-trade",
          players: "GET /api/players",
          createPlayer: "POST /api/players",
          getPlayer: "GET /api/players/:playerId",
          updatePlayerPosition: "PATCH /api/players/:playerId/position",
          getPlayerContext: "GET /api/players/:playerId/context",
        },
      });
    });

    if (esService) {
      app.post("/api/admin/clear-data", async (req, res) => {
        try {
          if (!esService) {
            return res.status(400).json({
              error: "Persistence is not enabled",
            });
          }

          await esService.clearAllData();
          await gameWorld.initialize();

          res.json({
            success: true,
            message: "All data cleared and world reinitialized",
          });
        } catch (error) {
          console.error("Error clearing data:", error);
          res.status(500).json({
            error: "Failed to clear data",
          });
        }
      });
    }

    app.post("/api/admin/set-game", async (req, res) => {
      try {
        const { gameId } = req.body;

        if (!gameId) {
          return res.status(400).json({
            error: "Missing required field: gameId",
          });
        }

        suiGameService.setCurrentGame(gameId);

        await suiGameService.syncGeneratorsToWorld();

        res.json({
          success: true,
          message: "Active game set and generators synced",
          gameId,
        });
      } catch (error) {
        console.error("Error setting game:", error);
        res.status(500).json({
          error: "Failed to set game",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error("Error:", err);
        res.status(500).json({
          error: "Internal server error",
          message: err.message,
        });
      }
    );

    app.use((req, res) => {
      res.status(404).json({
        error: "Not found",
        path: req.path,
      });
    });

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Fatal error during initialization:", error);
    process.exit(1);
  }
}

initializeServices().catch((error) => {
  console.error("Failed to initialize services:", error);
  process.exit(1);
});

export {
  lettaClient,
  gameWorld,
  esService,
  worldContextService,
  suiClient,
  suiGameService,
};
