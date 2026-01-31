import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { OperationLedger } from '../ops/ledger.js';
import { join } from 'path';

export const OperationLogsInputSchema = z.object({
  operation_id: z.string(),
  offset: z.number().min(0).optional().default(0),
  limit: z.number().min(1).max(10000).optional().default(1000),
  tail: z.boolean().optional().default(false),
});

export async function operationLogsHandler(args: unknown) {
  const input = OperationLogsInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const envs = await envManager.listEnvs();
  
  let logs = null;
  
  for (const env of envs) {
    const opsDir = join(env.path, 'ops');
    const ledger = new OperationLedger(opsDir);
    
    try {
      logs = await ledger.getOperationLogs(input.operation_id, input.offset, input.limit);
      break;
    } catch {}
  }

  if (!logs) {
    throw new Error(`Logs for operation "${input.operation_id}" not found`);
  }

  const response = {
    success: true,
    operation_id: input.operation_id,
    offset: input.offset,
    limit: input.limit,
    lines_returned: logs.lines.length,
    next_offset: logs.next_offset,
    logs: logs.lines.join('\n'),
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
