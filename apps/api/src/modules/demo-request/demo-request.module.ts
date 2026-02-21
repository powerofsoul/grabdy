import { Module } from '@nestjs/common';

import { DemoRequestController } from './demo-request.controller';

@Module({
  controllers: [DemoRequestController],
})
export class DemoRequestModule {}
