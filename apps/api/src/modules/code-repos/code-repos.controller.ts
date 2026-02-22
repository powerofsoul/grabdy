import { Controller, Logger } from '@nestjs/common';

import { codeReposContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { CodeReposService } from './code-repos.service';

@Controller()
export class CodeReposController {
  private readonly logger = new Logger(CodeReposController.name);

  constructor(private codeReposService: CodeReposService) {}

  @OrgAccess(codeReposContract.listAvailableRepos, { params: ['orgId'] })
  @TsRestHandler(codeReposContract.listAvailableRepos)
  async listAvailableRepos() {
    return tsRestHandler(codeReposContract.listAvailableRepos, async ({ params }) => {
      const repos = await this.codeReposService.listAvailableRepos(params.orgId);
      return {
        status: 200 as const,
        body: { success: true as const, data: repos },
      };
    });
  }

  @OrgAccess(codeReposContract.startIndexing, { params: ['orgId'] })
  @TsRestHandler(codeReposContract.startIndexing)
  async startIndexing(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(codeReposContract.startIndexing, async ({ params, body }) => {
      const status = await this.codeReposService.startIndexing(params.orgId, user.sub, body);
      return {
        status: 200 as const,
        body: { success: true as const, data: status },
      };
    });
  }

  @OrgAccess(codeReposContract.getStatus, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.getStatus)
  async getStatus() {
    return tsRestHandler(codeReposContract.getStatus, async ({ params }) => {
      const status = await this.codeReposService.getIndexingStatus(
        params.orgId,
        params.dataSourceId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: status },
      };
    });
  }

  @OrgAccess(codeReposContract.getDocs, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.getDocs)
  async getDocs() {
    return tsRestHandler(codeReposContract.getDocs, async ({ params }) => {
      const docs = await this.codeReposService.getDocs(params.orgId, params.dataSourceId);
      return {
        status: 200 as const,
        body: { success: true as const, data: docs },
      };
    });
  }

  @OrgAccess(codeReposContract.getDocsHistory, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.getDocsHistory)
  async getDocsHistory() {
    return tsRestHandler(codeReposContract.getDocsHistory, async ({ params }) => {
      const history = await this.codeReposService.getDocsHistory(
        params.orgId,
        params.dataSourceId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: history },
      };
    });
  }

  @OrgAccess(codeReposContract.getDocsDiff, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.getDocsDiff)
  async getDocsDiff() {
    return tsRestHandler(codeReposContract.getDocsDiff, async ({ params }) => {
      const diff = await this.codeReposService.getDocsDiff(
        params.orgId,
        params.dataSourceId,
        params.versionId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: diff },
      };
    });
  }

  @OrgAccess(codeReposContract.listDocPages, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.listDocPages)
  async listDocPages() {
    return tsRestHandler(codeReposContract.listDocPages, async ({ params }) => {
      const pages = await this.codeReposService.listDocPages(
        params.orgId,
        params.dataSourceId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: pages },
      };
    });
  }

  @OrgAccess(codeReposContract.getDocPage, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.getDocPage)
  async getDocPage() {
    return tsRestHandler(codeReposContract.getDocPage, async ({ params }) => {
      const page = await this.codeReposService.getDocPage(
        params.orgId,
        params.dataSourceId,
        params.pageId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: page },
      };
    });
  }

  @OrgAccess(codeReposContract.updateDocPage, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.updateDocPage)
  async updateDocPage() {
    return tsRestHandler(codeReposContract.updateDocPage, async ({ params, body }) => {
      const page = await this.codeReposService.updateDocPage(
        params.orgId,
        params.dataSourceId,
        params.pageId,
        body
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: page },
      };
    });
  }

  @OrgAccess(codeReposContract.regenerateDocPage, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.regenerateDocPage)
  async regenerateDocPage() {
    return tsRestHandler(codeReposContract.regenerateDocPage, async ({ params }) => {
      const result = await this.codeReposService.regenerateDocPage(
        params.orgId,
        params.dataSourceId,
        params.pageId
      );
      return {
        status: 200 as const,
        body: { success: true as const, message: result.message },
      };
    });
  }

  @OrgAccess(codeReposContract.regenerateAllDocPages, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.regenerateAllDocPages)
  async regenerateAllDocPages() {
    return tsRestHandler(codeReposContract.regenerateAllDocPages, async ({ params }) => {
      const result = await this.codeReposService.regenerateAllDocPages(
        params.orgId,
        params.dataSourceId
      );
      return {
        status: 200 as const,
        body: { success: true as const, message: result.message },
      };
    });
  }

  @OrgAccess(codeReposContract.listDocPageVersions, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.listDocPageVersions)
  async listDocPageVersions() {
    return tsRestHandler(codeReposContract.listDocPageVersions, async ({ params }) => {
      const versions = await this.codeReposService.listPageVersions(
        params.orgId,
        params.dataSourceId,
        params.pageId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: versions },
      };
    });
  }

  @OrgAccess(codeReposContract.getDocPageVersion, { params: ['orgId', 'dataSourceId'] })
  @TsRestHandler(codeReposContract.getDocPageVersion)
  async getDocPageVersion() {
    return tsRestHandler(codeReposContract.getDocPageVersion, async ({ params }) => {
      const version = await this.codeReposService.getPageVersion(
        params.orgId,
        params.dataSourceId,
        params.pageId,
        params.versionId
      );
      return {
        status: 200 as const,
        body: { success: true as const, data: version },
      };
    });
  }
}
