import { TableFieldSchema as Schema } from '@adhd-online/unified-types/external/bigquery/table';
export const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const genSchema = <T>([name, thing]: [string, T]): Schema => {
  switch (typeof thing) {
    case 'object':
      return {
        name,
        type: 'RECORD',
        mode: Array.isArray(thing) ? 'REPEATED' : undefined,
        fields: Object.entries(thing).flatMap(genSchema),
      };
    case 'boolean':
      return {
        name,
        type: 'BOOLEAN',
      };
    case 'number':
      return {
        name,
        type: 'NUMERIC',
      };
    case 'bigint':
      return {
        name,
        type: 'BIGNUMERIC',
      };
    case 'string':
      return {
        name,
        type: 'STRING',
      };
    case 'function':
    case 'symbol':
    case 'undefined':
    default:
      throw new Error(`Can't generate schema for a(n) ${typeof thing}`);
  };
};

