import { Router, Request, Response } from "express";
import { SuiGameService } from "../services/SuiGameService";
import { GameWorld } from "../services/GameWorld";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "@mysten/sui.js/utils";

export function createSuiGameRoutes(
  suiGameService: SuiGameService,
  gameWorld: GameWorld
): Router {
  const router = Router();

  /**
   * Get current game info
   */
  router.get("/game", async (req: Request, res: Response) => {
    try {
      const gameId = suiGameService.getCurrentGameId();

      if (!gameId) {
        return res.status(404).json({
          error: "No active game",
          message: "Please create a game first",
        });
      }

      const gameInfo = await suiGameService.getGameMatch(gameId);

      res.json({
        success: true,
        gameId,
        game: gameInfo,
      });
    } catch (error) {
      console.error("Error getting game info:", error);
      res.status(500).json({
        error: "Failed to get game info",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Create a new game
   */
  router.post("/game", async (req: Request, res: Response) => {
    try {
      const { creatorPrivateKey, participants, initialResources } = req.body;

      if (!creatorPrivateKey || !participants) {
        return res.status(400).json({
          error: "Missing required fields: creatorPrivateKey, participants",
        });
      }

      const keypair = Ed25519Keypair.fromSecretKey(fromB64(creatorPrivateKey));

      const gameId = await suiGameService.createMatch(
        keypair,
        participants,
        initialResources?.wood || 100,
        initialResources?.stone || 100,
        initialResources?.emerald || 50
      );

      res.status(201).json({
        success: true,
        gameId,
        message: "Game created successfully",
      });
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({
        error: "Failed to create game",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Create generators
   */
  router.post("/game/generators", async (req: Request, res: Response) => {
    try {
      const { creatorPrivateKey, resourceType, positions } = req.body;
      const gameId = suiGameService.getCurrentGameId();

      if (!gameId) {
        return res.status(404).json({
          error: "No active game",
        });
      }

      if (!creatorPrivateKey || resourceType === undefined || !positions) {
        return res.status(400).json({
          error:
            "Missing required fields: creatorPrivateKey, resourceType, positions",
        });
      }

      const keypair = Ed25519Keypair.fromSecretKey(fromB64(creatorPrivateKey));

      const generatorIds = await suiGameService.createGenerators(
        keypair,
        gameId,
        resourceType,
        positions
      );

      res.status(201).json({
        success: true,
        generatorIds,
        count: generatorIds.length,
        message: "Generators created successfully",
      });
    } catch (error) {
      console.error("Error creating generators:", error);
      res.status(500).json({
        error: "Failed to create generators",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get all generators
   */
  router.get("/game/generators", async (req: Request, res: Response) => {
    try {
      const gameId = suiGameService.getCurrentGameId();

      if (!gameId) {
        return res.status(404).json({
          error: "No active game",
        });
      }

      const generators = await suiGameService.getAllGenerators(gameId);

      res.json({
        success: true,
        count: generators.length,
        generators,
      });
    } catch (error) {
      console.error("Error getting generators:", error);
      res.status(500).json({
        error: "Failed to get generators",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get generators near a position
   */
  router.get("/game/generators/nearby", async (req: Request, res: Response) => {
    try {
      const { x, y, range } = req.query;
      const gameId = suiGameService.getCurrentGameId();

      if (!gameId) {
        return res.status(404).json({
          error: "No active game",
        });
      }

      if (x === undefined || y === undefined) {
        return res.status(400).json({
          error: "Missing required query parameters: x, y",
        });
      }

      const position = {
        x: parseFloat(x as string),
        y: parseFloat(y as string),
      };
      const rangeNum = range ? parseFloat(range as string) : 20;

      const generators = await suiGameService.getGeneratorsNearPosition(
        gameId,
        position,
        rangeNum
      );

      res.json({
        success: true,
        count: generators.length,
        generators,
      });
    } catch (error) {
      console.error("Error getting nearby generators:", error);
      res.status(500).json({
        error: "Failed to get nearby generators",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Claim a generator
   */
  router.post(
    "/game/generators/:generatorId/claim",
    async (req: Request, res: Response) => {
      try {
        const { generatorId } = req.params;
        const { claimerPrivateKey } = req.body;
        const gameId = suiGameService.getCurrentGameId();

        if (!gameId) {
          return res.status(404).json({
            error: "No active game",
          });
        }

        if (!claimerPrivateKey) {
          return res.status(400).json({
            error: "Missing required field: claimerPrivateKey",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(claimerPrivateKey)
        );

        await suiGameService.claimGenerator(keypair, gameId, generatorId);

        res.json({
          success: true,
          message: "Generator claimed successfully",
        });
      } catch (error) {
        console.error("Error claiming generator:", error);
        res.status(500).json({
          error: "Failed to claim generator",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Recapture a generator
   */
  router.post(
    "/game/generators/:generatorId/recapture",
    async (req: Request, res: Response) => {
      try {
        const { generatorId } = req.params;
        const { attackerPrivateKey, attackerResourcesId } = req.body;
        const gameId = suiGameService.getCurrentGameId();

        if (!gameId) {
          return res.status(404).json({
            error: "No active game",
          });
        }

        if (!attackerPrivateKey || !attackerResourcesId) {
          return res.status(400).json({
            error:
              "Missing required fields: attackerPrivateKey, attackerResourcesId",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(attackerPrivateKey)
        );

        await suiGameService.recaptureGenerator(
          keypair,
          gameId,
          generatorId,
          attackerResourcesId
        );

        res.json({
          success: true,
          message: "Generator recaptured successfully",
        });
      } catch (error) {
        console.error("Error recapturing generator:", error);
        res.status(500).json({
          error: "Failed to recapture generator",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Claim resources from generator
   */
  router.post(
    "/game/generators/:generatorId/claim-resources",
    async (req: Request, res: Response) => {
      try {
        const { generatorId } = req.params;
        const { ownerPrivateKey, playerResourcesId } = req.body;

        if (!ownerPrivateKey || !playerResourcesId) {
          return res.status(400).json({
            error:
              "Missing required fields: ownerPrivateKey, playerResourcesId",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(fromB64(ownerPrivateKey));

        await suiGameService.claimResources(
          keypair,
          generatorId,
          playerResourcesId
        );

        res.json({
          success: true,
          message: "Resources claimed successfully",
        });
      } catch (error) {
        console.error("Error claiming resources:", error);
        res.status(500).json({
          error: "Failed to claim resources",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Get player resources
   */
  router.get(
    "/game/resources/:address",
    async (req: Request, res: Response) => {
      try {
        const { address } = req.params;

        const resources = await suiGameService.getPlayerResources(address);

        if (!resources) {
          return res.status(404).json({
            error: "No resources found for this address",
          });
        }

        res.json({
          success: true,
          resources,
        });
      } catch (error) {
        console.error("Error getting player resources:", error);
        res.status(500).json({
          error: "Failed to get player resources",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Get all trade proposals
   */
  router.get("/game/trades", async (req: Request, res: Response) => {
    try {
      const proposals = await suiGameService.getAllTradeProposals();

      res.json({
        success: true,
        count: proposals.length,
        proposals,
      });
    } catch (error) {
      console.error("Error getting trade proposals:", error);
      res.status(500).json({
        error: "Failed to get trade proposals",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get trades for specific agent
   */
  router.get(
    "/game/trades/agent/:address",
    async (req: Request, res: Response) => {
      try {
        const { address } = req.params;

        const proposals = await suiGameService.getTradeProposalsForAgent(
          address
        );

        res.json({
          success: true,
          count: proposals.length,
          proposals,
        });
      } catch (error) {
        console.error("Error getting agent trades:", error);
        res.status(500).json({
          error: "Failed to get agent trades",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Propose a trade
   */
  router.post("/game/trades", async (req: Request, res: Response) => {
    try {
      const {
        proposerPrivateKey,
        proposerResourcesId,
        targetAddress,
        offer,
        request,
      } = req.body;
      const gameId = suiGameService.getCurrentGameId();

      if (!gameId) {
        return res.status(404).json({
          error: "No active game",
        });
      }

      if (
        !proposerPrivateKey ||
        !proposerResourcesId ||
        !targetAddress ||
        !offer ||
        !request
      ) {
        return res.status(400).json({
          error:
            "Missing required fields: proposerPrivateKey, proposerResourcesId, targetAddress, offer, request",
        });
      }

      const keypair = Ed25519Keypair.fromSecretKey(fromB64(proposerPrivateKey));

      const proposalId = await suiGameService.proposeTrade(
        keypair,
        gameId,
        proposerResourcesId,
        targetAddress,
        offer,
        request
      );

      res.status(201).json({
        success: true,
        proposalId,
        message: "Trade proposed successfully",
      });
    } catch (error) {
      console.error("Error proposing trade:", error);
      res.status(500).json({
        error: "Failed to propose trade",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Accept a trade
   */
  router.post(
    "/game/trades/:proposalId/accept",
    async (req: Request, res: Response) => {
      try {
        const { proposalId } = req.params;
        const { accepterPrivateKey, proposerResourcesId, accepterResourcesId } =
          req.body;

        if (
          !accepterPrivateKey ||
          !proposerResourcesId ||
          !accepterResourcesId
        ) {
          return res.status(400).json({
            error:
              "Missing required fields: accepterPrivateKey, proposerResourcesId, accepterResourcesId",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(accepterPrivateKey)
        );

        await suiGameService.acceptTrade(
          keypair,
          proposalId,
          proposerResourcesId,
          accepterResourcesId
        );

        res.json({
          success: true,
          message: "Trade accepted successfully",
        });
      } catch (error) {
        console.error("Error accepting trade:", error);
        res.status(500).json({
          error: "Failed to accept trade",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Cancel a trade
   */
  router.post(
    "/game/trades/:proposalId/cancel",
    async (req: Request, res: Response) => {
      try {
        const { proposalId } = req.params;
        const { cancellerPrivateKey } = req.body;

        if (!cancellerPrivateKey) {
          return res.status(400).json({
            error: "Missing required field: cancellerPrivateKey",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(cancellerPrivateKey)
        );

        await suiGameService.cancelTrade(keypair, proposalId);

        res.json({
          success: true,
          message: "Trade cancelled successfully",
        });
      } catch (error) {
        console.error("Error cancelling trade:", error);
        res.status(500).json({
          error: "Failed to cancel trade",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Sync generators to world
   */
  router.post("/game/sync", async (req: Request, res: Response) => {
    try {
      await suiGameService.syncGeneratorsToWorld();

      res.json({
        success: true,
        message: "Generators synced to world successfully",
      });
    } catch (error) {
      console.error("Error syncing generators:", error);
      res.status(500).json({
        error: "Failed to sync generators",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
