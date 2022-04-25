import { Schema } from './types';

export const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const genObjSchema = (o: object): Schema[] =>
  Object.entries(o).flatMap(kv => genSchema(...kv).fields)
;

export const genSchema = (k: string, v: any): Schema => {
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

      // process array
      } else if (Array.isArray(v)) {
        const allSchemas = v.map((elem, i) => genSchema('' + i, elem));

        // disallow mixed types (allow heterogeneous object types)
        const type = allSchemas
          .map(s => s.type)
          .reduce((a, s) => a === s ? a : null)
        ;
        if (type === null) {
          throw new Error('Array cannot have mixed types');
        }

        const schema: Schema = {
          name: k,
          type,
          mode: 'REPEATED',
        };
        if (type === 'RECORD') {
          schema.fields = allSchemas.flatMap(s => s.fields);
        }

        return schema;

      // process pojo
      } else {
        return {
          name: k,
          type: 'RECORD',
          fields: genObjSchema(v),
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
};

