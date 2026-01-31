import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OperationLedger } from '../../src/ops/ledger.js';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('OperationLedger', () => {
  let testDir: string;
  let ledger: OperationLedger;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    ledger = new OperationLedger(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('createOperation', () => {
    it('should create operation with initial metadata', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');

      expect(id).toBeDefined();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(logger).toBeDefined();

      const op = await ledger.getOperation(id);
      expect(op.env_name).toBe('test-env');
      expect(op.type).toBe('provision');
      expect(op.status).toBe('queued');
      expect(op.created_at).toBeDefined();

      await logger.close();
    });

    it('should create log file for operation', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');

      logger.writeLine('Test log line');
      await logger.close();

      const logs = await ledger.getOperationLogs(id);
      expect(logs.lines).toContain('Test log line');
    });
  });

  describe('updateOperation', () => {
    it('should update operation status', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');
      await logger.close();

      await ledger.updateOperation(id, {
        status: 'running',
        started_at: new Date().toISOString(),
      });

      const op = await ledger.getOperation(id);
      expect(op.status).toBe('running');
      expect(op.started_at).toBeDefined();
    });

    it('should update operation with completion', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');
      await logger.close();

      await ledger.updateOperation(id, {
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        exit_code: 0,
      });

      const op = await ledger.getOperation(id);
      expect(op.status).toBe('succeeded');
      expect(op.finished_at).toBeDefined();
      expect(op.exit_code).toBe(0);
    });

    it('should update operation with error', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');
      await logger.close();

      await ledger.updateOperation(id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        exit_code: 1,
        error_summary: 'Test error',
      });

      const op = await ledger.getOperation(id);
      expect(op.status).toBe('failed');
      expect(op.error_summary).toBe('Test error');
    });
  });

  describe('getOperation', () => {
    it('should retrieve operation metadata', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');
      await logger.close();

      const op = await ledger.getOperation(id);

      expect(op.id).toBe(id);
      expect(op.env_name).toBe('test-env');
      expect(op.type).toBe('provision');
    });

    it('should throw error for non-existent operation', async () => {
      await expect(ledger.getOperation('non-existent-id')).rejects.toThrow('not found');
    });
  });

  describe('listOperations', () => {
    it('should list all operations', async () => {
      const { id: id1, logger: logger1 } = await ledger.createOperation('env1', 'provision');
      const { id: id2, logger: logger2 } = await ledger.createOperation('env2', 'deprovision');
      await logger1.close();
      await logger2.close();

      const ops = await ledger.listOperations();

      expect(ops).toHaveLength(2);
      expect(ops.map(o => o.id)).toContain(id1);
      expect(ops.map(o => o.id)).toContain(id2);
    });

    it('should filter operations by environment', async () => {
      const { id: id1, logger: logger1 } = await ledger.createOperation('env1', 'provision');
      const { id: id2, logger: logger2 } = await ledger.createOperation('env2', 'provision');
      await logger1.close();
      await logger2.close();

      const ops = await ledger.listOperations('env1');

      expect(ops).toHaveLength(1);
      expect(ops[0].id).toBe(id1);
    });

    it('should return empty array for no operations', async () => {
      const ops = await ledger.listOperations();
      expect(ops).toEqual([]);
    });

    it('should sort operations by created_at descending', async () => {
      const { id: id1, logger: logger1 } = await ledger.createOperation('env1', 'provision');
      await logger1.close();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const { id: id2, logger: logger2 } = await ledger.createOperation('env2', 'provision');
      await logger2.close();

      const ops = await ledger.listOperations();

      expect(ops[0].id).toBe(id2);
      expect(ops[1].id).toBe(id1);
    });
  });

  describe('getOperationLogs', () => {
    it('should retrieve operation logs', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');
      
      logger.writeLine('Line 1');
      logger.writeLine('Line 2');
      logger.writeLine('Line 3');
      await logger.close();

      const logs = await ledger.getOperationLogs(id);

      expect(logs.lines.length).toBeGreaterThanOrEqual(3);
      expect(logs.lines).toContain('Line 1');
      expect(logs.lines).toContain('Line 2');
      expect(logs.lines).toContain('Line 3');
    });

    it('should support pagination with offset and limit', async () => {
      const { id, logger } = await ledger.createOperation('test-env', 'provision');
      
      for (let i = 0; i < 10; i++) {
        logger.writeLine(`Line ${i}`);
      }
      await logger.close();

      const logs = await ledger.getOperationLogs(id, 3, 5);

      expect(logs.lines).toHaveLength(5);
      expect(logs.lines[0]).toBe('Line 3');
      expect(logs.next_offset).toBe(8);
    });

    it('should return empty logs for non-existent operation', async () => {
      const logs = await ledger.getOperationLogs('non-existent');
      expect(logs.lines).toEqual([]);
      expect(logs.next_offset).toBe(0);
    });
  });
});
