import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from '../vagrant/executor.js';
import { StatusChecker } from '../vagrant/status.js';

export const EnvInspectInputSchema = z.object({
  env_name: z.string(),
});

export async function envInspectHandler(args: unknown) {
  const input = EnvInspectInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const executor = new CommandExecutor();
  const statusChecker = new StatusChecker(envManager, executor);

  const status = await statusChecker.getEnvironmentStatus(input.env_name);

  const response = {
    success: true,
    environment: input.env_name,
    status,
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
