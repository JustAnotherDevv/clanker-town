import { Router, Request, Response } from "express";
import { LettaClient } from "../services/LettaClient";
import { GameWorld, Position } from "../services/GameWorld";
import { WorldContextServiceExtended } from "../services/WorldContextService";
import { SuiClient } from "@mysten/sui.js/client";
import { SuiGameService } from "../services/SuiGameService";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "@mysten/sui.js/utils";
import { v4 as uuidv4 } from "uuid";

export function createAgentRoutesExtended(
  lettaClient: LettaClient,
  gameWorld: GameWorld,
  contextService: WorldContextServiceExtended,
  suiClient: SuiClient,
  suiGameService: SuiGameService
): Router {
  const router = Router();

  router.post("/agents", async (req: Request, res: Response) => {
    try {
      const { name, description, position, persona } = req.body;

      if (!name || !description) {
        return res.status(400).json({
          error: "Missing required fields: name, description",
        });
      }

      const keypair = new Ed25519Keypair();
      const suiAddress = keypair.getPublicKey().toSuiAddress();
      const suiPublicKey = keypair.getPublicKey().toBase64();
      const suiPrivateKey = keypair.export().privateKey;

      const personaDescription =
        persona ||
        `${description}. You are an AI agent in a resource management game on the Sui blockchain. You have your own Sui wallet and can claim generators, collect resources, and trade with other players and agents. You should act strategically to maximize your resources while building beneficial relationships.`;

      const lettaAgent = await lettaClient.createAgent({
        name,
        personaDescription,
        humanDescription:
          "A player or agent in the resource game world who you can interact with.",
      });

      const gameAgent = await gameWorld.addAgent(
        lettaAgent.id,
        name,
        description,
        suiAddress,
        suiPublicKey,
        suiPrivateKey,
        position
      );

      res.status(201).json({
        success: true,
        agent: {
          id: gameAgent.id,
          lettaAgentId: lettaAgent.id,
          name: gameAgent.name,
          description: gameAgent.description,
          position: gameAgent.position,
          suiAddress: gameAgent.suiAddress,
          createdAt: gameAgent.createdAt,
        },
        message: "Agent created successfully with Sui wallet",
      });
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({
        error: "Failed to create agent",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.post("/agents/:agentId/chat", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { message, playerId } = req.body;

      if (!message) {
        return res.status(400).json({
          error: "Missing required field: message",
        });
      }

      const agent = gameWorld.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({
          error: "Agent not found",
        });
      }

      const context = await contextService.generateAgentContext(agent, 30);

      const response = await lettaClient.sendMessageWithContext(
        agent.lettaAgentId,
        message,
        context.fullContext
      );

      res.json({
        success: true,
        agentId: agent.id,
        lettaAgentId: agent.lettaAgentId,
        response,
      });
    } catch (error) {
      console.error("Error chatting with agent:", error);
      res.status(500).json({
        error: "Failed to chat with agent",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.get(
    "/agents/:agentId/context",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { range } = req.query;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        const contextRange = range ? parseInt(range as string) : 30;
        const context = await contextService.generateAgentContext(
          agent,
          contextRange
        );

        res.json({
          success: true,
          agentId: agent.id,
          context,
        });
      } catch (error) {
        console.error("Error getting agent context:", error);
        res.status(500).json({
          error: "Failed to get agent context",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.post(
    "/agents/:agentId/actions/claim-generator",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { generatorId } = req.body;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        const gameId = suiGameService.getCurrentGameId();
        if (!gameId) {
          return res.status(400).json({
            error: "No active game",
          });
        }

        if (!generatorId) {
          return res.status(400).json({
            error: "Missing required field: generatorId",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(agent.suiPrivateKey)
        );

        await suiGameService.claimGenerator(keypair, gameId, generatorId);

        res.json({
          success: true,
          message: `Agent ${agent.name} successfully claimed generator`,
          generatorId,
        });
      } catch (error) {
        console.error("Error agent claiming generator:", error);
        res.status(500).json({
          error: "Failed to claim generator",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.post(
    "/agents/:agentId/actions/claim-resources",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { generatorId } = req.body;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        if (!generatorId) {
          return res.status(400).json({
            error: "Missing required field: generatorId",
          });
        }

        const resources = await suiGameService.getPlayerResources(
          agent.suiAddress
        );
        if (!resources) {
          return res.status(400).json({
            error: "Agent doesn't have resources initialized",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(agent.suiPrivateKey)
        );

        await suiGameService.claimResources(
          keypair,
          generatorId,
          resources.objectId
        );

        res.json({
          success: true,
          message: `Agent ${agent.name} successfully claimed resources`,
          generatorId,
        });
      } catch (error) {
        console.error("Error agent claiming resources:", error);
        res.status(500).json({
          error: "Failed to claim resources",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.post(
    "/agents/:agentId/actions/recapture-generator",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { generatorId, reason } = req.body;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        const gameId = suiGameService.getCurrentGameId();
        if (!gameId) {
          return res.status(400).json({
            error: "No active game",
          });
        }

        if (!generatorId) {
          return res.status(400).json({
            error: "Missing required field: generatorId",
          });
        }

        const resources = await suiGameService.getPlayerResources(
          agent.suiAddress
        );
        if (!resources) {
          return res.status(400).json({
            error: "Agent doesn't have resources initialized",
          });
        }

        const memoryBlocks = await lettaClient.getMemoryBlocks(
          agent.lettaAgentId
        );
        const humanMemory =
          memoryBlocks.find((b: any) => b.label === "human")?.value || "";

        const shouldRecapture = suiGameService.shouldRecaptureGenerator(
          (await suiGameService
            .getAllGenerators(gameId)
            .then((gens) =>
              gens.find((g) => g.objectId === generatorId)
            )) as any,
          agent.suiAddress,
          humanMemory
        );

        if (!shouldRecapture && !reason) {
          return res.status(400).json({
            error:
              "Recapture not justified. Agent memory doesn't indicate hostility with generator owner. Provide a 'reason' to override.",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(agent.suiPrivateKey)
        );

        await suiGameService.recaptureGenerator(
          keypair,
          gameId,
          generatorId,
          resources.objectId
        );

        res.json({
          success: true,
          message: `Agent ${agent.name} successfully recaptured generator`,
          generatorId,
          reason: reason || "Hostile relationship detected",
        });
      } catch (error) {
        console.error("Error agent recapturing generator:", error);
        res.status(500).json({
          error: "Failed to recapture generator",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.post(
    "/agents/:agentId/actions/propose-trade",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { targetAddress, offer, request, reasoning } = req.body;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        const gameId = suiGameService.getCurrentGameId();
        if (!gameId) {
          return res.status(400).json({
            error: "No active game",
          });
        }

        if (!targetAddress || !offer || !request) {
          return res.status(400).json({
            error: "Missing required fields: targetAddress, offer, request",
          });
        }

        const resources = await suiGameService.getPlayerResources(
          agent.suiAddress
        );
        if (!resources) {
          return res.status(400).json({
            error: "Agent doesn't have resources initialized",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(agent.suiPrivateKey)
        );

        const proposalId = await suiGameService.proposeTrade(
          keypair,
          gameId,
          resources.objectId,
          targetAddress,
          offer,
          request
        );

        res.json({
          success: true,
          message: `Agent ${agent.name} proposed trade`,
          proposalId,
          reasoning: reasoning || "Trade proposal sent",
        });
      } catch (error) {
        console.error("Error agent proposing trade:", error);
        res.status(500).json({
          error: "Failed to propose trade",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.post(
    "/agents/:agentId/actions/accept-trade",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { proposalId, reasoning } = req.body;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        if (!proposalId) {
          return res.status(400).json({
            error: "Missing required field: proposalId",
          });
        }

        const proposals = await suiGameService.getAllTradeProposals();
        const proposal = proposals.find((p) => p.objectId === proposalId);

        if (!proposal) {
          return res.status(404).json({
            error: "Trade proposal not found",
          });
        }

        if (proposal.target !== agent.suiAddress) {
          return res.status(403).json({
            error: "Agent is not the target of this trade",
          });
        }

        const agentResources = await suiGameService.getPlayerResources(
          agent.suiAddress
        );
        const proposerResources = await suiGameService.getPlayerResources(
          proposal.proposer
        );

        if (!agentResources || !proposerResources) {
          return res.status(400).json({
            error: "Resources not found for one or both parties",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(agent.suiPrivateKey)
        );

        await suiGameService.acceptTrade(
          keypair,
          proposalId,
          proposerResources.objectId,
          agentResources.objectId
        );

        res.json({
          success: true,
          message: `Agent ${agent.name} accepted trade`,
          proposalId,
          reasoning: reasoning || "Trade accepted",
        });
      } catch (error) {
        console.error("Error agent accepting trade:", error);
        res.status(500).json({
          error: "Failed to accept trade",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.post(
    "/agents/:agentId/actions/refuse-trade",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { proposalId, reasoning } = req.body;

        const agent = gameWorld.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        if (!proposalId) {
          return res.status(400).json({
            error: "Missing required field: proposalId",
          });
        }

        const proposals = await suiGameService.getAllTradeProposals();
        const proposal = proposals.find((p) => p.objectId === proposalId);

        if (!proposal) {
          return res.status(404).json({
            error: "Trade proposal not found",
          });
        }

        if (
          proposal.proposer !== agent.suiAddress &&
          proposal.target !== agent.suiAddress
        ) {
          return res.status(403).json({
            error: "Agent is not involved in this trade",
          });
        }

        const keypair = Ed25519Keypair.fromSecretKey(
          fromB64(agent.suiPrivateKey)
        );

        await suiGameService.cancelTrade(keypair, proposalId);

        res.json({
          success: true,
          message: `Agent ${agent.name} refused/cancelled trade`,
          proposalId,
          reasoning: reasoning || "Trade refused",
        });
      } catch (error) {
        console.error("Error agent refusing trade:", error);
        res.status(500).json({
          error: "Failed to refuse trade",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  router.get("/agents", (req: Request, res: Response) => {
    try {
      const agents = gameWorld.getAllAgents();

      res.json({
        success: true,
        count: agents.length,
        agents: agents.map((agent) => ({
          id: agent.id,
          lettaAgentId: agent.lettaAgentId,
          name: agent.name,
          description: agent.description,
          position: agent.position,
          suiAddress: agent.suiAddress,
          createdAt: agent.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error getting agents:", error);
      res.status(500).json({
        error: "Failed to get agents",
      });
    }
  });

  router.get("/agents/nearby", (req: Request, res: Response) => {
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
      const rangeNum = range ? parseFloat(range as string) : 20;

      const nearbyAgents = gameWorld.getAgentsInRange(position, rangeNum);

      res.json({
        success: true,
        count: nearbyAgents.length,
        agents: nearbyAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          position: agent.position,
          suiAddress: agent.suiAddress,
        })),
      });
    } catch (error) {
      console.error("Error getting nearby agents:", error);
      res.status(500).json({
        error: "Failed to get nearby agents",
      });
    }
  });

  router.patch(
    "/agents/:agentId/position",
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { x, y } = req.body;

        if (x === undefined || y === undefined) {
          return res.status(400).json({
            error: "Missing required fields: x, y",
          });
        }

        const position: Position = { x, y };
        const updatedAgent = await gameWorld.updateAgentPosition(
          agentId,
          position
        );

        if (!updatedAgent) {
          return res.status(404).json({
            error: "Agent not found",
          });
        }

        res.json({
          success: true,
          agent: updatedAgent,
        });
      } catch (error) {
        console.error("Error updating agent position:", error);
        res.status(500).json({
          error: "Failed to update agent position",
        });
      }
    }
  );

  return router;
}
