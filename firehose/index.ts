import path from 'path';
import util from 'util';
import { BigQuery, Table } from '@google-cloud/bigquery';
import {
  DynamoDBStreamEvent,
  Schema,
  StreamRecord,
} from './types';
import { expectEnv, genSchema } from './util';

const STAGE = expectEnv('STAGE');

const debug = (...args: any[]) => {
  if (STAGE !== 'prod') { console.log(...args); }
};

const debugError = (...args: any[]) => {
  if (STAGE !== 'prod') { console.error(...args); }
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
        debugError('Could not classify record:', util.inspect(record, false, null));
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
      debugError('Could not classify record:', util.inspect(record, false, null));
      throw new Error(`Could not classify record: (pk: ${pk.S}, sk: ${sk.S})`);
  }
};

export const handler = async (event: DynamoDBStreamEvent) => {
  // validate and transform
  const event_ = DynamoDBStreamEvent.parse(event);
  console.log(`Received ${event_.Records.length} rows for ingestion`);

  const dataset = new BigQuery({
    projectId: expectEnv('GCP_PROJECT_ID'),
    keyFilename: process.env['GCP_KEYFILE_PATH'] ||
      path.join(__dirname, `gcp_keyfile/${STAGE}.json`)
    ,
  })
    .dataset(expectEnv('GCP_DATASET_ID'))
  ;

  const tables: Record<string, {
    client: Table,
    queue: any[],
    schema?: Schema[],
  }> = {};

  // sort rows for ingestion
  for (const eventRecord of event_.Records) {
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
      Keys: streamRecord.Keys,
      Metadata: {
        eventKind: eventRecord.eventName,
        timestamp: streamRecord.ApproximateCreationDateTime,
      },
    };

    if ('NewImage' in streamRecord)
      recordWithMeta['NewImage'] = streamRecord.NewImage;
    if ('OldImage' in streamRecord)
      recordWithMeta['OldImage'] = streamRecord.OldImage;

    if (!('schema' in table)) {
      table.schema = genSchema(recordWithMeta);

      debug(`Generated schema for ${tableName}:`, util.inspect(table.schema, false, null));

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
      util.inspect(recordWithMeta, false, null),
    );

    table.queue.push(recordWithMeta);
  }

  // ingest
  const promises = [];
  for (const [name, table] of Object.entries(tables)) {
    if (table.queue.length <= 0)
      continue;

    console.log(`Begin bulk ingest for ${name}`);
    promises.push(table.client.insert(table.queue, {
      ignoreUnknownValues: true,
      schema: table.schema,
    }));
  }

  await Promise.all(promises);

  const count = Object.values(tables).reduce((a, table) => a + table.queue.length, 0);
  console.log(`Successfully ingested ${count} rows`);
}

