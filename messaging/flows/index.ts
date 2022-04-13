import Mustache from 'mustache';
import { ZodType } from 'zod';
import { fetchConfig, fetchView, sendEmail, sendSms } from './util';

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
      promises.push(
        sendEmail(
          view.email,
          Mustache.render(templates.email.subject, view),
          Mustache.render(templates.email.body, view),
        )
      );
    }

    if (view.phone) {
      promises.push(
        sendSms(view.phone, Mustache.render(templates.sms, view))
      );
    }

    return promises;
  }));

  // run post-operation logic
  console.log('Sent all messages successfully');
};

