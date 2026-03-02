import { Module } from '@nestjs/common';

import { DataSourcesModule } from '../data-sources/data-sources.module';
import { StorageModule } from '../storage/storage.module';

import { ProxyController } from './proxy.controller';

@Module({
  imports: [StorageModule, DataSourcesModule],
  controllers: [ProxyController],
})
export class ProxyRoutesModule {}
