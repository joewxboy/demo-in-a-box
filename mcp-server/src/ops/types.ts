import { z } from 'zod';

export const OperationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export const OperationMetadataSchema = z.object({
  id: z.string(),
  env_name: z.string(),
  type: z.string(),
  status: OperationStatusSchema,
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  exit_code: z.number().optional(),
  error_summary: z.string().optional(),
});
