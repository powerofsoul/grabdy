import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';
import { Octokit } from '@octokit/rest';
import { Queue } from 'bullmq';
import { diffLines } from 'diff';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { DbService } from '../../db/db.module';
import { IntegrationsService } from '../integrations/integrations.service';
import { CODE_REPO_DOC_GEN_QUEUE, CODE_REPO_QUEUE } from '../queue/queue.constants';

import type { CodeRepoSyncJobData } from './processors/code-repo-sync.processor';
import { DocEmbeddingService } from './services/doc-embedding.service';

interface RepoInfo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  language: string | null;
  size: number;
  isPrivate: boolean;
  defaultBranch: string;
  updatedAt: string | null;
}

@Injectable()
export class CodeReposService {
  private readonly logger = new Logger(CodeReposService.name);

  constructor(
    private db: DbService,
    private integrationsService: IntegrationsService,
    private encryption: EncryptionService,
    private docEmbeddingService: DocEmbeddingService,
    @InjectQueue(CODE_REPO_QUEUE) private codeRepoQueue: Queue,
    @InjectQueue(CODE_REPO_DOC_GEN_QUEUE) private docGenQueue: Queue
  ) {}

  async listAvailableRepos(orgId: DbId<'Org'>): Promise<RepoInfo[]> {
    const token = await this.integrationsService.getValidAccessToken(orgId, 'GITHUB');
    if (!token) {
      throw new NotFoundException('GitHub connection not found. Connect GitHub first.');
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.apps.listReposAccessibleToInstallation({ per_page: 100 });

    return data.repositories.map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      language: repo.language ?? null,
      size: repo.size,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at ?? null,
    }));
  }

  async startIndexing(
    orgId: DbId<'Org'>,
    userId: DbId<'User'>,
    params: { repoFullName: string; collectionId?: DbId<'Collection'> }
  ) {
    // Always use the repo's default branch
    const [owner, repo] = params.repoFullName.split('/');
    if (!owner || !repo) {
      throw new BadRequestException('Invalid repository name format, expected "owner/repo"');
    }
    const token = await this.integrationsService.getValidAccessToken(orgId, 'GITHUB');
    if (!token) {
      throw new NotFoundException('GitHub connection not found');
    }
    const connectionMeta = await this.integrationsService.getConnectionMeta(orgId, 'GITHUB');
    if (!connectionMeta) {
      throw new NotFoundException('GitHub connection not found');
    }
    const octokit = new Octokit({ auth: token });
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const branch = repoData.default_branch;
    const collectionId = params.collectionId ?? null;

    // Check for existing data source
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .innerJoin(
        'data.code_repo_state',
        'data.code_repo_state.data_source_id',
        'data.data_sources.id'
      )
      .select(['data.data_sources.id'])
      .where('data.code_repo_state.repo_full_name', '=', params.repoFullName)
      .where('data.data_sources.org_id', '=', orgId)
      .executeTakeFirst();

    // Create or reuse data source
    let dataSourceId: DbId<'DataSource'>;

    if (existing) {
      dataSourceId = existing.id;
      // Atomically claim: only set PROCESSING if not already PROCESSING
      const claimed = await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'PROCESSING', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .where('org_id', '=', orgId)
        .where('status', '!=', 'PROCESSING')
        .executeTakeFirst();

      if (claimed.numUpdatedRows === 0n) {
        throw new ConflictException('Repository is already being indexed');
      }

      await this.db.kysely
        .updateTable('data.code_repo_state')
        .set({
          branch,
          total_files: 0,
          processed_files: 0,
          updated_at: new Date(),
        })
        .where('data_source_id', '=', dataSourceId)
        .execute();
    } else {
      dataSourceId = packId('DataSource', orgId);

      await this.db.kysely
        .insertInto('data.data_sources')
        .values({
          id: dataSourceId,
          title: params.repoFullName,
          mime_type: 'application/x-git',
          file_size: 0,
          storage_path: '',
          type: 'CODE_REPO',
          source_url: `https://github.com/${params.repoFullName}`,
          collection_id: collectionId,
          connection_id: connectionMeta.id,
          org_id: orgId,
          uploaded_by_id: userId,
          status: 'PROCESSING',
          updated_at: new Date(),
        })
        .execute();

      const orgNum = extractOrgNumericId(orgId);
      const efsPath = `${orgNum}/${params.repoFullName.replace('/', '-')}`;

      await this.db.kysely
        .insertInto('data.code_repo_state')
        .values({
          data_source_id: dataSourceId,
          repo_full_name: params.repoFullName,
          branch,
          efs_path: efsPath,
          org_id: orgId,
          updated_at: new Date(),
        })
        .execute();
    }

    // Queue indexer job
    const jobData: CodeRepoSyncJobData = {
      dataSourceId,
      orgId,
      repoFullName: params.repoFullName,
      branch,
      connectionId: connectionMeta.id,
      mode: 'full',
    };
    await this.codeRepoQueue.add('sync-repo', jobData, {
      jobId: `repo-${dataSourceId}`,
    });

    return this.getIndexingStatus(orgId, dataSourceId);
  }

  async getIndexingStatus(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>) {
    const row = await this.db.kysely
      .selectFrom('data.data_sources')
      .innerJoin(
        'data.code_repo_state',
        'data.code_repo_state.data_source_id',
        'data.data_sources.id'
      )
      .select([
        'data.data_sources.id as dataSourceId',
        'data.data_sources.status',
        'data.code_repo_state.repo_full_name',
        'data.code_repo_state.branch',
        'data.code_repo_state.total_files',
        'data.code_repo_state.processed_files',
        'data.code_repo_state.last_commit_sha',
        'data.code_repo_state.created_at',
        'data.code_repo_state.updated_at',
      ])
      .where('data.data_sources.id', '=', dataSourceId)
      .where('data.data_sources.org_id', '=', orgId)
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('Code repository not found');
    }

    // CODE_REPO sources skip UPLOADED, map to the contract's narrower status type
    type DbStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
    const statusMap = {
      UPLOADED: 'PROCESSING',
      PROCESSING: 'PROCESSING',
      READY: 'READY',
      FAILED: 'FAILED',
    } satisfies Record<DbStatus, 'PROCESSING' | 'READY' | 'FAILED'>;

    return {
      dataSourceId: row.dataSourceId,
      repoFullName: row.repo_full_name,
      branch: row.branch,
      status: statusMap[row.status],
      totalFiles: row.total_files,
      processedFiles: row.processed_files,
      lastCommitSha: row.last_commit_sha,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async getDocs(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>) {
    const doc = await this.db.kysely
      .selectFrom('data.code_repo_docs')
      .select(['content', 'commit_sha', 'version', 'created_at'])
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .orderBy('version', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!doc) {
      throw new NotFoundException('No documentation available for this repository');
    }

    return {
      content: doc.content,
      commitSha: doc.commit_sha,
      version: doc.version,
      createdAt: doc.created_at.toISOString(),
    };
  }

  async getDocsHistory(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>) {
    const versions = await this.db.kysely
      .selectFrom('data.code_repo_docs')
      .select(['id', 'commit_sha', 'version', 'created_at'])
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .orderBy('version', 'desc')
      .execute();

    return versions.map((v) => ({
      id: v.id,
      commitSha: v.commit_sha,
      version: v.version,
      createdAt: v.created_at.toISOString(),
    }));
  }

  async getDocsDiff(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    versionId: DbId<'CodeRepoDoc'>
  ) {
    const currentDoc = await this.db.kysely
      .selectFrom('data.code_repo_docs')
      .select(['content', 'version'])
      .where('id', '=', versionId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!currentDoc) {
      throw new NotFoundException('Document version not found');
    }

    const previousDoc = await this.db.kysely
      .selectFrom('data.code_repo_docs')
      .select(['content', 'version'])
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .where('version', '=', currentDoc.version - 1)
      .executeTakeFirst();

    const oldContent = previousDoc?.content ?? '';
    const changes = diffLines(oldContent, currentDoc.content);

    type DiffLineType = 'addition' | 'deletion' | 'unchanged';
    const lines: Array<{ type: DiffLineType; content: string; lineNumber: number | null }> = [];
    let lineNumber = 1;

    for (const change of changes) {
      const changeLines = change.value
        .split('\n')
        .filter((l) => l.length > 0 || change.value === '\n');
      for (const line of changeLines) {
        if (change.added) {
          lines.push({ type: 'addition', content: line, lineNumber });
          lineNumber++;
        } else if (change.removed) {
          lines.push({ type: 'deletion', content: line, lineNumber: null });
        } else {
          lines.push({ type: 'unchanged', content: line, lineNumber });
          lineNumber++;
        }
      }
    }

    return {
      currentVersion: currentDoc.version,
      previousVersion: previousDoc?.version ?? null,
      lines,
    };
  }

  async listDocPages(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>) {
    const pages = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['id', 'parent_id', 'title', 'slug', 'sort_order', 'is_user_edited', 'version'])
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .orderBy('sort_order', 'asc')
      .execute();

    return pages.map((p) => ({
      id: p.id,
      parentId: p.parent_id,
      title: p.title,
      slug: p.slug,
      sortOrder: p.sort_order,
      isUserEdited: p.is_user_edited,
      version: p.version,
    }));
  }

  async getDocPage(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>, pageId: DbId<'DocPage'>) {
    const page = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select([
        'id',
        'parent_id',
        'title',
        'slug',
        'sort_order',
        'is_user_edited',
        'version',
        'content',
        'commit_sha',
        'created_at',
        'updated_at',
      ])
      .where('id', '=', pageId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!page) {
      throw new NotFoundException('Doc page not found');
    }

    return {
      id: page.id,
      parentId: page.parent_id,
      title: page.title,
      slug: page.slug,
      sortOrder: page.sort_order,
      isUserEdited: page.is_user_edited,
      version: page.version,
      content: page.content,
      commitSha: page.commit_sha,
      createdAt: page.created_at.toISOString(),
      updatedAt: page.updated_at.toISOString(),
    };
  }

  async updateDocPage(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    pageId: DbId<'DocPage'>,
    data: { title?: string; content?: string }
  ) {
    const existing = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['id', 'version', 'title', 'content', 'commit_sha'])
      .where('id', '=', pageId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundException('Doc page not found');
    }

    const newVersion = existing.version + 1;
    const newTitle = data.title ?? existing.title;
    const newContent = data.content ?? existing.content;

    await this.db.kysely
      .updateTable('data.code_repo_doc_pages')
      .set({
        title: newTitle,
        content: newContent,
        is_user_edited: true,
        version: newVersion,
        updated_at: new Date(),
      })
      .where('id', '=', pageId)
      .execute();

    // Create version entry
    await this.db.kysely
      .insertInto('data.code_repo_doc_page_versions')
      .values({
        id: packId('DocPageVersion', orgId),
        page_id: pageId,
        content: newContent,
        commit_sha: existing.commit_sha,
        source: 'USER',
        version: newVersion,
        org_id: orgId,
      })
      .execute();

    // Schedule delayed re-embedding (5 min). Uses a fixed job ID per page
    // so subsequent edits remove the pending job and reset the timer.
    const reEmbedJobId = `re-embed-doc-page:${pageId}`;
    try {
      const existingJob = await this.docGenQueue.getJob(reEmbedJobId);
      if (existingJob) {
        await existingJob.remove().catch(() => {
          // Job may have been picked up by a worker already, safe to ignore
        });
      }
    } catch {
      // Job lookup failure is non-critical
    }
    await this.docGenQueue
      .add(
        're-embed-doc-page',
        { orgId, dataSourceId, pageId },
        { jobId: reEmbedJobId, delay: 5 * 60 * 1000 }
      )
      .catch(() => {
        // Duplicate jobId means another edit already scheduled, safe to ignore
      });

    return this.getDocPage(orgId, dataSourceId, pageId);
  }

  async regenerateDocPage(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    pageId: DbId<'DocPage'>
  ) {
    const page = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['id'])
      .where('id', '=', pageId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!page) {
      throw new NotFoundException('Doc page not found');
    }

    await this.docGenQueue.add('regenerate-page', {
      orgId,
      dataSourceId,
      pageId,
      mode: 'single',
    });

    return { message: 'Doc page regeneration queued' };
  }

  async regenerateAllDocPages(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>) {
    // Verify the data source exists
    const ds = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id'])
      .where('id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!ds) {
      throw new NotFoundException('Code repository not found');
    }

    await this.docGenQueue.add('regenerate-all', {
      orgId,
      dataSourceId,
      mode: 'all',
    });

    return { message: 'All non-user-edited doc pages queued for regeneration' };
  }

  async listPageVersions(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    pageId: DbId<'DocPage'>
  ) {
    // Verify the page belongs to this data source and org
    const page = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['id'])
      .where('id', '=', pageId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!page) {
      throw new NotFoundException('Doc page not found');
    }

    const versions = await this.db.kysely
      .selectFrom('data.code_repo_doc_page_versions')
      .select(['id', 'commit_sha', 'source', 'version', 'created_at'])
      .where('page_id', '=', pageId)
      .where('org_id', '=', orgId)
      .orderBy('version', 'desc')
      .execute();

    return versions.map((v) => ({
      id: v.id,
      commitSha: v.commit_sha,
      source: v.source,
      version: v.version,
      createdAt: v.created_at.toISOString(),
    }));
  }

  async getPageVersion(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    pageId: DbId<'DocPage'>,
    versionId: DbId<'DocPageVersion'>
  ) {
    // Verify the page belongs to this data source and org
    const page = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['id'])
      .where('id', '=', pageId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!page) {
      throw new NotFoundException('Doc page not found');
    }

    const version = await this.db.kysely
      .selectFrom('data.code_repo_doc_page_versions')
      .select(['id', 'commit_sha', 'source', 'version', 'created_at', 'content'])
      .where('id', '=', versionId)
      .where('page_id', '=', pageId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!version) {
      throw new NotFoundException('Doc page version not found');
    }

    return {
      id: version.id,
      commitSha: version.commit_sha,
      source: version.source,
      version: version.version,
      createdAt: version.created_at.toISOString(),
      content: version.content,
    };
  }
}
