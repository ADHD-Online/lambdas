import Mustache from 'mustache';
import { ZodType } from 'zod';
import {
  fetchConfig,
  sendEmail,
  sendSms,
  setNextSteps,
} from './util';

export interface ViewData {
  patientRecordKey: {
    pk: string;
    sk: string;
  };
  email?: string;
  phone?: string;
}

export default <T extends ViewData>({
  flowKey,
  source,
}: {
  flowKey: string;
  source: () => Promise<T[]>;
}) => async () => {
  const [configs, views] = await Promise.all([
    fetchConfig(`messaging#${flowKey}`),
    source(),
  ]);

  // perform actions
  await Promise.all(views.flatMap(view => {
    const { templates } = configs;
    const promises = [];

    if (view.email) {
      promises.push(sendEmail({
        templateName: flowKey,
        to: view.email,
        replacements: {
          ...view,
          year: '' + new Date().getFullYear(),
        } as unknown as Record<string, string>,
      }));
    }

    if (view.phone) {
      promises.push(
        sendSms(view.phone, Mustache.render(templates.sms, view))
      );
    }

    promises.push(setNextSteps(
      view.patientRecordKey,
      Mustache.render(templates.nextSteps, view),
    ));

    return promises;
  }));

  // run post-operation logic
  console.log('Sent all messages successfully');
};

