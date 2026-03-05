import { initContract } from '@ts-rest/core';

import { analyticsContract } from './analytics.contract.js';
import { authContract } from './auth.contract.js';
import { billingContract } from './billing.contract.js';
import { chatContract, streamChatBodySchema } from './chat.contract.js';
import { collectionsContract } from './collections.contract.js';
import { dataSourcesContract } from './data-sources.contract.js';
import { demoRequestContract } from './demo-request.contract.js';
import { orgsContract } from './orgs.contract.js';
import { sharedChatsContract } from './shared-chats.contract.js';
import { usersContract } from './users.contract.js';

const c = initContract();

export const contract = c.router({
  analytics: analyticsContract,
  auth: authContract,
  billing: billingContract,
  orgs: orgsContract,
  collections: collectionsContract,
  dataSources: dataSourcesContract,
  demoRequest: demoRequestContract,
  chat: chatContract,
  sharedChats: sharedChatsContract,
  users: usersContract,
});

export {
  analyticsContract,
  authContract,
  billingContract,
  chatContract,
  collectionsContract,
  dataSourcesContract,
  demoRequestContract,
  orgsContract,
  sharedChatsContract,
  streamChatBodySchema,
  usersContract,
};

export {
  type DataSourceConfig,
  type DataSourceConfigEntry,
  dataSourceConfigEntrySchema,
  dataSourceConfigSchema,
} from './chat.contract.js';
export { type ChatSource, chatSourceSchema } from './chat.contract.js';
export { type SseMetaEvent, sseMetaEventSchema, type StreamChunk } from './chat.contract.js';
export { demoRequestBodySchema } from './demo-request.contract.js';
export { sharedChatSchema, sharedChatSnapshotSchema } from './shared-chats.contract.js';
