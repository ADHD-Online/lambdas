import path from 'path';
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { BigQuery } from '@google-cloud/bigquery';
import { ConfigTableData } from './types';

const SMS_SOFT_LIMIT_BYTES = 140;
const SMS_HARD_LIMIT_BYTES = 1600;

const DYNAMO_CLIENT = new DynamoDBClient({});
const SES_CLIENT = new SESClient({});
const SNS_CLIENT = new SNSClient({ region: 'us-east-1' });
const ENCODER = new TextEncoder();

export const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const STAGE = expectEnv('STAGE');

export const fetchView = (flowKey: string) => new BigQuery({
  projectId: expectEnv('GCP_PROJECT_ID'),
  keyFilename: process.env['GCP_KEYFILE_PATH'] ||
    path.join(__dirname, `gcp_keyfile/${STAGE}.json`)
  ,
})
  .dataset(expectEnv('GCP_DATASET_ID'))
  .table(flowKey)
  .getRows()
;

export const fetchConfig = async (flowKey: string) => {
  const res = await DYNAMO_CLIENT.send(new GetItemCommand({
    TableName: expectEnv('CONFIG_TABLE_NAME'),
    Key: { pk: { S: flowKey } },
  }));

  const configs = unmarshall(res.Item);

  if (STAGE !== 'prod') {
    ConfigTableData.parse(configs);
  }

  return configs;
};

export const sendEmail = ({ templateName, to, replacements }: {
  templateName: string;
  to: string;
  replacements: Record<string, string>;
}) => {
  console.log(`Sending email to ${to}...`);

  return SES_CLIENT.send(new SendTemplatedEmailCommand({
    ConfigurationSetName: expectEnv('SES_CONFIG_SET'),
    Source: expectEnv('SES_SOURCE_IDENTITY'),
    Destination: { ToAddresses: [to] },
    Template: templateName,
    TemplateData: JSON.stringify(replacements),
  }));
};

export const sendSms = (to: string, message: string) => {
  const len = ENCODER.encode(message).length;

  if (len > SMS_HARD_LIMIT_BYTES) {
    throw new Error(
      `Message of length ${len} bytes is longer than ${SMS_HARD_LIMIT_BYTES}-byte AWS SNS` +
      'hard limit'
    );
  } else if (len > SMS_SOFT_LIMIT_BYTES) {
    console.warn(
      `Message of length ${len} bytes is longer than ${SMS_SOFT_LIMIT_BYTES}-byte SMS ` +
      'message limit; will be split into approximately ' +
      `${Math.ceil(len / SMS_SOFT_LIMIT_BYTES)} SMS messages`
    );
  }

  console.log(`Sending sms to ${to}...`);

  return SNS_CLIENT.send(new PublishCommand({
    Message: message,
    PhoneNumber: to,
  }));
};

export const setNextSteps = (key: { pk: string, sk: string }, message: string) => {
  DYNAMO_CLIENT.send(new UpdateItemCommand({
    TableName: expectEnv('DATA_TABLE_NAME'),
    Key: {
      pk: { S: key.pk },
      sk: { S: key.sk },
    },
    UpdateExpression: 'SET metadata.nextStep = :m',
    ExpressionAttributeValues: { ':m': { 'S': message } },
  }));
};

