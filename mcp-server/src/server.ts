import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class DemoInABoxMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'demo-in-a-box',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.close();
      process.exit(0);
    });
  }

  async connect(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Demo-in-a-Box MCP server running on stdio');
  }

  async close(): Promise<void> {
    await this.server.close();
  }

  getServer(): Server {
    return this.server;
  }
}
