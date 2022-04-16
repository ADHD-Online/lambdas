import { z } from 'zod';
import flow from './flows';

export default () => {
  throw new Error(
    'You forgot to set which handler to use! ' +
    'See ADHD-Online/iac/aws/README.md for more info'
  );
}

export const ScheduleInitialAppointmentReminder = flow(
  'ScheduleInitialAppointmentReminder',
  z.object({
    patientRecordKey: z.object({
      pk: z.string(),
      sk: z.string(),
    }),
    email: z.string().optional(),
    phone: z.string().optional(),
    appointment: z.object({
      date: z.string(),
      time: z.string(),
      provider: z.string(),
    }),
  }),
);

