import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const availableRepoSchema = z.object({
  id: z.number(),
  fullName: z.string(),
  name: z.string(),
  owner: z.string(),
  language: z.string().nullable(),
  size: z.number(),
  isPrivate: z.boolean(),
  defaultBranch: z.string(),
  updatedAt: z.string().nullable(),
});

const indexingStatusSchema = z.object({
  dataSourceId: dbIdSchema('DataSource'),
  repoFullName: z.string(),
  branch: z.string(),
  status: z.enum(['PROCESSING', 'READY', 'FAILED']),
  totalFiles: z.number(),
  processedFiles: z.number(),
  lastCommitSha: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const docVersionSchema = z.object({
  id: dbIdSchema('CodeRepoDoc'),
  commitSha: z.string(),
  version: z.number(),
  createdAt: z.string(),
});

const diffLineSchema = z.object({
  type: z.enum(['addition', 'deletion', 'unchanged']),
  content: z.string(),
  lineNumber: z.number().nullable(),
});

// Doc pages schemas
const docPageSummarySchema = z.object({
  id: dbIdSchema('DocPage'),
  parentId: dbIdSchema('DocPage').nullable(),
  title: z.string(),
  slug: z.string(),
  sortOrder: z.number(),
  isUserEdited: z.boolean(),
  version: z.number(),
});

const docPageDetailSchema = docPageSummarySchema.extend({
  content: z.string(),
  commitSha: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const docPageVersionSchema = z.object({
  id: dbIdSchema('DocPageVersion'),
  commitSha: z.string().nullable(),
  source: z.enum(['AI', 'USER']),
  version: z.number(),
  createdAt: z.string(),
});

const docPageVersionDetailSchema = docPageVersionSchema.extend({
  content: z.string(),
});

const repoDocsSchema = z.object({
  content: z.string(),
  commitSha: z.string(),
  version: z.number(),
  createdAt: z.string(),
});

export type AvailableRepo = z.infer<typeof availableRepoSchema>;
export type RepoDocs = z.infer<typeof repoDocsSchema>;
export type IndexingStatus = z.infer<typeof indexingStatusSchema>;
export type DocVersion = z.infer<typeof docVersionSchema>;
export type DocPageSummary = z.infer<typeof docPageSummarySchema>;
export type DocPageDetail = z.infer<typeof docPageDetailSchema>;
export type DocPageVersion = z.infer<typeof docPageVersionSchema>;
export type DocPageVersionDetail = z.infer<typeof docPageVersionDetailSchema>;

export const codeReposContract = c.router(
  {
    listAvailableRepos: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/available',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(availableRepoSchema),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    startIndexing: {
      method: 'POST',
      path: '/orgs/:orgId/code-repos/index',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        repoFullName: z.string().min(1, 'Repository name is required'),
        collectionId: dbIdSchema('Collection').optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: indexingStatusSchema,
        }),
        400: z.object({ success: z.literal(false), error: z.string() }),
        409: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getStatus: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/status',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: indexingStatusSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getDocs: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/docs',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: repoDocsSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getDocsHistory: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/docs/history',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(docVersionSchema),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getDocsDiff: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/docs/diff/:versionId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
        versionId: dbIdSchema('CodeRepoDoc'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            currentVersion: z.number(),
            previousVersion: z.number().nullable(),
            lines: z.array(diffLineSchema),
          }),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    // Doc pages endpoints
    listDocPages: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(docPageSummarySchema),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getDocPage: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages/:pageId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
        pageId: dbIdSchema('DocPage'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: docPageDetailSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    updateDocPage: {
      method: 'PATCH',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages/:pageId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
        pageId: dbIdSchema('DocPage'),
      }),
      body: z.object({
        title: z.string().min(1, 'Title is required').optional(),
        content: z.string().optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: docPageDetailSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    regenerateDocPage: {
      method: 'POST',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages/:pageId/regenerate',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
        pageId: dbIdSchema('DocPage'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({
          success: z.literal(true),
          message: z.string(),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    regenerateAllDocPages: {
      method: 'POST',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages/regenerate-all',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({
          success: z.literal(true),
          message: z.string(),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listDocPageVersions: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages/:pageId/versions',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
        pageId: dbIdSchema('DocPage'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(docPageVersionSchema),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getDocPageVersion: {
      method: 'GET',
      path: '/orgs/:orgId/code-repos/:dataSourceId/doc-pages/:pageId/versions/:versionId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        dataSourceId: dbIdSchema('DataSource'),
        pageId: dbIdSchema('DocPage'),
        versionId: dbIdSchema('DocPageVersion'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: docPageVersionDetailSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);
