// Side-effect imports must be first — before any app code loads
import 'dotenv/config';
import 'reflect-metadata';

import { loadSsmParameters } from './config/ssm';

async function main() {
  await loadSsmParameters();

  const { bootstrapWorker } = require('./bootstrap-worker') as typeof import('./bootstrap-worker');
  await bootstrapWorker();
}

main();
