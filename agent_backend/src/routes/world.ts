import { Router, Request, Response } from "express";
import { GameWorld } from "../services/GameWorld";

export function createWorldRoutes(gameWorld: GameWorld): Router {
  const router = Router();

  /**
   * Get world information
   */
  router.get("/world", (req: Request, res: Response) => {
    try {
      const dimensions = gameWorld.getWorldDimensions();
      const agents = gameWorld.getAllAgents();
      const items = gameWorld.getAllItems();
      const tiles = gameWorld.getAllTiles();

      res.json({
        success: true,
        world: {
          dimensions,
          tileSize: gameWorld.getTileSize(),
          agentCount: agents.length,
          itemCount: items.length,
          tileCount: tiles.length,
          agents,
          items,
          tiles,
        },
      });
    } catch (error) {
      console.error("Error getting world info:", error);
      res.status(500).json({
        error: "Failed to get world information",
      });
    }
  });

  /**
   * Get world dimensions
   */
  router.get("/world/dimensions", (req: Request, res: Response) => {
    try {
      const dimensions = gameWorld.getWorldDimensions();

      res.json({
        success: true,
        dimensions,
        tileSize: gameWorld.getTileSize(),
      });
    } catch (error) {
      console.error("Error getting world dimensions:", error);
      res.status(500).json({
        error: "Failed to get world dimensions",
      });
    }
  });

  /**
   * Get world tilemap
   */
  router.get("/world/tilemap", (req: Request, res: Response) => {
    try {
      const tiles = gameWorld.getAllTiles();

      res.json({
        success: true,
        tileSize: gameWorld.getTileSize(),
        count: tiles.length,
        tiles,
      });
    } catch (error) {
      console.error("Error getting tilemap:", error);
      res.status(500).json({
        error: "Failed to get tilemap",
      });
    }
  });

  /**
   * Get world items
   */
  router.get("/world/items", (req: Request, res: Response) => {
    try {
      const items = gameWorld.getAllItems();

      res.json({
        success: true,
        count: items.length,
        items,
      });
    } catch (error) {
      console.error("Error getting items:", error);
      res.status(500).json({
        error: "Failed to get items",
      });
    }
  });

  /**
   * Get a specific item
   */
  router.get("/world/items/:itemId", (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const item = gameWorld.getItem(itemId);

      if (!item) {
        return res.status(404).json({
          error: "Item not found",
        });
      }

      res.json({
        success: true,
        item,
      });
    } catch (error) {
      console.error("Error getting item:", error);
      res.status(500).json({
        error: "Failed to get item",
      });
    }
  });

  /**
   * Get items near a position
   */
  router.get("/world/items/nearby", (req: Request, res: Response) => {
    try {
      const { x, y, range } = req.query;

      if (x === undefined || y === undefined) {
        return res.status(400).json({
          error: "Missing required query parameters: x, y",
        });
      }

      const position = {
        x: parseFloat(x as string),
        y: parseFloat(y as string),
      };

      const rangeNum = range ? parseFloat(range as string) : 10;
      const nearbyItems = gameWorld.getItemsInRange(position, rangeNum);

      res.json({
        success: true,
        count: nearbyItems.length,
        items: nearbyItems,
      });
    } catch (error) {
      console.error("Error getting nearby items:", error);
      res.status(500).json({
        error: "Failed to get nearby items",
      });
    }
  });

  /**
   * Add a new item to the world
   */
  router.post("/world/items", (req: Request, res: Response) => {
    try {
      const {
        name,
        position,
        imageUrl,
        spriteSheet,
        size,
        interactive,
        description,
      } = req.body;

      if (!name || !position || (!imageUrl && !spriteSheet)) {
        return res.status(400).json({
          error:
            "Missing required fields: name, position, and either imageUrl or spriteSheet",
        });
      }

      const newItem = gameWorld.addItem({
        name,
        position,
        imageUrl,
        spriteSheet,
        size,
        interactive,
        description,
      });

      res.status(201).json({
        success: true,
        item: newItem,
      });
    } catch (error) {
      console.error("Error adding item:", error);
      res.status(500).json({
        error: "Failed to add item",
      });
    }
  });

  /**
   * Delete an item from the world
   */
  router.delete("/world/items/:itemId", (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const deleted = gameWorld.removeItem(itemId);

      if (!deleted) {
        return res.status(404).json({
          error: "Item not found",
        });
      }

      res.json({
        success: true,
        message: "Item deleted",
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({
        error: "Failed to delete item",
      });
    }
  });

  /**
   * Collect an item (mark as collected by player)
   */
  router.post("/world/items/:itemId/collect", (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({
          error: "Missing required field: playerId",
        });
      }

      const item = gameWorld.getItem(itemId);

      if (!item) {
        return res.status(404).json({
          error: "Item not found",
        });
      }

      if (!item.interactive) {
        return res.status(400).json({
          error: "Item is not interactive",
        });
      }

      if (item.collectedBy) {
        return res.status(400).json({
          error: "Item already collected",
        });
      }

      const collectedItem = gameWorld.collectItem(itemId, playerId);

      res.json({
        success: true,
        message: `Collected ${item.name}!`,
        item: collectedItem,
      });
    } catch (error) {
      console.error("Error collecting item:", error);
      res.status(500).json({
        error: "Failed to collect item",
      });
    }
  });

  return router;
}
