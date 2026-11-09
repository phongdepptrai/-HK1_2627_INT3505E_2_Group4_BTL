import { writeFileSync, mkdirSync } from 'node:fs';
import { stringify } from 'yaml';
import { frontendContract } from '../packages/contracts/frontend-openapi.js';
mkdirSync(new URL('../packages/contracts/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../packages/contracts/frontend-openapi.yaml', import.meta.url),
  '# Generated from frontend-openapi.js\n' +
    stringify(JSON.parse(JSON.stringify(frontendContract))),
);
writeFileSync(
  new URL('../packages/contracts/frontend-openapi.json', import.meta.url),
  JSON.stringify(frontendContract, null, 2) + '\n',
);
console.log('Exported frontend handoff OpenAPI YAML + JSON (backend not implemented).');
