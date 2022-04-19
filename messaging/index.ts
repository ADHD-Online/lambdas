import { z } from 'zod';
import flow from './flows';
import {
  fetchDemoView,
} from './flows/util';
import {
  ViewData,
} from './flows/types';

export default () => {
  throw new Error(
    'You forgot to set which handler to use! ' +
    'See ADHD-Online/iac/aws/README.md for more info'
  );
}

export const ScheduleInitialAppointmentReminder = flow({
  flowKey: 'ScheduleInitialAppointmentReminder',
  source: () => fetchDemoView(ViewData.merge(z.object({
    apptType: z.enum(['Med Management', 'TeleTherapy']),
    firstName: z.string(),
    year: z.string(),
  }))),
});

