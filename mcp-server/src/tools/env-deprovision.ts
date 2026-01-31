import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from '../vagrant/executor.js';
import { OperationLedger } from '../ops/ledger.js';
import { lockManager } from '../env/locks.js';
import { join } from 'path';

export const EnvDeprovisionInputSchema = z.object({
  env_name: z.string(),
  destroy: z.boolean().optional().default(true),
  cleanup_files: z.boolean().optional().default(false),
});

export async function envDeprovisionHandler(args: unknown) {
  const input = EnvDeprovisionInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  await envManager.getEnv(input.env_name);
  
  const envDir = envManager.getEnvDir(input.env_name);
  const opsDir = join(envDir, 'ops');
  
  const ledger = new OperationLedger(opsDir);
  const { id: operationId, logger } = await ledger.createOperation(input.env_name, 'deprovision');

  Promise.resolve().then(async () => {
    try {
      await lockManager.withEnvLock(input.env_name, async () => {
        await lockManager.withGlobalSlot(async () => {
          await ledger.updateOperation(operationId, {
            status: 'running',
            started_at: new Date().toISOString(),
          });

          const executor = new CommandExecutor();
          
          if (input.destroy) {
            logger.writeLine(`[${new Date().toISOString()}] Running make down to destroy VMs...`);
            
            const result = await executor.executeMake('down', [], {
              cwd: envDir,
              logFile: join(opsDir, `op-${operationId}.log`),
              timeout: 600000,
            });

            logger.writeLine(`[${new Date().toISOString()}] Deprovision completed with exit code ${result.exit_code}`);

            await ledger.updateOperation(operationId, {
              status: result.exit_code === 0 ? 'succeeded' : 'failed',
              finished_at: new Date().toISOString(),
              exit_code: result.exit_code,
              error_summary: result.exit_code !== 0 ? 'Deprovision failed. Check logs for details.' : undefined,
            });
          } else {
            logger.writeLine(`[${new Date().toISOString()}] Halting VMs without destroying...`);
            
            const hubResult = await executor.executeVagrant('halt', [], {
              cwd: join(envDir, 'hub'),
              env: { VAGRANT_VAGRANTFILE: 'Vagrantfile.hub' },
              logFile: join(opsDir, `op-${operationId}.log`),
            });

            logger.writeLine(`[${new Date().toISOString()}] Hub halted with exit code ${hubResult.exit_code}`);

            await ledger.updateOperation(operationId, {
              status: 'succeeded',
              finished_at: new Date().toISOString(),
              exit_code: 0,
            });
          }

          await logger.close();

          if (input.cleanup_files) {
            logger.writeLine(`[${new Date().toISOString()}] Cleaning up environment files...`);
            await envManager.deleteEnv(input.env_name);
          }
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
    message: input.destroy ? 'Deprovision (destroy) started in background' : 'VM halt started in background',
    operation_id: operationId,
    environment: input.env_name,
    cleanup_files: input.cleanup_files,
    next_steps: [
      'Check operation status with operation_status tool',
      'View logs with operation_logs tool',
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
