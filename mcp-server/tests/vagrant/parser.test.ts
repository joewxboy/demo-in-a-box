import { describe, it, expect } from 'vitest';
import { parseVagrantStatus, parseSSHConfig, parsePortMappings, extractIPFromAgentName } from '../../src/vagrant/parser.js';

describe('parseVagrantStatus', () => {
  it('should parse machine-readable vagrant status output', () => {
    const output = `1643723456,,ui,info,Current machine states:
1643723456,default,provider-name,virtualbox
1643723456,default,state,running
1643723456,default,state-human-short,running
1643723456,,ui,info,The VM is running.`;

    const result = parseVagrantStatus(output);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('default');
    expect(result[0].state).toBe('running');
  });

  it('should parse multiple VMs', () => {
    const output = `1643723456,agent1,provider-name,virtualbox
1643723456,agent1,state,running
1643723456,agent2,provider-name,virtualbox
1643723456,agent2,state,stopped`;

    const result = parseVagrantStatus(output);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('agent1');
    expect(result[0].state).toBe('running');
    expect(result[1].name).toBe('agent2');
    expect(result[1].state).toBe('stopped');
  });

  it('should handle not_created state', () => {
    const output = `1643723456,default,provider-name,virtualbox
1643723456,default,state,not_created`;

    const result = parseVagrantStatus(output);

    expect(result).toHaveLength(1);
    expect(result[0].state).toBe('not_created');
  });

  it('should return empty array for empty output', () => {
    const result = parseVagrantStatus('');
    expect(result).toEqual([]);
  });
});

describe('parseSSHConfig', () => {
  it('should parse vagrant ssh-config output', () => {
    const output = `Host default
  HostName 127.0.0.1
  User vagrant
  Port 2222
  IdentityFile /path/to/key`;

    const result = parseSSHConfig(output);

    expect(result).toEqual({
      host: 'default',
      hostname: '127.0.0.1',
      user: 'vagrant',
      port: 2222,
      identity_file: '/path/to/key',
      connection_command: 'ssh -p 2222 vagrant@127.0.0.1 -i /path/to/key',
    });
  });

  it('should throw error for incomplete config', () => {
    const output = `Host default
  HostName 127.0.0.1`;

    expect(() => parseSSHConfig(output)).toThrow('Incomplete SSH config');
  });
});

describe('parsePortMappings', () => {
  it('should parse vagrant port output', () => {
    const output = `The forwarded ports for the machine are listed below:
    22 (guest) => 2222 (host)
    3090 (guest) => 3090 (host)
    9443 (guest) => 9443 (host)`;

    const result = parsePortMappings(output);

    expect(result).toEqual({
      22: 2222,
      3090: 3090,
      9443: 9443,
    });
  });

  it('should return empty object for no ports', () => {
    const output = 'No forwarded ports';
    const result = parsePortMappings(output);
    expect(result).toEqual({});
  });
});

describe('extractIPFromAgentName', () => {
  it('should extract IP for agent1 with base 20', () => {
    const ip = extractIPFromAgentName('agent1', 20);
    expect(ip).toBe('192.168.56.20');
  });

  it('should extract IP for agent2 with base 20', () => {
    const ip = extractIPFromAgentName('agent2', 20);
    expect(ip).toBe('192.168.56.30');
  });

  it('should extract IP for agent3 with base 20', () => {
    const ip = extractIPFromAgentName('agent3', 20);
    expect(ip).toBe('192.168.56.40');
  });

  it('should return undefined for non-agent name', () => {
    const ip = extractIPFromAgentName('default', 20);
    expect(ip).toBeUndefined();
  });

  it('should handle different base IPs', () => {
    const ip = extractIPFromAgentName('agent1', 30);
    expect(ip).toBe('192.168.56.30');
  });
});
