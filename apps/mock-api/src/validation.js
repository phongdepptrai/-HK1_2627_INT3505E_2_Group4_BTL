import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contract } from '../../../packages/contracts/openapi.js';

export const schemaRoot = { $id: 'urn:keosan:contract', components: contract.components };
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(schemaRoot);
const validators = new Map();
export function validateSchema(schema, data) {
  const key = JSON.stringify(schema);
  if (!validators.has(key))
    validators.set(
      key,
      ajv.compile({
        ...schema,
        ...(schema.$ref ? { $ref: `urn:keosan:contract${schema.$ref}` } : {}),
      }),
    );
  const validate = validators.get(key);
  const valid = validate(data);
  return {
    valid,
    errors: (validate.errors || []).map((error) => ({
      field:
        error.instancePath ||
        error.params.missingProperty ||
        error.params.additionalProperty ||
        '/',
      message: error.message,
    })),
  };
}
