import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';

export const EnvListInputSchema = z.object({
  filter_status: z.string().optional(),
});

export async function envListHandler(args: unknown) {
  EnvListInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const envs = await envManager.listEnvs();

  const response = {
    success: true,
    count: envs.length,
    environments: envs.map(env => ({
      name: env.name,
      system_configuration: env.system_configuration,
      created_at: env.created_at,
      path: env.path,
    })),
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
