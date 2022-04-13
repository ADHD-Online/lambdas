import { Schema } from './types';

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
        const names: Record<string, true> = {};
        const fields = v
          .flatMap(genSchema)
          .filter(field => {
            // bigquery column names are case insensitive
            const name = field.name.toLowerCase();
            if (name in names)
              return false;
            else
              return names[name] = true;
          })
        ;

        return {
          name: k,
          type: 'RECORD',
          mode: 'REPEATED',
          fields: fields.length > 0
            ? fields
            // default if list is empty
            : [{ name: '_AUTODETECT_EMPTY_LIST', type: 'BOOLEAN' }]
          ,
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

