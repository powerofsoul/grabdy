import { initContract } from '@ts-rest/core';

import { analyticsContract } from './analytics.contract.js';
import { apiKeysContract } from './api-keys.contract.js';
import { authContract } from './auth.contract.js';
import { collectionsContract } from './collections.contract.js';
import { dataSourcesContract } from './data-sources.contract.js';
import { orgsContract } from './orgs.contract.js';
import { retrievalContract, streamChatBodySchema } from './retrieval.contract.js';
import { usersContract } from './users.contract.js';

const c = initContract();

export const contract = c.router({
  analytics: analyticsContract,
  auth: authContract,
  orgs: orgsContract,
  collections: collectionsContract,
  dataSources: dataSourcesContract,
  retrieval: retrievalContract,
  apiKeys: apiKeysContract,
  users: usersContract,
});

export {
  analyticsContract,
  apiKeysContract,
  authContract,
  collectionsContract,
  dataSourcesContract,
  orgsContract,
  retrievalContract,
  streamChatBodySchema,
  usersContract,
};

export type Contract = typeof contract;
