import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import Mustache from 'mustache';
import { expectEnv, sendEmail, sendSms } from './util';
import {
  TableData,
  ScheduleInitialAppointmentReminderViewResult as ViewResult,
} from '@adhd-online/unified-types/messaging';

export const FLOW_KEY = 'messaging#ScheduleInitialAppointmentReminder';

export default async () => {
  const dynamoClient = new DynamoDBClient({ region: expectEnv('AWS_DEFAULT_REGION') });
  const gcpClient = null; //TODO

  const templates = await dynamoClient.send(new GetItemCommand({
    TableName: expectEnv('CONFIG_TABLE_NAME'),
    Key: { pk: { S: FLOW_KEY } },
  }));
  const { emailTemplate, smsTemplate } = TableData.parse(templates.Item);

  //TODO fetch results from data lake
  const results: ViewResult[] = [];

  // perform actions
  await Promise.all(results.flatMap(unparsedResult => {
    const result = ViewResult.parse(unparsedResult);
    const promises = [];

    if (result.email) {
      promises.push(
        sendEmail(result.email, Mustache.render(emailTemplate, result))
      );
    }

    if (result.phone) {
      promises.push(
        sendSms(result.phone, Mustache.render(smsTemplate, result))
      );
    }

    return promises;
  }));

  // run post-operation logic
  console.log('Sent all messages successfully');
};

