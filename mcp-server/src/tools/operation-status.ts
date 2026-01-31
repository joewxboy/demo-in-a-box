import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { OperationLedger } from '../ops/ledger.js';
import { join } from 'path';

export const OperationStatusInputSchema = z.object({
  operation_id: z.string(),
});

export async function operationStatusHandler(args: unknown) {
  const input = OperationStatusInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const envs = await envManager.listEnvs();
  
  let operation = null;
  
  for (const env of envs) {
    const opsDir = join(env.path, 'ops');
    const ledger = new OperationLedger(opsDir);
    
    try {
      operation = await ledger.getOperation(input.operation_id);
      break;
    } catch {}
  }

  if (!operation) {
    throw new Error(`Operation "${input.operation_id}" not found`);
  }

  const response: any = {
    success: true,
    operation,
  };

  if (operation.status === 'failed' && operation.error_summary) {
    response.next_actions = [
      'Check operation logs using operation_logs tool',
      'Review error and fix underlying issue',
      'Retry provisioning with env_provision',
    ];
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
