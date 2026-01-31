import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const EnvCredentialsInputSchema = z.object({
  env_name: z.string(),
  show_secrets: z.boolean().optional().default(false),
});

export async function envCredentialsHandler(args: unknown) {
  const input = EnvCredentialsInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const envDir = envManager.getEnvDir(input.env_name);
  const credsPath = join(envDir, 'hub', 'mycreds.env');

  try {
    const content = await readFile(credsPath, 'utf-8');
    const lines = content.split('\n');
    
    const credentials: any = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      if (trimmed.startsWith('export ')) {
        const withoutExport = trimmed.substring(7);
        const [key, ...valueParts] = withoutExport.split('=');
        const value = valueParts.join('=');

        if (key === 'HZN_ORG_ID') {
          credentials.hzn_org_id = value;
        } else if (key === 'HZN_EXCHANGE_USER_AUTH') {
          if (input.show_secrets) {
            credentials.hzn_exchange_user_auth = value;
          } else {
            credentials.hzn_exchange_user_auth = '[REDACTED - set show_secrets=true to reveal]';
          }
        }
      }
    }

    const response: any = {
      success: true,
      environment: input.env_name,
      credentials,
      warning: input.show_secrets 
        ? 'WARNING: Credentials are shown in plain text. Keep this information secure!'
        : 'Credentials are redacted by default. Set show_secrets=true to reveal.',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Credentials file not found. Environment may not be provisioned yet.',
              environment: input.env_name,
            }, null, 2),
          },
        ],
      };
    }

    throw error;
  }
}
