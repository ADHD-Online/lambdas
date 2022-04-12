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

export const ScheduleInitialAppointmentReminderViewResult = z.object({
  patientId: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  // TBD
  appointment: z.object({
    date: z.string(),
    time: z.string(),
    provider: z.string(),
  }),
});
export type ScheduleInitialAppointmentReminderViewResult =
  z.infer<typeof ScheduleInitialAppointmentReminderViewResult>
;

