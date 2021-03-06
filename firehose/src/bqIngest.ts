import path from 'path';
import util from 'util';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { BigQuery, Table } from '@google-cloud/bigquery';
import {
  DynamoDBStreamEvent,
  Schema,
  StreamRecord,
} from './types';
import { expectEnv, genObjSchema } from './util';

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
      if (skSuffix === 'definition') {
        console.info('Omitting assessment definition record');
        return null; // omit this record
      }

      if (skSuffix === 'inFlight') {
        console.info('Omitting inFlight assessment record');
        return null; // omit this record
      }

      if (skSuffix === 'result')
        return `assessment_${skType}_results`;

      // else
      console.warn('Omitting unclassified record:', util.inspect(record, false, null));
      return null; // omit this record

    case jst(['patient', 'journey']):
      return 'journeys';

    case jst(['userProfile', 'patientGoalsDef']):
      return 'patientgoalsdefs';

    case jst(['userProfile', 'patient']):
      return 'patients';

    case jst(['userProfile', 'userProfile']):
      return 'userprofiles';

    default:
      console.warn('Omitting unclassified record:', util.inspect(record, false, null));
      return null; // omit this record
  }
};

export default async (event: DynamoDBStreamEvent) => {
  // validate and transform
  console.log(`Received ${event.Records.length} rows for ingestion`);

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
  for (const eventRecord of event.Records) {
    const streamRecord = eventRecord.dynamodb;
    const tableName = recordToTableName(streamRecord);

    // omit records that aren't given a name
    if (tableName === null)
      continue;

    if (!(tableName in tables)) {
      tables[tableName] = {
        client: dataset.table(tableName),
        queue: [],
      };
    }

    const table = tables[tableName];

    const recordWithMeta = {
      Keys: unmarshall(streamRecord.Keys as any),
      Metadata: {
        eventKind: eventRecord.eventName,
        processed: 0, // for bigquery internal etl
        timestamp: streamRecord.ApproximateCreationDateTime,
      },
    };

    if ('NewImage' in streamRecord)
      recordWithMeta['NewImage'] = unmarshall(streamRecord.NewImage as any);
    if ('OldImage' in streamRecord)
      recordWithMeta['OldImage'] = unmarshall(streamRecord.OldImage as any);

    if (!('schema' in table)) {
      table.schema = genObjSchema(recordWithMeta);

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

