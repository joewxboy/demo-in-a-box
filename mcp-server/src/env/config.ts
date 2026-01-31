import { homedir } from 'os';
import { join } from 'path';

export const ENV_BASE_DIR = join(homedir(), '.demo-in-a-box', 'envs');
export const GLOBAL_LOCK_FILE = join(homedir(), '.demo-in-a-box', 'global.lock');

export const REPO_ROOT = join(process.cwd(), '..');

export const DEFAULT_CONFIGS = {
  unicycle: { num_agents: 1, memory_mb: 2048, disk_gb: 20, base_ip: 20 },
  bicycle: { num_agents: 3, memory_mb: 2048, disk_gb: 20, base_ip: 20 },
  car: { num_agents: 5, memory_mb: 2048, disk_gb: 20, base_ip: 20 },
  semi: { num_agents: 7, memory_mb: 2048, disk_gb: 20, base_ip: 20 },
};
