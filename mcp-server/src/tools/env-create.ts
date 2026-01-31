import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { SystemConfigurationSchema, EnvironmentOverridesSchema } from '../env/types.js';

export const EnvCreateInputSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must contain only lowercase letters, numbers, and hyphens'),
  system_configuration: SystemConfigurationSchema,
  overrides: EnvironmentOverridesSchema,
  auto_provision: z.boolean().optional().default(false),
});

export async function envCreateHandler(args: unknown) {
  const input = EnvCreateInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  
  const metadata = await envManager.createEnv({
    name: input.name,
    system_configuration: input.system_configuration,
    overrides: input.overrides,
  });

  const response: any = {
    success: true,
    environment: {
      name: metadata.name,
      system_configuration: metadata.system_configuration,
      path: metadata.path,
      created_at: metadata.created_at,
    },
  };

  if (input.auto_provision) {
    response.message = 'Environment created. Use env_provision tool to start provisioning.';
    response.next_step = {
      tool: 'env_provision',
      args: { env_name: metadata.name },
    };
  } else {
    response.message = 'Environment created successfully.';
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
