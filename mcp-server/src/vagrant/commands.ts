export const ALLOWED_MAKE_COMMANDS = [
  'init',
  'up',
  'up-hub',
  'down',
  'status',
  'clean',
  'check',
  'connect',
  'connect-hub',
  'destroy',
  'destroy-hub',
] as const;

export const ALLOWED_VAGRANT_COMMANDS = [
  'status',
  'ssh-config',
  'port',
  'halt',
  'destroy',
  'snapshot',
  'up',
  'ssh',
] as const;

export type MakeCommand = typeof ALLOWED_MAKE_COMMANDS[number];
export type VagrantCommand = typeof ALLOWED_VAGRANT_COMMANDS[number];

export function isAllowedMakeCommand(command: string): command is MakeCommand {
  return ALLOWED_MAKE_COMMANDS.includes(command as MakeCommand);
}

export function isAllowedVagrantCommand(command: string): command is VagrantCommand {
  return ALLOWED_VAGRANT_COMMANDS.includes(command as VagrantCommand);
}
