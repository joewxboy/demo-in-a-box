import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from '../vagrant/executor.js';
import { OperationLedger } from '../ops/ledger.js';
import { lockManager } from '../env/locks.js';
import { join } from 'path';

export const EnvProvisionInputSchema = z.object({
  env_name: z.string(),
  force_recreate: z.boolean().optional().default(false),
});

export async function envProvisionHandler(args: unknown) {
  const input = EnvProvisionInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const config = await envManager.getEnv(input.env_name);
  
  const envDir = envManager.getEnvDir(input.env_name);
  const opsDir = join(envDir, 'ops');
  
  const ledger = new OperationLedger(opsDir);
  const { id: operationId, logger } = await ledger.createOperation(input.env_name, 'provision');

  Promise.resolve().then(async () => {
    try {
      await lockManager.withEnvLock(input.env_name, async () => {
        await lockManager.withGlobalSlot(async () => {
          await ledger.updateOperation(operationId, {
            status: 'running',
            started_at: new Date().toISOString(),
          });

          const executor = new CommandExecutor();
          
          if (input.force_recreate) {
            logger.writeLine(`[${new Date().toISOString()}] Running make down to clean up existing VMs...`);
            const downResult = await executor.executeMake('down', [], {
              cwd: envDir,
              logFile: join(opsDir, `op-${operationId}.log`),
            });
            
            if (downResult.exit_code !== 0) {
              logger.writeLine(`[${new Date().toISOString()}] Warning: make down failed, continuing anyway...`);
            }
          }

          logger.writeLine(`[${new Date().toISOString()}] Starting provision for ${config.system_configuration}...`);
          
          const envVars: Record<string, string> = {
            SYSTEM_CONFIGURATION: config.system_configuration,
          };

          if (config.overrides?.num_agents) {
            envVars.NUM_AGENTS = String(config.overrides.num_agents);
          }
          if (config.overrides?.base_ip) {
            envVars.BASE_IP = String(config.overrides.base_ip);
          }
          if (config.overrides?.memory_mb) {
            envVars.MEMORY = String(config.overrides.memory_mb);
          }
          if (config.overrides?.disk_gb) {
            envVars.DISK_SIZE = String(config.overrides.disk_gb);
          }

          const result = await executor.executeMake('init', [], {
            cwd: envDir,
            env: envVars,
            logFile: join(opsDir, `op-${operationId}.log`),
            timeout: 3600000,
          });

          logger.writeLine(`[${new Date().toISOString()}] Provision completed with exit code ${result.exit_code}`);

          await ledger.updateOperation(operationId, {
            status: result.exit_code === 0 ? 'succeeded' : 'failed',
            finished_at: new Date().toISOString(),
            exit_code: result.exit_code,
            error_summary: result.exit_code !== 0 ? 'Provisioning failed. Check logs for details.' : undefined,
          });

          await logger.close();
        });
      });
    } catch (error: any) {
      logger.writeLine(`[${new Date().toISOString()}] ERROR: ${error.message}`);
      
      await ledger.updateOperation(operationId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_summary: error.message,
      });

      await logger.close();
    }
  });

  const response = {
    success: true,
    message: 'Provisioning started in background',
    operation_id: operationId,
    environment: input.env_name,
    next_steps: [
      'Check operation status with operation_status tool',
      'View logs with operation_logs tool',
      'Inspect environment with env_inspect after completion',
    ],
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
