import axios, { AxiosInstance } from "axios";

interface MemoryBlock {
  label: string;
  value: string;
  description?: string;
  limit?: number;
}

interface AgentConfig {
  name: string;
  personaDescription: string;
  humanDescription: string;
}

export class LettaClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = "https://api.letta.com") {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async createAgent(config: AgentConfig): Promise<any> {
    try {
      const response = await this.client.post("/v1/agents", {
        name: config.name,
        memory_blocks: [
          {
            label: "persona",
            value: config.personaDescription,
            description:
              "The persona block: Stores details about your current persona, guiding how you behave and respond.",
            limit: 5000,
          },
          {
            label: "human",
            value: config.humanDescription,
            description:
              "The human block: Stores key details about the person you are conversing with.",
            limit: 5000,
          },
          {
            label: "world_context",
            value:
              "You are in a game world. Context will be updated as you interact.",
            description:
              "Current information about the game world, your position, nearby agents, items, and players. This block is automatically updated.",
            limit: 8000,
          },
        ],
      });

      return response.data;
    } catch (error: any) {
      console.error("Error creating agent:", error.response?.status);
      throw error;
    }
  }

  async sendMessage(agentId: string, message: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/v1/agents/${agentId}/messages`,
        {
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Error sending message:", error.response?.status);
      throw error;
    }
  }

  async sendMessageWithContext(
    agentId: string,
    message: string,
    systemContext: string
  ): Promise<any> {
    try {
      try {
        await this.updateMemoryBlock(agentId, "world_context", systemContext);
      } catch (error: any) {
        const briefContext = systemContext
          .split("\n")
          .filter((line) => line.trim())
          .slice(0, 15)
          .join("\n");

        message = `[Your current environment:\n${briefContext}]\n\nPlayer says: ${message}`;
      }

      return await this.sendMessage(agentId, message);
    } catch (error: any) {
      console.error("Error sending message with context:", error);
      throw error;
    }
  }

  async getAgent(agentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/agents/${agentId}`);
      return response.data;
    } catch (error: any) {
      console.error("Error getting agent:", error.response?.status);
      throw error;
    }
  }

  async listAgents(): Promise<any> {
    try {
      const response = await this.client.get("/v1/agents");
      return response.data;
    } catch (error) {
      console.error("Error listing agents:", error);
      throw error;
    }
  }

  async updateMemoryBlock(
    agentId: string,
    blockLabel: string,
    value: string
  ): Promise<any> {
    try {
      const response = await this.client.patch(
        `/v1/agents/${agentId}/memory/${blockLabel}`,
        {
          value: value,
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(
          `Memory block '${blockLabel}' not found for agent ${agentId}`
        );
      }
      throw error;
    }
  }

  async getMemoryBlocks(agentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/agents/${agentId}/memory`);
      return response.data;
    } catch (error: any) {
      console.error("Error getting memory blocks:", error.response?.status);
      throw error;
    }
  }

  async updateWorldContext(agentId: string, context: string): Promise<any> {
    try {
      return await this.updateMemoryBlock(agentId, "world_context", context);
    } catch (error) {
      return null;
    }
  }

  async deleteAgent(agentId: string): Promise<any> {
    try {
      const response = await this.client.delete(`/v1/agents/${agentId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting agent:", error);
      throw error;
    }
  }
}
