import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import Mustache from 'mustache';
import { expectEnv } from './util';
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
  let success = true;
  await Promise.all(results.map(async unparsedResult => {
    const result = ViewResult.parse(unparsedResult);

    if (result.email) {
      console.log(`Sending email to ${result.email}`);
      const message = Mustache.render(emailTemplate, result);

      //TODO send message to SES
      //     if failed, update success variable
    }

    if (result.phone) {
      console.log(`Sending sms to ${result.phone}`);
      const message = Mustache.render(smsTemplate, result);

      //TODO send message to SNS
      //     if failed, update success variable
    }
  }));

  // run post-operation logic
  if (success)
    console.log('Sent all messages successfully');
  else
    console.log('Sent all messages with some errors');
};

