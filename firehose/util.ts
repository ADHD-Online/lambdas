import {
  Schema,
  SchemaMode,
  SchemaType,
} from './types';

export const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const genSchema = (thing: any): Schema[] => Object.entries(thing).map(([k, v]) => {
  switch (typeof v) {
    case 'bigint':
    case 'function':
    case 'symbol':
    case 'undefined':
      throw new Error(`Can't generate schema for a '${typeof v}' (key: ${k})`);

    case 'object':
      // in js, `typeof null` returns 'object'
      // this is a historical language bug that may never be fixed
      if (v === null) {
        throw new Error(`Can't generate schema for a 'null'`);
      } else if (Array.isArray(v)) {
        return {
          name: k,
          type: 'RECORD',
          mode: 'REPEATED',
          fields: v.flatMap(genSchema),
        };
      } else {
        return {
          name: k,
          type: 'RECORD',
          fields: genSchema(v),
        };
      }

    case 'number':
      return {
        name: k,
        type: Number.isInteger(v) ? 'INTEGER' : 'FLOAT',
      };

    case 'boolean':
      return { name: k, type: 'BOOLEAN' };

    case 'string':
      return { name: k, type: 'STRING' };
  }
});

export const deduplicateFields = (schema: Schema[]) => {
  const model: Record<string, true> = {};

  const dedupHelper = (fields: Schema[], path: string) => fields.filter(field => {
    const subpath = path + '.' + field.name;
    if (subpath in model) {
      return false; // found a duplicate
    } else {
      model[subpath] = true;
      if ('fields' in field)
        field.fields = dedupHelper(field.fields, subpath);
      return true;
    }
  });

  return dedupHelper(schema, '');
};

