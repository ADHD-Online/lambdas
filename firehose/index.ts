import path from 'path';
import { BigQuery, Table } from '@google-cloud/bigquery';
import {
  DynamoDBStreamEvent,
  StreamRecord,
  TableFieldSchema as Schema,
} from './types';
import { expectEnv, genSchema } from './util';

const STAGE = expectEnv('STAGE');

const debug = (...args: any[]) => {
  if (STAGE !== 'prod') { console.log(...args); }
};

const recordToTableName = (record: StreamRecord) => {
  const { pk, sk } = record.Keys;

  if (!pk || !sk) {
    throw new Error(
      'Expected record to have pk and sk, ' +
      `found pk: ${pk}, sk: ${sk}`
    );
  }

  if (!('S' in pk && 'S' in sk)) {
    throw new Error(
      `Expected pk and sk to have type 'S' (string), ` +
      `found pk: ${Object.keys(pk)[0]}, sk: ${Object.keys(sk)[0]}`
    );
  }

  const pkPrefix = pk.S.split('#')[0];
  const skSplit  = sk.S.split('#');
  const skPrefix = skSplit[0];
  const skSuffix = skSplit[skSplit.length - 1];
  const skType   = skSplit[1];
  const jst = JSON.stringify;

  debug(`--> Coords retrieved: [${pkPrefix}, ${skPrefix}, ${skSuffix}]`);

  switch (jst([pkPrefix, skPrefix])) {
    case jst(['patient', 'appointment']):
      return 'appointments';

    case jst(['patient', 'assessment']):
      if (skSuffix === 'definition')
        return `assessment_${skType}_definitions`;

      else if (skSuffix === 'inFlight')
        return `assessment_${skType}_inflights`;

      else if (skSuffix === 'result')
        return `assessment_${skType}_results`;

      else
        console.error('Could not classify record:', record);
        throw new Error(`Could not classify record: (pk: ${pk.S}, sk: ${sk.S})`);

    case jst(['patient', 'journey']):
      return 'journeys';

    case jst(['userProfile', 'patientGoalsDef']):
      return 'patientgoalsdefs';

    case jst(['userProfile', 'patient']):
      return 'patients';

    case jst(['userProfile', 'userProfile']):
      return 'userprofiles';

    default:
      console.error('Could not classify record:', record);
      throw new Error(`Could not classify record: (pk: ${pk.S}, sk: ${sk.S})`);
  }
};

export const handler = async (event: DynamoDBStreamEvent) => {
  if (STAGE !== 'prod') {
    // validate for errors
    DynamoDBStreamEvent.parse(event);

    console.log(`Received ${event.Records.length} rows for ingestion`);
  }

  const dataset = new BigQuery({
    projectId: expectEnv('GCP_PROJECT_ID'),
    keyFilename: path.join(__dirname, `gcp_keyfile/${STAGE}.json`),
  })
    .dataset(expectEnv('GCP_DATASET_ID'))
  ;

  const tables: Record<string, {
    client: Table,
    queue: any[],
    schema?: Schema[],
  }> = {};

  // sort rows for ingestion
  for (const eventRecord of event.Records) {
    const streamRecord = eventRecord.dynamodb;
    const tableName = recordToTableName(streamRecord);

    if (!(tableName in tables)) {
      tables[tableName] = {
        client: dataset.table(tableName),
        queue: [],
      };
    }

    const table = tables[tableName];

    const recordWithMeta = {
      Item: streamRecord.NewImage,
      Metadata: {
        eventKind: eventRecord.eventName,
        timestamp: streamRecord.ApproximateCreationDateTime,
      },
    };

    if (!('schema' in table)) {
      table.schema = genSchema(recordWithMeta);

      debug(`Generated schema for ${tableName}:`, table.schema);

      // validate for errors
      if (STAGE !== 'prod') {
        for (const s of table.schema) {
          Schema.parse(s);
        }
      }
    }

    debug(
      'Inserting into' +
      ` ${expectEnv('GCP_PROJECT_ID')}` +
      `/${expectEnv('GCP_DATASET_ID')}` +
      `/${tableName}:`,
      recordWithMeta,
    );

    table.queue.push(recordWithMeta);
  }

  // ingest
  const promises = [];
  for (const [name, table] of Object.entries(tables)) {
    if (table.queue.length <= 0)
      continue;

    console.log(`Begin bulk ingest for ${name}`);
    promises.push(table.client.insert(table.queue, { schema: table.schema }));
  }

  await Promise.all(promises)
    .catch(reason => console.error('Failed to insert:', reason))
  ;

  const count = Object.values(tables).reduce((a, table) => a + table.queue.length, 0);
  console.log(`Successfully ingested ${count} rows`);
}

