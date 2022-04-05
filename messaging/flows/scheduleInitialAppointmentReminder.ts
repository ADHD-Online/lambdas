import Mustache from 'mustache';
import {
  ScheduleInitialAppointmentReminderViewResult as ViewResult,
} from '@adhd-online/unified-types/messaging';
import { fetchConfig, sendEmail, sendSms } from './util';

export const FLOW_KEY = 'messaging#ScheduleInitialAppointmentReminder';

export default async () => {
  const { templates } = await fetchConfig(FLOW_KEY);

  //TODO fetch results from data lake
  const gcpClient = null; //TODO
  const results: ViewResult[] = [];

  // perform actions
  await Promise.all(results.flatMap(unparsedResult => {
    const viewData = ViewResult.parse(unparsedResult);
    const promises = [];

    if (viewData.email) {
      promises.push(
        sendEmail(
          viewData.email,
          Mustache.render(templates.email.subject, viewData),
          Mustache.render(templates.email.body, viewData),
        )
      );
    }

    if (viewData.phone) {
      promises.push(
        sendSms(viewData.phone, Mustache.render(templates.sms, viewData))
      );
    }

    return promises;
  }));

  // run post-operation logic
  console.log('Sent all messages successfully');
};

