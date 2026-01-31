import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from '../vagrant/executor.js';
import { OperationLedger } from '../ops/ledger.js';
import { lockManager } from '../env/locks.js';
import { join } from 'path';

export const EnvSnapshotInputSchema = z.object({
  env_name: z.string(),
  operation: z.enum(['list', 'save', 'restore', 'delete']),
  snapshot_name: z.string().optional(),
  target: z.enum(['hub', 'agent1', 'agent2', 'agent3', 'agent4', 'agent5', 'agent6', 'agent7', 'all']).default('all'),
  description: z.string().optional(),
});

export async function envSnapshotHandler(args: unknown) {
  const input = EnvSnapshotInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const executor = new CommandExecutor();
  const config = await envManager.getEnv(input.env_name);
  
  const envDir = envManager.getEnvDir(input.env_name);

  if (input.operation === 'list') {
    const results: any = { hub: null, agents: [] };

    const hubDir = join(envDir, 'hub');
    try {
      const hubResult = await executor.executeVagrant('snapshot', ['list'], {
        cwd: hubDir,
        env: { VAGRANT_VAGRANTFILE: 'Vagrantfile.hub' },
      });
      results.hub = parseSnapshotList(hubResult.stdout);
    } catch {}

    if (input.target === 'all' || input.target.startsWith('agent')) {
      const agentsDir = join(envDir, 'agents');
      const vagrantfile = `Vagrantfile.${config.system_configuration}`;
      
      try {
        const agentsResult = await executor.executeVagrant('snapshot', ['list'], {
          cwd: agentsDir,
          env: { VAGRANT_VAGRANTFILE: vagrantfile },
        });
        results.agents = parseSnapshotList(agentsResult.stdout);
      } catch {}
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            environment: input.env_name,
            snapshots: results,
          }, null, 2),
        },
      ],
    };
  }

  if (!input.snapshot_name) {
    throw new Error('snapshot_name is required for save/restore/delete operations');
  }

  if (input.operation === 'save') {
    const cwd = input.target === 'hub' ? join(envDir, 'hub') : join(envDir, 'agents');
    const vagrantfile = input.target === 'hub' ? 'Vagrantfile.hub' : `Vagrantfile.${config.system_configuration}`;
    const targetVM = input.target === 'hub' ? 'default' : (input.target === 'all' ? undefined : input.target);

    const args = targetVM ? [targetVM, input.snapshot_name] : [input.snapshot_name];

    const result = await executor.executeVagrant('snapshot', ['save', ...args], {
      cwd,
      env: { VAGRANT_VAGRANTFILE: vagrantfile },
      timeout: 300000,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.exit_code === 0,
            environment: input.env_name,
            operation: 'save',
            snapshot_name: input.snapshot_name,
            target: input.target,
            message: result.exit_code === 0 ? 'Snapshot saved successfully' : 'Snapshot save failed',
          }, null, 2),
        },
      ],
    };
  }

  if (input.operation === 'restore') {
    const opsDir = join(envDir, 'ops');
    const ledger = new OperationLedger(opsDir);
    const { id: operationId, logger } = await ledger.createOperation(input.env_name, 'snapshot-restore');

    Promise.resolve().then(async () => {
      try {
        await lockManager.withEnvLock(input.env_name, async () => {
          await lockManager.withGlobalSlot(async () => {
            const snapshotName = input.snapshot_name!;
            
            await ledger.updateOperation(operationId, {
              status: 'running',
              started_at: new Date().toISOString(),
            });

            const cwd = input.target === 'hub' ? join(envDir, 'hub') : join(envDir, 'agents');
            const vagrantfile = input.target === 'hub' ? 'Vagrantfile.hub' : `Vagrantfile.${config.system_configuration}`;
            const targetVM = input.target === 'hub' ? 'default' : (input.target === 'all' ? undefined : input.target);

            const args = targetVM ? [targetVM, snapshotName] : [snapshotName];

            logger.writeLine(`[${new Date().toISOString()}] Restoring snapshot ${snapshotName} for ${input.target}...`);

            const result = await executor.executeVagrant('snapshot', ['restore', ...args], {
              cwd,
              env: { VAGRANT_VAGRANTFILE: vagrantfile },
              logFile: join(opsDir, `op-${operationId}.log`),
              timeout: 600000,
            });

            logger.writeLine(`[${new Date().toISOString()}] Restore completed with exit code ${result.exit_code}`);

            await ledger.updateOperation(operationId, {
              status: result.exit_code === 0 ? 'succeeded' : 'failed',
              finished_at: new Date().toISOString(),
              exit_code: result.exit_code,
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

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Snapshot restore started in background',
            operation_id: operationId,
            environment: input.env_name,
            snapshot_name: input.snapshot_name,
            target: input.target,
          }, null, 2),
        },
      ],
    };
  }

  if (input.operation === 'delete') {
    const cwd = input.target === 'hub' ? join(envDir, 'hub') : join(envDir, 'agents');
    const vagrantfile = input.target === 'hub' ? 'Vagrantfile.hub' : `Vagrantfile.${config.system_configuration}`;
    const targetVM = input.target === 'hub' ? 'default' : (input.target === 'all' ? undefined : input.target);

    const args = targetVM ? [targetVM, input.snapshot_name] : [input.snapshot_name];

    const result = await executor.executeVagrant('snapshot', ['delete', ...args], {
      cwd,
      env: { VAGRANT_VAGRANTFILE: vagrantfile },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.exit_code === 0,
            environment: input.env_name,
            operation: 'delete',
            snapshot_name: input.snapshot_name,
            target: input.target,
            message: result.exit_code === 0 ? 'Snapshot deleted successfully' : 'Snapshot delete failed',
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown snapshot operation: ${input.operation}`);
}

function parseSnapshotList(output: string): string[] {
  const lines = output.split('\n');
  const snapshots: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.includes('==>') && !trimmed.includes('Name:') && trimmed !== '') {
      snapshots.push(trimmed);
    }
  }

  return snapshots;
}
