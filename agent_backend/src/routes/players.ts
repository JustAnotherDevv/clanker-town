import { Router, Request, Response } from "express";
import {
  ElasticsearchService,
  PlayerData,
} from "../services/ElasticSearchService";
import { WorldContextServiceExtended } from "../services/WorldContextService";
import { Position } from "../services/GameWorld";
import { v4 as uuidv4 } from "uuid";

export function createPlayerRoutes(
  esService: ElasticsearchService,
  contextService?: WorldContextServiceExtended
): Router {
  const router = Router();

  router.post("/players", async (req: Request, res: Response) => {
    try {
      const { name, position, metadata } = req.body;

      const player: PlayerData = {
        id: uuidv4(),
        name: name || "Player",
        position: position || { x: 50, y: 50 },
        inventory: [],
        collectedItems: [],
        lastActive: new Date(),
        metadata: metadata || {},
      };

      await esService.savePlayer(player);

      res.status(201).json({
        success: true,
        player,
      });
    } catch (error) {
      console.error("Error creating player:", error);
      res.status(500).json({
        error: "Failed to create player",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.get("/players/:playerId", async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const player = await esService.getPlayer(playerId);

      if (!player) {
        return res.status(404).json({
          error: "Player not found",
        });
      }

      res.json({
        success: true,
        player,
      });
    } catch (error) {
      console.error("Error getting player:", error);
      res.status(500).json({
        error: "Failed to get player",
      });
    }
  });

  router.get("/players", async (req: Request, res: Response) => {
    try {
      const players = await esService.getAllPlayers();

      res.json({
        success: true,
        count: players.length,
        players,
      });
    } catch (error) {
      console.error("Error getting players:", error);
      res.status(500).json({
        error: "Failed to get players",
      });
    }
  });

  router.get(
    "/players/:playerId/context",
    async (req: Request, res: Response) => {
      try {
        const { playerId } = req.params;
        const { range } = req.query;

        if (!contextService) {
          return res.status(503).json({
            error: "Context service not available",
          });
        }

        const visibleRange = range ? parseInt(range as string) : 30;
        const context = await contextService.getPlayerVisibleContext(
          playerId,
          visibleRange
        );

        res.json({
          success: true,
          playerId,
          visibleRange,
          context,
        });
      } catch (error) {
        console.error("Error getting player context:", error);
        res.status(500).json({
          error: "Failed to get player context",
        });
      }
    }
  );

  router.patch(
    "/players/:playerId/position",
    async (req: Request, res: Response) => {
      try {
        const { playerId } = req.params;
        const { x, y } = req.body;

        if (x === undefined || y === undefined) {
          return res.status(400).json({
            error: "Missing required fields: x, y",
          });
        }

        const position: Position = { x, y };
        await esService.updatePlayerPosition(playerId, position);

        const player = await esService.getPlayer(playerId);

        if (!player) {
          return res.status(404).json({
            error: "Player not found",
          });
        }

        let context = null;
        if (contextService) {
          context = await contextService.getPlayerVisibleContext(playerId, 30);
        }

        res.json({
          success: true,
          player,
          context,
        });
      } catch (error) {
        console.error("Error updating player position:", error);
        res.status(500).json({
          error: "Failed to update player position",
        });
      }
    }
  );

  router.patch("/players/:playerId", async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const updates = req.body;

      const player = await esService.getPlayer(playerId);

      if (!player) {
        return res.status(404).json({
          error: "Player not found",
        });
      }

      const updatedPlayer: PlayerData = {
        ...player,
        ...updates,
        id: playerId,
        lastActive: new Date(),
      };

      await esService.savePlayer(updatedPlayer);

      res.json({
        success: true,
        player: updatedPlayer,
      });
    } catch (error) {
      console.error("Error updating player:", error);
      res.status(500).json({
        error: "Failed to update player",
      });
    }
  });

  router.get(
    "/players/:playerId/inventory",
    async (req: Request, res: Response) => {
      try {
        const { playerId } = req.params;
        const player = await esService.getPlayer(playerId);

        if (!player) {
          return res.status(404).json({
            error: "Player not found",
          });
        }

        res.json({
          success: true,
          playerId: player.id,
          inventory: player.inventory || [],
          collectedItems: player.collectedItems || [],
        });
      } catch (error) {
        console.error("Error getting player inventory:", error);
        res.status(500).json({
          error: "Failed to get player inventory",
        });
      }
    }
  );

  return router;
}
