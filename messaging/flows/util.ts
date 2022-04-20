import path from 'path';
import { z, ZodType } from 'zod';
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
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

export const fetchDemoView = async (auth0Id: string, ViewData: ZodType) => {
  const DATA_TABLE_NAME = expectEnv('DATA_TABLE_NAME');
  const rows = await DYNAMO_CLIENT.send(
    new QueryCommand({
      TableName: DATA_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: `userProfile#${auth0Id}` },
      },
    }),
  )
    .then(res => res.Items)
  ;

  const account = rows.find(row => row.sk.S.toUpperCase().includes('USERPROFILE'));
  const patient = rows.find(row =>
    row.sk.S.toUpperCase().includes('PATIENT') &&
    row.type.S === 'self'
  );

  // this has to be a second query because the sk contains a patient id,
  // which is unknown at the time of the first query
  const moreRows = await DYNAMO_CLIENT.send(
    new QueryCommand({
      TableName: DATA_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': patient.sk,
      },
    })
  )
    .then(res => res.Items)
  ;

  const assessment = moreRows.find(row => row.sk.S.toUpperCase().includes('ASSESSMENT'));

  return [ViewData.parse({
    patientRecordKey: {
      pk: patient.pk.S,
      sk: patient.sk.S,
    },
    email: account.emailAddress.S,
    phone: account.phoneNumber.S,
    // F90 is the code for a positive adhd diagnosis
    apptType: assessment.metadata.M.findings.M.summary.S.includes('F90')
      ? 'Med Management'
      : 'TeleTherapy'
    ,
    year: '' + new Date().getFullYear(),
    firstName: patient.firstName.S,
  })];
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

