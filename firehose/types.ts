import { z } from 'zod';

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_AttributeValue.html

// unfortunately due to a limitation of typescript, recursive types
// can't be statically inferred
export type AttributeValue =
  { B:    string                         } |
  { BS:   string[]                       } |
  { BOOL: boolean                        } |
  { L:    AttributeValue[]               } |
  { M:    Record<string, AttributeValue> } |
  { N:    string                         } |
  { NS:   string[]                       } |
  { NULL: boolean                        } |
  { S:    string                         } |
  { SS:   string[]                       }
;
//@ts-ignore
export const AttributeValue: z.ZodType<AttributeValue> = z.lazy(() =>
  z.union([
    z.object({ B:    z.string()                           }),
    z.object({ BS:   z.string().array()                   }),
    z.object({ BOOL: z.boolean()                          }),
    z.object({ L:    AttributeValue.array()               }),
    z.object({ M:    z.record(z.string(), AttributeValue) }),
    z.object({ N:    z.string()                           }),
    z.object({ NS:   z.string().array()                   }),
    z.object({ NULL: z.boolean()                          }),
    z.object({ S:    z.string()                           }),
    z.object({ SS:   z.string().array()                   }),
  ])
);

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_StreamRecord.html

const StreamRecordBase = z.object({
  ApproximateCreationDateTime: z.number(),
  Keys: z.record(z.string(), AttributeValue),
  NewImage: z.record(z.string(), AttributeValue).optional(),
  OldImage: z.record(z.string(), AttributeValue).optional(),
  SequenceNumber: z.string(),
  SizeBytes: z.number(),
});
export const StreamRecord = z.union([
  StreamRecordBase.extend({ StreamViewType: z.literal('KEYS_ONLY') }),
  StreamRecordBase.extend({ StreamViewType: z.literal('NEW_IMAGE') }),
  StreamRecordBase.extend({ StreamViewType: z.literal('OLD_IMAGE') }),
  StreamRecordBase.extend({ StreamViewType: z.literal('NEW_AND_OLD_IMAGES') }),
]);
export type StreamRecord = z.infer<typeof StreamRecord>;

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_Record.html

export const DynamoDBRecord = z.object({
  awsRegion: z.string(),
  dynamodb: StreamRecord,
  eventID: z.string(),
  eventName: z.enum(['INSERT', 'MODIFY', 'REMOVE']),
  eventSource: z.string(),
  eventVersion: z.string(),
  userIdentity: z.object({
    PrincipalId: z.string(),
    Type: z.string(),
  }).optional(),
});
export type DynamoDBRecord = z.infer<typeof DynamoDBRecord>;

// https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html

export const DynamoDBStreamEvent = z.object({ Records: DynamoDBRecord.array() });
export type DynamoDBStreamEvent = z.infer<typeof DynamoDBStreamEvent>;

// https://cloud.google.com/bigquery/docs/reference/rest/v2/tables
export type TableFieldSchema = {
  name: string;
  type?:
    'BIGNUMERIC' |
    'BOOLEAN'    | 'BOOL'    |
    'BYTES'      |
    'DATE'       |
    'DATETIME'   |
    'FLOAT'      | 'FLOAT64' |
    'GEOGRAPHY'  |
    'INTEGER'    | 'INT64'   |
    'NUMERIC'    |
    'RECORD'     | 'STRUCT'  |
    'STRING'     |
    'TIME'       |
    'TIMESTAMP'
  ;
  mode?: 'NULLABLE' | 'REPEATED' | 'REQUIRED';
  fields?: TableFieldSchema[];
  description?: string;
  policyTags?: { names: string[] };
  maxLength?: number;
  precision?: number;
  scale?: number;
};
//@ts-ignore
export const TableFieldSchema: z.ZodType<TableFieldSchema> = z.lazy(() => z.object({
  name: z.string(),
  type: z.enum([
    'STRING',
    'BYTES',
    'INTEGER',    'INT64',
    'FLOAT',      'FLOAT64',
    'BOOLEAN',    'BOOL',
    'TIMESTAMP',
    'DATE',
    'TIME',
    'DATETIME',
    'GEOGRAPHY',
    'NUMERIC',
    'BIGNUMERIC',
    'RECORD',     'STRUCT',
  ]),
  mode: z.enum(['NULLABLE', 'REPEATED', 'REQUIRED']).optional(),
  fields: TableFieldSchema.array().optional(),
  description: z.string().optional(),
  policyTags: z.object({ names: z.string().array() }).optional(),
  maxLength: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
}));

