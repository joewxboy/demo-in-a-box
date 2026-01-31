import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { envCreateHandler } from './tools/env-create.js';
import { envListHandler } from './tools/env-list.js';
import { envInspectHandler } from './tools/env-inspect.js';
import { envProvisionHandler } from './tools/env-provision.js';
import { operationStatusHandler } from './tools/operation-status.js';
import { operationLogsHandler } from './tools/operation-logs.js';
import { envSSHInfoHandler } from './tools/env-ssh-info.js';
import { envExecHandler } from './tools/env-exec.js';
import { envDeprovisionHandler } from './tools/env-deprovision.js';

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

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'env_create',
          description: 'Create a new Open Horizon demo environment with specified configuration',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Environment name (lowercase letters, numbers, hyphens only)',
              },
              system_configuration: {
                type: 'string',
                enum: ['unicycle', 'bicycle', 'car', 'semi'],
                description: 'System topology: unicycle (1 agent), bicycle (3), car (5), semi (7)',
              },
              overrides: {
                type: 'object',
                properties: {
                  memory_mb: { type: 'number', description: 'Memory per agent VM in MB' },
                  disk_gb: { type: 'number', description: 'Disk per agent VM in GB' },
                  base_ip: { type: 'number', description: 'Starting IP offset' },
                  num_agents: { type: 'number', description: 'Override number of agents' },
                },
              },
              auto_provision: {
                type: 'boolean',
                description: 'Automatically start provisioning after creation',
              },
            },
            required: ['name', 'system_configuration'],
          },
        },
        {
          name: 'env_list',
          description: 'List all demo environments',
          inputSchema: {
            type: 'object',
            properties: {
              filter_status: {
                type: 'string',
                description: 'Optional status filter',
              },
            },
          },
        },
        {
          name: 'env_inspect',
          description: 'Get detailed status of a demo environment (desired state, observed VM states, artifacts)',
          inputSchema: {
            type: 'object',
            properties: {
              env_name: {
                type: 'string',
                description: 'Environment name to inspect',
              },
            },
            required: ['env_name'],
          },
        },
        {
          name: 'env_provision',
          description: 'Start provisioning VMs for an environment (async operation, returns operation_id)',
          inputSchema: {
            type: 'object',
            properties: {
              env_name: {
                type: 'string',
                description: 'Environment name to provision',
              },
              force_recreate: {
                type: 'boolean',
                description: 'Run make down before provisioning to clean up',
              },
            },
            required: ['env_name'],
          },
        },
        {
          name: 'operation_status',
          description: 'Check status of an async operation (provision, deprovision)',
          inputSchema: {
            type: 'object',
            properties: {
              operation_id: {
                type: 'string',
                description: 'Operation ID returned from async tool',
              },
            },
            required: ['operation_id'],
          },
        },
        {
          name: 'operation_logs',
          description: 'Retrieve logs from an operation with pagination support',
          inputSchema: {
            type: 'object',
            properties: {
              operation_id: {
                type: 'string',
                description: 'Operation ID',
              },
              offset: {
                type: 'number',
                description: 'Line offset for pagination',
              },
              limit: {
                type: 'number',
                description: 'Max lines to return',
              },
              tail: {
                type: 'boolean',
                description: 'Get last N lines',
              },
            },
            required: ['operation_id'],
          },
        },
        {
          name: 'env_ssh_info',
          description: 'Get SSH connection details for a VM in the environment',
          inputSchema: {
            type: 'object',
            properties: {
              env_name: {
                type: 'string',
                description: 'Environment name',
              },
              target: {
                type: 'string',
                enum: ['hub', 'agent1', 'agent2', 'agent3', 'agent4', 'agent5', 'agent6', 'agent7'],
                description: 'Target VM',
              },
            },
            required: ['env_name'],
          },
        },
        {
          name: 'env_exec',
          description: 'Execute a command on a VM in the environment',
          inputSchema: {
            type: 'object',
            properties: {
              env_name: {
                type: 'string',
                description: 'Environment name',
              },
              target: {
                type: 'string',
                enum: ['hub', 'agent1', 'agent2', 'agent3', 'agent4', 'agent5', 'agent6', 'agent7'],
                description: 'Target VM',
              },
              command: {
                type: 'string',
                description: 'Command to execute',
              },
              timeout_ms: {
                type: 'number',
                description: 'Command timeout in milliseconds',
              },
            },
            required: ['env_name', 'command'],
          },
        },
        {
          name: 'env_deprovision',
          description: 'Deprovision (destroy or halt) VMs in an environment (async operation)',
          inputSchema: {
            type: 'object',
            properties: {
              env_name: {
                type: 'string',
                description: 'Environment name',
              },
              destroy: {
                type: 'boolean',
                description: 'Destroy VMs (true) or just halt (false)',
              },
              cleanup_files: {
                type: 'boolean',
                description: 'Also delete environment directory',
              },
            },
            required: ['env_name'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'env_create':
            return await envCreateHandler(request.params.arguments);
          case 'env_list':
            return await envListHandler(request.params.arguments);
          case 'env_inspect':
            return await envInspectHandler(request.params.arguments);
          case 'env_provision':
            return await envProvisionHandler(request.params.arguments);
          case 'operation_status':
            return await operationStatusHandler(request.params.arguments);
          case 'operation_logs':
            return await operationLogsHandler(request.params.arguments);
          case 'env_ssh_info':
            return await envSSHInfoHandler(request.params.arguments);
          case 'env_exec':
            return await envExecHandler(request.params.arguments);
          case 'env_deprovision':
            return await envDeprovisionHandler(request.params.arguments);
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
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
