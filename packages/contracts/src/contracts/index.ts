import { initContract } from '@ts-rest/core';

import { analyticsContract } from './analytics.contract.js';
import { apiKeysContract } from './api-keys.contract.js';
import { authContract } from './auth.contract.js';
import { chatContract, streamChatBodySchema } from './chat.contract.js';
import { collectionsContract } from './collections.contract.js';
import { dataSourcesContract } from './data-sources.contract.js';
import { demoRequestContract } from './demo-request.contract.js';
import { integrationsContract } from './integrations.contract.js';
import { orgsContract } from './orgs.contract.js';
import { publicApiContract } from './public-api.contract.js';
import { sharedChatsContract } from './shared-chats.contract.js';
import { usersContract } from './users.contract.js';

const c = initContract();

export const contract = c.router({
  analytics: analyticsContract,
  auth: authContract,
  orgs: orgsContract,
  collections: collectionsContract,
  dataSources: dataSourcesContract,
  demoRequest: demoRequestContract,
  integrations: integrationsContract,
  chat: chatContract,
  sharedChats: sharedChatsContract,
  apiKeys: apiKeysContract,
  users: usersContract,
});

export {
  analyticsContract,
  apiKeysContract,
  authContract,
  chatContract,
  collectionsContract,
  dataSourcesContract,
  demoRequestContract,
  integrationsContract,
  orgsContract,
  publicApiContract,
  sharedChatsContract,
  streamChatBodySchema,
  usersContract,
};

export { type ChatSource, chatSourceSchema } from './chat.contract.js';
export { demoRequestBodySchema } from './demo-request.contract.js';
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
export {
  chatMessageSnapshotSchema,
  sharedChatSchema,
  sharedChatSnapshotSchema,
} from './shared-chats.contract.js';

export type Contract = typeof contract;
