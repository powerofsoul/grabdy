// Side-effect imports must be first — before any app code loads
import 'dotenv/config';
import 'reflect-metadata';

import { loadSsmParameters } from './config/ssm';

async function main() {
  // Populate process.env from SSM before any app modules evaluate env.config.ts.
  // In dev (no SSM_PREFIX), this is a no-op and .env values are already loaded above.
  await loadSsmParameters();

  // Deferred require: env.config.ts (and all transitive imports) evaluate NOW,
  // after SSM has populated process.env. This is CJS, so require() is synchronous
  // and executes at call-time, not hoisted like ES import statements.
  const { bootstrap } = require('./bootstrap') as typeof import('./bootstrap');
  await bootstrap();
}

main();
