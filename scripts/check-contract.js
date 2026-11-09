import SwaggerParser from '@apidevtools/swagger-parser';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import assert from 'node:assert/strict';
import { frontendContract } from '../packages/contracts/frontend-openapi.js';
await SwaggerParser.validate(structuredClone(frontendContract));
for (const name of ['frontend-openapi.yaml', 'frontend-openapi.json'])
  assert.deepEqual(
    parse(readFileSync(new URL(`../packages/contracts/${name}`, import.meta.url), 'utf8')),
    frontendContract,
    `${name} is stale`,
  );
const frontendOperations = Object.values(frontendContract.paths).flatMap((item) =>
  Object.entries(item)
    .filter(([m]) => ['get', 'post', 'put', 'delete'].includes(m))
    .map(([, op]) => op.operationId),
);
assert.equal(new Set(frontendOperations).size, frontendOperations.length);
console.log(
  `Frontend draft valid; ${frontendOperations.length} operations (includes reserved backend-only callback).`,
);
