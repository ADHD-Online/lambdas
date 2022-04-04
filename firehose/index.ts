import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { DynamoDBStreamEvent, StreamRecord } from '@adhd-online/unified-types/external/dynamodb/events';
import { TableFieldSchema as Schema } from '@adhd-online/unified-types/external/bigquery/table';
import { expectEnv, genSchema } from './util';

const recordToTableName = (record: StreamRecord) => {
  if (
    record.StreamViewType === 'NEW_IMAGE' ||
    record.StreamViewType === 'NEW_AND_OLD_IMAGES'
  ) {
    const pk = record.NewImage.pk;
    const sk = record.NewImage.sk;

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
  } else {
    throw new Error(
      `Stream view type must be NEW_AND_OLD_IMAGES, ` +
      `however it is ${record.StreamViewType}`
    );
  }
};

export const handler = async (event: DynamoDBStreamEvent) => {
  if (expectEnv('STAGE') != 'prod') {
    // validate for errors
    try {
      DynamoDBStreamEvent.parse(event);
    } catch (e) {
      console.error(`Failed to parse event: ${'message' in e ? e.message : e}`);
    }
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
        ...streamRecord,
        metadata: {
          eventName: eventRecord.eventName,
          timestamp: streamRecord.ApproximateCreationDateTime,
        },
      };

      const schema = genSchema(['Item', recordWithMeta]);
      if (expectEnv('STAGE') != 'prod') {
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
  console.log(`Bigquery successfully ingested ${count} rows`);
}

