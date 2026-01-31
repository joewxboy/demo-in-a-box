import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OperationMetadata } from '../types.js';
import { OperationMetadataSchema } from './types.js';
import { OperationLogger } from './logger.js';

export class OperationLedger {
  constructor(private envOpsDir: string) {}

  async createOperation(envName: string, type: string): Promise<{ id: string; logger: OperationLogger }> {
    const id = uuidv4();
    const metadata: OperationMetadata = {
      id,
      env_name: envName,
      type,
      status: 'queued',
      created_at: new Date().toISOString(),
    };

    const metadataPath = join(this.envOpsDir, `op-${id}.json`);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    const logPath = join(this.envOpsDir, `op-${id}.log`);
    const logger = new OperationLogger(logPath);
    logger.start();

    return { id, logger };
  }

  async updateOperation(
    id: string,
    updates: Partial<Pick<OperationMetadata, 'status' | 'started_at' | 'finished_at' | 'exit_code' | 'error_summary'>>
  ): Promise<void> {
    const metadata = await this.getOperation(id);
    
    const updated: OperationMetadata = {
      ...metadata,
      ...updates,
    };

    const metadataPath = join(this.envOpsDir, `op-${id}.json`);
    await writeFile(metadataPath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  async getOperation(id: string): Promise<OperationMetadata> {
    const metadataPath = join(this.envOpsDir, `op-${id}.json`);
    
    try {
      const content = await readFile(metadataPath, 'utf-8');
      const data = JSON.parse(content);
      return OperationMetadataSchema.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Operation "${id}" not found`);
      }
      throw error;
    }
  }

  async listOperations(envName?: string): Promise<OperationMetadata[]> {
    try {
      const files = await readdir(this.envOpsDir);
      const operations: OperationMetadata[] = [];

      for (const file of files) {
        if (file.startsWith('op-') && file.endsWith('.json')) {
          const id = file.slice(3, -5);
          try {
            const op = await this.getOperation(id);
            if (!envName || op.env_name === envName) {
              operations.push(op);
            }
          } catch {}
        }
      }

      return operations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getOperationLogs(id: string, offset: number = 0, limit: number = 1000): Promise<{ lines: string[]; next_offset: number }> {
    const logPath = join(this.envOpsDir, `op-${id}.log`);
    
    try {
      const content = await readFile(logPath, 'utf-8');
      const allLines = content.split('\n');
      
      const lines = allLines.slice(offset, offset + limit);
      const next_offset = offset + lines.length;

      return {
        lines,
        next_offset,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { lines: [], next_offset: 0 };
      }
      throw error;
    }
  }
}
