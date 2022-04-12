import { TableFieldSchema as Schema } from './types';

export const expectEnv = (key: string, message?: string) => {
  const val = process.env[key];
  if (!key)
    throw new Error(`Missing env variable ${key}: ` + message ?? '');
  return val;
};

export const genSchema = <T>(thing: T): Schema[] => Object.entries(thing).map(genSchemaHelper);

const genSchemaHelper = <T>([name, thing]: [string, T]): Schema => {
  switch (typeof thing) {
    case 'object':
      // in js, `typeof null` returns 'object'
      // this is a historical language bug that may never be fixed
      if (thing === null) {
        throw new Error(`Can't generate schema for a 'null'`);
      }

      let fields: Schema[], mode: 'REPEATED' | undefined;
      // if it's an array, add all possible fields
      if (Array.isArray(thing)) {
        fields = thing
          .map(t => genSchemaHelper(['unwrap_me', t]))
          .flatMap(t => t.fields)
        ;
        mode = 'REPEATED';
      } else {
        fields = Object.entries(thing).map(genSchemaHelper);
        mode = undefined;
      }
      return { name, type: 'RECORD', mode, fields };

    case 'boolean':
      return { name, type: 'BOOLEAN' };

    case 'number':
      return { name, type: 'NUMERIC' };

    case 'bigint':
      return { name, type: 'BIGNUMERIC' };

    case 'string':
      return { name, type: 'STRING' };

    case 'function':
    case 'symbol':
    case 'undefined':
    default:
      throw new Error(`Can't generate schema for a(n) '${typeof thing}'`);
  };
};

