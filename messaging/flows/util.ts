import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const SES_CLIENT = new SESClient({});
const SNS_CLIENT = new SNSClient({ region: 'us-east-1' });
const ENCODER = new TextEncoder();

export const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const sendEmail = (
  to: string,
  subject: string,
  message: string,
) => {
  const len = ENCODER.encode(message).length;

  if (len > 10_000_000) {
    throw new Error(
      `Message of length ${len} bytes is longer than 10MB AWS SNS hard limit`
    );
  }

  console.log(`Sending email to ${to}...`);

  return SES_CLIENT.send(new SendEmailCommand({
    Source: expectEnv('EMAIL_SOURCE_ADDRESS'),
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: message, Charset: 'UTF-8' } },
    },
  }));
};

export const sendSms = (to: string, message: string) => {
  const len = ENCODER.encode(message).length;

  if (len > 1600) {
    throw new Error(
      `Message of length ${len} bytes is longer than 1600-byte AWS SNS` +
      'hard limit'
    );
  } else if (len > 140) {
    console.warn(
      `Message of length ${len} bytes is longer than 140-byte SMS ` +
      'message limit; will be split into approximately ' +
      `${Math.ceil(len / 140)} SMS messages`
    );
  }

  console.log(`Sending sms to ${to}...`);

  return SNS_CLIENT.send(new PublishCommand({
    Message: message,
    PhoneNumber: to,
  }));
};

