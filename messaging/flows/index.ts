import Mustache from 'mustache';
import { ZodType } from 'zod';
import {
  fetchConfig,
  fetchView,
  sendEmail,
  sendSms,
  setNextSteps,
} from './util';

export default (flowKey: string, viewParser: ZodType) => async () => {
  const [configs, views] = await Promise.all([
    fetchConfig(`messaging#${flowKey}`),
    fetchView(flowKey).then(views => views.map((view: any) => viewParser.parse(view))),
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
        },
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

