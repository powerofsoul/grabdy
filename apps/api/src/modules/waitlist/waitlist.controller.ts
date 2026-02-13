import { Controller } from '@nestjs/common';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { waitlistContract } from '@grabdy/contracts';

import { Public } from '../../common/decorators/public.decorator';

import { WaitlistService } from './waitlist.service';

@Controller()
@Public()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @TsRestHandler(waitlistContract)
  async handler() {
    return tsRestHandler(waitlistContract, {
      join: async ({ body }) => {
        try {
          await this.waitlistService.notifySlack(body.name, body.email);
          return {
            status: 200 as const,
            body: { success: true as const },
          };
        } catch {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'Failed to join waitlist' },
          };
        }
      },
    });
  }
}
