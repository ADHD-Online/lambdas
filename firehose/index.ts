import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { DynamoDBStreamEvent } from '@adhd-online/unified-types/external/dynamodb/events';

const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const handler = (event: DynamoDBStreamEvent) => {
  const event_ = DynamoDBStreamEvent.parse(event);

  console.log('Started lambda');

  const client = new BigQuery({
    projectId: expectEnv('GCP_PROJECT_ID'),
    keyFilename: path.join(__dirname, `gcp_keyfile/${expectEnv('STAGE')}.json`),
  })
    .dataset(expectEnv('GCP_DATASET_ID'))
    .table(expectEnv('GCP_TABLE_ID'))
  ;

  console.log('Created BigQuery client without issue');

  //client.insert(event_.Records);
}

