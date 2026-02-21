import { Controller, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { demoRequestContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { Public } from '../../common/decorators/public.decorator';
import { NotificationService } from '../notification/notification.service';

@Controller()
@Public()
@UseGuards(ThrottlerGuard)
export class DemoRequestController {
  constructor(private notificationService: NotificationService) {}

  @TsRestHandler(demoRequestContract)
  async handler() {
    return tsRestHandler(demoRequestContract, {
      submit: async ({ body }) => {
        this.notificationService.notifyDemoRequest(body.name, body.company, body.email);
        return { status: 200 as const, body: { success: true as const } };
      },
    });
  }
}
