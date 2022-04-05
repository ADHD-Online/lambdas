import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { DynamoDBStreamEvent, StreamRecord } from '@adhd-online/unified-types/external/dynamodb/events';
import { TableFieldSchema as Schema } from '@adhd-online/unified-types/external/bigquery/table';
import { expectEnv, genSchema } from './util';

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
  const skSuffix = skSplit.at(-1);
  const skType   = skSplit[1];

  switch ([pkPrefix, skPrefix, skSuffix]) {
    case ['patient', 'appointment']:
      return 'appointments';

    case ['patient', 'assessment', 'definition']:
      return `assessment_${skType}_definitions`;

    case ['patient', 'assessment', 'inFlight']:
      return `assessment_${skType}_inflights`;

    case ['patient', 'assessment', 'result']:
      return `assessment_${skType}_results`;

    case ['patient', 'journey']:
      return 'journeys';

    case ['userProfile', 'patientGoalsDef']:
      return 'patientgoalsdefs';

    case ['userProfile', 'patient']:
      return 'patients';

    case ['userProfile', 'userProfile']:
      return 'userprofiles';

    default:
      console.error('Could not classify record:', record);
      throw new Error(`Could not classify record: (pk: ${pk.S}, sk: ${sk.S})`);
  }
};

const STAGE = expectEnv('STAGE');

export const handler = async (event: DynamoDBStreamEvent) => {
  if (STAGE !== 'prod') {
    // validate for errors
    try {
      DynamoDBStreamEvent.parse(event);
    } catch (e) {
      console.error(`Failed to parse event: ${'message' in e ? e.message : e}`);
    }

    const rowCount = event.Records.reduce((a, rec) => a + rec.dynamodb.length, 0);
    console.log(`Received ${rowCount} rows for ingestion`);
  }

  const dataset = new BigQuery({
    projectId: expectEnv('GCP_PROJECT_ID'),
    keyFilename: path.join(__dirname, `gcp_keyfile/${expectEnv('STAGE')}.json`),
  })
    .dataset(expectEnv('GCP_DATASET_ID'))
  ;

  const tableClients = {};
  const tableQueues = {};

  // sort rows for ingestion
  for (const eventRecord of event.Records) {
    for (const streamRecord of eventRecord.dynamodb) {
      const tableName = recordToTableName(streamRecord);

      // create (client for) table, if it hasn't been made yet
      if (!(tableName in tableClients)) {
        tableClients[tableName] = dataset.table(tableName);

        if (!(await tableClients[tableName].exists())) {
          await dataset.createTable(tableName, {});
        }
      }

      // retrieve queue for table, or create one if it dosn't exist
      let tableQueue = tableQueues[tableName] = tableQueues[tableName] ?? [];

      const recordWithMeta = {
        Item: streamRecord.NewImage,
        Metadata: {
          eventKind: eventRecord.eventName,
          timestamp: streamRecord.ApproximateCreationDateTime,
        },
      };

      const schema = genSchema(['Item', recordWithMeta]);

      if (STAGE !== 'prod') {
        // validate for errors
        try {
          Schema.parse(schema);
        } catch (e) {
          console.error(`Failed to validate schema: ${'message' in e ? e.message : e}`);
        }
      }

      tableQueue.push([recordWithMeta, { schema }]);
    }
  }

  // ingest
  const promises = [];
  for (const tableName of Object.keys(tableClients)) {
    promises.push(tableClients[tableName].insert(...tableQueues[tableName]));
  }

  await Promise.all(promises);

  const count = Object.values(tableQueues).reduce((a: number, q: any[]) => a + q.length, 0);
  console.log(`Successfully ingested ${count} rows`);
}

