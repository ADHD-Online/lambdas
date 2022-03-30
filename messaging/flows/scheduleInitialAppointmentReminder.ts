import {
  ScheduleInitialAppointmentReminderViewResult as ViewResult,
} from '@adhd-online/unified-types/schema/views';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

export const FLOW_KEY = 'ScheduleInitialAppointmentReminder';

export default async () => {
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION });
  //TODO fetch data from data lake
  const results: ViewResult[] = [];

  const { emailTemplate, smsTemplate } = await dynamoClient.send(new GetItemCommand({
    Key: { 'flow': FLOW_KEY },
  }));
};

