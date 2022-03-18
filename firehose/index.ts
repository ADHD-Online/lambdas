import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import type { DynamoDBStreamEvent } from 'aws-lambda';

const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const handler = (event: DynamoDBStreamEvent) => new BigQuery({
  projectId: expectEnv('GCP_PROJECT_ID'),
  keyFilename: path.join(__dirname, 'gcp_keyfile.json'),
})
  .dataset(expectEnv('GCP_DATASET_ID'))
  .table(expectEnv('GCP_TABLE_ID'))
  .insert(event.Records)
;

