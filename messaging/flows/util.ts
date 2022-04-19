import path from 'path';
import { z, ZodType } from 'zod';
import {
  DynamoDBClient,
  BatchGetItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { BigQuery } from '@google-cloud/bigquery';
import parsePhoneNumber from 'libphonenumber-js';
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

export const fetchViewBq = (flowKey: string) => new BigQuery({
  projectId: expectEnv('GCP_PROJECT_ID'),
  keyFilename: process.env['GCP_KEYFILE_PATH'] ||
    path.join(__dirname, `gcp_keyfile/${STAGE}.json`)
  ,
})
  .dataset(expectEnv('GCP_DATASET_ID'))
  .table(flowKey)
  .getRows()
;

export const fetchDemoView = async (ViewData: ZodType) => {
  const DATA_TABLE_NAME = expectEnv('DATA_TABLE_NAME');
  const [profile, assessment] = await DYNAMO_CLIENT.send(
    new BatchGetItemCommand({
      RequestItems: {
        [DATA_TABLE_NAME]: {
          Keys: [
            {
              pk: { S: 'userProfile#auth0|61e88854d90f5c0071ccdc14' },
              sk: { S: 'userProfile#auth0|61e88854d90f5c0071ccdc14' },
            }, {
              pk: { S: 'patient#01FST5BXHKP8C1XBM20VT8YNN7' },
              sk: { S: 'assessment#adhd#5709415540947815576589817006250105534990275433135759978277#result' },
            },
          ],
        },
      },
    }),
  )
    .then(res => res.Responses[DATA_TABLE_NAME])
  ;

  return [{
    patientRecordKey: {
      pk: 'userProfile#auth0|61e88854d90f5c0071ccdc14',
      sk: 'patient#01FST5BXHKP8C1XBM20VT8YNN7',
    },
    email: profile.emailAddress.S,
    phone: profile.phoneNumber.S,
    apptType: assessment.metadata.M.findings.M.summary.S.match(/attention.*deficit/i)
      ? 'Med Management'
      : 'TeleTherapy'
    ,
    year: new Date().getFullYear(),
    firstName: profile.firstName.S,
  }] as z.infer<typeof ViewData>[];
};

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

export const sendEmail = async ({ templateName, to, replacements }: {
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
  }))
    .then(res => {
      if (STAGE !== 'prod') {
        console.debug('SES Publish result:', res);
      }
    })
  ;
};

export const sendSms = async (to: string, message: string) => {
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

  const phone = parsePhoneNumber(to, 'US');
  console.log(`Sending sms to ${phone.number}...`);

  return SNS_CLIENT.send(new PublishCommand({
    Message: message,
    PhoneNumber: phone.number,
  }))
    .then(res => {
      if (STAGE !== 'prod') {
        console.debug('SMS Publish result:', res);
      }
    })
  ;
};

export const setNextSteps = async (key: { pk: string, sk: string }, message: string) => {
  const metadata = await DYNAMO_CLIENT.send(new GetItemCommand({
    TableName: expectEnv('DATA_TABLE_NAME'),
    Key: {
      pk: { S: key.pk },
      sk: { S: key.sk },
    },
    ProjectionExpression: 'metadata',
  }));

  let commandInput: UpdateItemCommandInput = {
    TableName: expectEnv('DATA_TABLE_NAME'),
    Key: {
      pk: { S: key.pk },
      sk: { S: key.sk },
    },
  };
  if (Object.keys(metadata.Item).length > 0) {
    Object.assign(commandInput, {
      UpdateExpression: 'SET metadata.nextStep = :m',
      ExpressionAttributeValues: { ':m': { 'S': message } },
    });
  } else {
    Object.assign(commandInput, {
      UpdateExpression: 'SET metadata = :md',
      ExpressionAttributeValues: { ':md': { 'M': { 'nextStep' : { 'S': message } } } },
    });
  }

  return DYNAMO_CLIENT.send(new UpdateItemCommand(commandInput))
    .then(res => {
      if (STAGE !== 'prod') {
        console.debug('Next Steps publish result:', res);
      }
    })
  ;
};

