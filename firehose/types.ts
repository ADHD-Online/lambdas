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
  { N:    number                         } |
  { NS:   number[]                       } |
  { NULL: null                           } |
  { S:    string                         } |
  { SS:   string[]                       }
;
//@ts-ignore
export const AttributeValue: z.ZodType<AttributeValue> = z.lazy(() =>
  z.union([
    // base-64 encoded binary
    z.object({ B: z.string() }),
    // base-64 encoded binary set
    z.object({ BS: z.string().array() }),
    // boolean
    z.object({ BOOL:
      z.boolean().or(z.enum(['true', 'false']))
        .transform(b => Boolean(b))
    }),
    // list
    z.object({ L: AttributeValue.array() }),
    // map
    z.object({ M: z.record(z.string(), AttributeValue) }),
    // number
    z.object({ N:
      z.number().or(z.string())
        .transform(n => Number(n))
    }),
    // number set
    z.object({ NS:
      z.number().array().or(z.string().array())
        .transform(ns => ns.map((n: number | string) => Number(n)))
    }),
    // null
    z.object({ NULL: z.unknown().transform(() => null) }),
    // string
    z.object({ S: z.string() }),
    // string set
    z.object({ SS: z.string().array() }),
  ])
);

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_StreamRecord.html

export const StreamRecord = z.object({
  ApproximateCreationDateTime: z.number(),
  Keys: z.record(z.string(), AttributeValue),
  NewImage: z.record(z.string(), AttributeValue).optional(),
  OldImage: z.record(z.string(), AttributeValue).optional(),
  SequenceNumber: z.string(),
  SizeBytes: z.number(),
  StreamViewType: z.enum([
    'KEYS_ONLY',
    'NEW_IMAGE',
    'OLD_IMAGE',
    'NEW_AND_OLD_IMAGES',
  ]),
});
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
export const SchemaType = z.enum([
  'BIGNUMERIC',
  'BOOLEAN', 'BOOL',
  'BYTES',
  'DATE',
  'DATETIME',
  'FLOAT', 'FLOAT64',
  'GEOGRAPHY',
  'INTEGER', 'INT64',
  'NUMERIC',
  'RECORD', 'STRUCT',
  'STRING',
  'TIME',
  'TIMESTAMP',
]);
export type SchemaType = z.infer<typeof SchemaType>;

export const SchemaMode = z.enum(['NULLABLE', 'REPEATED', 'REQUIRED']);
export type SchemaMode = z.infer<typeof SchemaMode>;

export type Schema = {
  name: string;
  type?: SchemaType;
  mode?: SchemaMode;
  fields?: Schema[];
  description?: string;
  policyTags?: { names: string[] };
  maxLength?: number;
  precision?: number;
  scale?: number;
};
//@ts-ignore
export const Schema: z.ZodType<Schema> = z.lazy(() => z.object({
  name: z.string(),
  type: SchemaType.optional(),
  mode: SchemaMode.optional(),
  fields: Schema.array().optional(),
  description: z.string().optional(),
  policyTags: z.object({ names: z.string().array() }).optional(),
  maxLength: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
}));

