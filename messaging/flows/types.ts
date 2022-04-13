import { z } from 'zod';

export const ConfigTableData = z.object({
  templates: z.object({
    email: z.object({
      subject: z.string(),
      body: z.string(),
    }),
    sms: z.string(),
  }),
});
export type ConfigTableData = z.infer<typeof ConfigTableData>;

