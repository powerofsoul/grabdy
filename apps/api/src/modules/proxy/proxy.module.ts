import { Global, Module } from '@nestjs/common';

import { ProxyService } from './proxy.service';

/**
 * Provides ProxyService globally for URL construction.
 * ProxyController is registered in ProxyRoutesModule to avoid
 * circular dependencies (controller needs DataSourcesService,
 * which itself depends on ProxyService).
 */
@Global()
@Module({
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
