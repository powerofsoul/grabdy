import { initContract } from '@ts-rest/core';

import { analyticsContract } from './analytics.contract.js';
import { apiKeysContract } from './api-keys.contract.js';
import { authContract } from './auth.contract.js';
import { collectionsContract } from './collections.contract.js';
import { dataSourcesContract } from './data-sources.contract.js';
import { integrationsContract } from './integrations.contract.js';
import { orgsContract } from './orgs.contract.js';
import { publicApiContract } from './public-api.contract.js';
import { retrievalContract, streamChatBodySchema } from './retrieval.contract.js';
import { usersContract } from './users.contract.js';
import { waitlistContract } from './waitlist.contract.js';

const c = initContract();

export const contract = c.router({
  analytics: analyticsContract,
  auth: authContract,
  orgs: orgsContract,
  collections: collectionsContract,
  dataSources: dataSourcesContract,
  integrations: integrationsContract,
  retrieval: retrievalContract,
  apiKeys: apiKeysContract,
  users: usersContract,
  waitlist: waitlistContract,
});

export {
  analyticsContract,
  apiKeysContract,
  authContract,
  collectionsContract,
  dataSourcesContract,
  integrationsContract,
  orgsContract,
  publicApiContract,
  retrievalContract,
  streamChatBodySchema,
  usersContract,
  waitlistContract,
};

export {
  listCollectionsResponseSchema,
  publicApiErrorSchema,
  publicCollectionSchema,
  publicSourceSchema,
  queryBodySchema,
  queryResponseSchema,
  searchBodySchema,
  searchResponseSchema,
} from './public-api.contract.js';
export { type ChatSource, chatSourceSchema } from './retrieval.contract.js';

export type Contract = typeof contract;
