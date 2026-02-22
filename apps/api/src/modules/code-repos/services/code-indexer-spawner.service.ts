import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { fork } from 'child_process';
import { resolve } from 'path';

import { InjectEnv } from '../../../config/env.config';

interface SpawnParams {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  repoFullName: string;
  branch: string;
  connectionId: DbId<'Connection'>;
  mode?: 'full' | 'incremental';
}

@Injectable()
export class CodeIndexerSpawnerService {
  private readonly logger = new Logger(CodeIndexerSpawnerService.name);

  constructor(
    @InjectEnv('nodeEnv') private readonly nodeEnv: string,
    @InjectEnv('indexerTaskDefArn') private readonly taskDefArn: string,
    @InjectEnv('indexerClusterArn') private readonly clusterArn: string,
    @InjectEnv('indexerSubnets') private readonly subnets: string,
    @InjectEnv('indexerSecurityGroup') private readonly securityGroup: string,
    @InjectEnv('awsRegion') private readonly awsRegion: string
  ) {}

  async spawn(params: SpawnParams): Promise<void> {
    if (this.nodeEnv !== 'production') {
      return this.spawnLocal(params);
    }

    return this.spawnEcs(params);
  }

  private async spawnEcs(params: SpawnParams): Promise<void> {
    const client = new ECSClient({ region: this.awsRegion });

    const envOverrides = [
      { name: 'INDEXER_DATA_SOURCE_ID', value: params.dataSourceId },
      { name: 'INDEXER_ORG_ID', value: params.orgId },
      { name: 'INDEXER_REPO', value: params.repoFullName },
      { name: 'INDEXER_BRANCH', value: params.branch },
      { name: 'INDEXER_CONNECTION_ID', value: params.connectionId },
      { name: 'INDEXER_MODE', value: params.mode ?? 'full' },
    ];

    const command = new RunTaskCommand({
      cluster: this.clusterArn,
      taskDefinition: this.taskDefArn,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.subnets.split(','),
          securityGroups: [this.securityGroup],
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'indexer',
            command: ['node', 'apps/api/dist/code-indexer/main.js'],
            environment: envOverrides,
          },
        ],
      },
    });

    const result = await client.send(command);

    if (result.failures && result.failures.length > 0) {
      const reasons = result.failures.map((f) => f.reason ?? 'unknown').join(', ');
      throw new Error(`ECS RunTask failed for ${params.repoFullName}: ${reasons}`);
    }

    const taskArn = result.tasks?.[0]?.taskArn ?? 'unknown';
    this.logger.log(`Spawned ECS indexer task: ${taskArn} for ${params.repoFullName}`);
  }

  private spawnLocal(params: SpawnParams): Promise<void> {
    const scriptPath = resolve(__dirname, '../../code-indexer/main.js');

    const childEnv = {
      ...process.env,
      INDEXER_DATA_SOURCE_ID: params.dataSourceId,
      INDEXER_ORG_ID: params.orgId,
      INDEXER_REPO: params.repoFullName,
      INDEXER_BRANCH: params.branch,
      INDEXER_CONNECTION_ID: params.connectionId,
      INDEXER_MODE: params.mode ?? 'full',
    };

    return new Promise((resolve, reject) => {
      const child = fork(scriptPath, [], { env: childEnv, stdio: 'inherit' });

      child.on('exit', (code) => {
        if (code === 0) {
          this.logger.log(`Local indexer completed for ${params.repoFullName}`);
          resolve();
        } else {
          reject(new Error(`Local indexer exited with code ${code} for ${params.repoFullName}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Local indexer error for ${params.repoFullName}: ${err.message}`));
      });
    });
  }
}
