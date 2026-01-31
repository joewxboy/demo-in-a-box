import { z } from 'zod';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from '../vagrant/executor.js';
import { join } from 'path';

export const EnvExecInputSchema = z.object({
  env_name: z.string(),
  target: z.enum(['hub', 'agent1', 'agent2', 'agent3', 'agent4', 'agent5', 'agent6', 'agent7']).default('hub'),
  command: z.string().min(1).max(1000),
  timeout_ms: z.number().min(1000).max(300000).optional().default(60000),
});

export async function envExecHandler(args: unknown) {
  const input = EnvExecInputSchema.parse(args);
  
  const sanitizedCommand = input.command.replace(/[`$]/g, '');
  
  const envManager = new EnvironmentManager();
  const executor = new CommandExecutor();
  
  const envDir = envManager.getEnvDir(input.env_name);
  
  let cwd: string;
  let vagrantfile: string;
  let targetVM: string;
  
  if (input.target === 'hub') {
    cwd = join(envDir, 'hub');
    vagrantfile = 'Vagrantfile.hub';
    targetVM = 'default';
  } else {
    const config = await envManager.getEnv(input.env_name);
    cwd = join(envDir, 'agents');
    vagrantfile = `Vagrantfile.${config.system_configuration}`;
    targetVM = input.target;
  }

  const result = await executor.executeVagrant('ssh', [targetVM, '-c', `"${sanitizedCommand}"`], {
    cwd,
    env: { VAGRANT_VAGRANTFILE: vagrantfile },
    timeout: input.timeout_ms,
  });

  const response = {
    success: result.exit_code === 0,
    environment: input.env_name,
    target: input.target,
    command: sanitizedCommand,
    exit_code: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    duration_ms: result.duration_ms,
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
