import { z } from 'zod';

export const ConfigTableData = z.object({
  templates: z.object({
    nextSteps: z.string(),
    sms: z.string(),
  }),
});
export type ConfigTableData = z.infer<typeof ConfigTableData>;

export const ViewData = z.object({
  patientRecordKey: z.object({
    pk: z.string(),
    sk: z.string(),
  }),
  email: z.string().optional(),
  phone: z.string().optional(),
}).passthrough();
export type ViewData = z.infer<typeof ViewData>;

