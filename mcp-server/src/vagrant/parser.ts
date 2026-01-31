import { VMState, VMStatus, SSHConfig } from '../types.js';

export function parseVagrantStatus(output: string): VMStatus[] {
  const vms: VMStatus[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const parts = line.split(',');
    
    if (parts.length >= 4 && parts[2] === 'state') {
      const vmName = parts[1];
      const state = parts[3] as VMState;
      
      vms.push({
        name: vmName,
        state,
      });
    }

    if (parts.length >= 4 && parts[2] === 'provider-name') {
      const vmName = parts[1];
      const provider = parts[3];
      
      const vm = vms.find(v => v.name === vmName);
      if (vm) {
        vm.provider = provider;
      }
    }
  }

  return vms;
}

export function parseSSHConfig(output: string): SSHConfig {
  const lines = output.split('\n');
  const config: Partial<SSHConfig> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('Host ')) {
      config.host = trimmed.substring(5);
    } else if (trimmed.startsWith('HostName ')) {
      config.hostname = trimmed.substring(9);
    } else if (trimmed.startsWith('Port ')) {
      config.port = parseInt(trimmed.substring(5), 10);
    } else if (trimmed.startsWith('User ')) {
      config.user = trimmed.substring(5);
    } else if (trimmed.startsWith('IdentityFile ')) {
      config.identity_file = trimmed.substring(13);
    }
  }

  if (!config.host || !config.hostname || !config.port || !config.user) {
    throw new Error('Incomplete SSH config');
  }

  config.connection_command = `ssh -p ${config.port} ${config.user}@${config.hostname} -i ${config.identity_file}`;

  return config as SSHConfig;
}

export function parsePortMappings(output: string): Record<number, number> {
  const mappings: Record<number, number> = {};
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/(\d+)\s+\(guest\)\s+=>\s+(\d+)\s+\(host\)/);
    if (match) {
      const guestPort = parseInt(match[1], 10);
      const hostPort = parseInt(match[2], 10);
      mappings[guestPort] = hostPort;
    }
  }

  return mappings;
}

export function extractIPFromAgentName(agentName: string, baseIP: number): string | undefined {
  const match = agentName.match(/agent(\d+)/);
  if (!match) {
    return undefined;
  }

  const agentNumber = parseInt(match[1], 10);
  const ip = baseIP + (agentNumber - 1) * 10;
  
  return `192.168.56.${ip}`;
}
