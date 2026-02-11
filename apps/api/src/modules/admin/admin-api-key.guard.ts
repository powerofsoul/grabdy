import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

import { InjectEnv } from '../../config/env.config';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(@InjectEnv('adminApiKey') private readonly adminApiKey: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== this.adminApiKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}
