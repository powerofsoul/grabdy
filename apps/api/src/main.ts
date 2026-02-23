// Side-effect imports must be first — before any app code loads
import 'dotenv/config';
import 'reflect-metadata';

import { loadSsmParameters } from './config/ssm';
import { initTelemetry } from './telemetry/langfuse';

async function main() {
  // Populate process.env from SSM before any app modules evaluate env.config.ts.
  // In dev (no SSM_PREFIX), this is a no-op and .env values are already loaded above.
  await loadSsmParameters();

  // Initialize OpenTelemetry + Langfuse before any AI SDK calls
  initTelemetry();

  // Deferred require: env.config.ts (and all transitive imports) evaluate NOW,
  // after SSM has populated process.env. This is CJS, so require() is synchronous
  // and executes at call-time, not hoisted like ES import statements.
  const { bootstrap } = require('./bootstrap') as typeof import('./bootstrap');
  await bootstrap();
}

main();
