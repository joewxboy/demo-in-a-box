import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from '../vagrant/executor.js';
import { parseSSHConfig } from '../vagrant/parser.js';
import { join } from 'path';

export const EnvSSHInfoInputSchema = z.object({
  env_name: z.string(),
  target: z.enum(['hub', 'agent1', 'agent2', 'agent3', 'agent4', 'agent5', 'agent6', 'agent7']).default('hub'),
});

export async function envSSHInfoHandler(args: unknown) {
  const input = EnvSSHInfoInputSchema.parse(args);
  
  const envManager = new EnvironmentManager();
  const executor = new CommandExecutor();
  
  const envDir = envManager.getEnvDir(input.env_name);
  
  let cwd: string;
  let vagrantfile: string;
  
  if (input.target === 'hub') {
    cwd = join(envDir, 'hub');
    vagrantfile = 'Vagrantfile.hub';
  } else {
    const config = await envManager.getEnv(input.env_name);
    cwd = join(envDir, 'agents');
    vagrantfile = `Vagrantfile.${config.system_configuration}`;
  }

  const result = await executor.executeVagrant('ssh-config', [input.target === 'hub' ? 'default' : input.target], {
    cwd,
    env: { VAGRANT_VAGRANTFILE: vagrantfile },
  });

  const sshConfig = parseSSHConfig(result.stdout);

  const response = {
    success: true,
    environment: input.env_name,
    target: input.target,
    ssh_config: sshConfig,
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
