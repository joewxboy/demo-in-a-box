import { EnvironmentStatus, HubStatus, VMStatus } from '../types.js';
import { EnvironmentManager } from '../env/manager.js';
import { CommandExecutor } from './executor.js';
import { extractIPFromAgentName, parseVagrantStatus } from './parser.js';
import { join } from 'path';

export class StatusChecker {
  constructor(
    private envManager: EnvironmentManager,
    private executor: CommandExecutor
  ) {}

  async getEnvironmentStatus(envName: string): Promise<EnvironmentStatus> {
    const config = await this.envManager.getEnv(envName);
    const envDir = this.envManager.getEnvDir(envName);

    const hubDir = join(envDir, 'hub');
    const agentsDir = join(envDir, 'agents');

    let hubStatus: HubStatus;
    let agentStatuses: VMStatus[] = [];

    try {
      const hubResult = await this.executor.executeVagrant('status', ['--machine-readable'], {
        cwd: hubDir,
        env: { VAGRANT_VAGRANTFILE: 'Vagrantfile.hub' },
      });

      const hubVMs = parseVagrantStatus(hubResult.stdout);
      const hubVM = hubVMs[0];

      hubStatus = {
        name: hubVM?.name || 'default',
        state: hubVM?.state || 'not_created',
        ip: '192.168.56.10',
        provider: hubVM?.provider,
        ports: {
          exchange: 3090,
          agbot: 3111,
          fdo: 9008,
          css: 9443,
        },
      };
    } catch (error) {
      hubStatus = {
        name: 'default',
        state: 'not_created',
        ip: '192.168.56.10',
        ports: {
          exchange: 3090,
          agbot: 3111,
          fdo: 9008,
          css: 9443,
        },
      };
    }

    try {
      const vagrantfile = `Vagrantfile.${config.system_configuration}`;
      const agentsResult = await this.executor.executeVagrant('status', ['--machine-readable'], {
        cwd: agentsDir,
        env: { VAGRANT_VAGRANTFILE: vagrantfile },
      });

      agentStatuses = parseVagrantStatus(agentsResult.stdout);

      const baseIP = config.overrides?.base_ip || 20;
      agentStatuses.forEach(agent => {
        agent.ip = extractIPFromAgentName(agent.name, baseIP);
      });
    } catch (error) {
    }

    const credsPath = join(hubDir, 'mycreds.env');
    const sshKeysPath = join(envDir, 'hub', '.vagrant');

    let credsPresent = false;
    let sshKeysPresent = false;

    try {
      const { stat } = await import('fs/promises');
      await stat(credsPath);
      credsPresent = true;
    } catch {}

    try {
      const { stat } = await import('fs/promises');
      await stat(sshKeysPath);
      sshKeysPresent = true;
    } catch {}

    return {
      desired: config,
      observed: {
        hub: hubStatus,
        agents: agentStatuses,
      },
      artifacts: {
        creds_present: credsPresent,
        ssh_keys_present: sshKeysPresent,
      },
    };
  }
}
