import { Controller, InternalServerErrorException, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { authContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { type CookieOptions, Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { Public } from '../../common/decorators/public.decorator';
import { parseJwtPayload } from '../../common/guards/auth.guard';
import { InjectEnv } from '../../config/env.config';

import { authCookieOptions, AuthService } from './auth.service';

@Controller()
@Public()
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private authService: AuthService,
    @InjectEnv('nodeEnv') nodeEnv: string,
    @InjectEnv('jwtSecret') private readonly jwtSecret: string
  ) {
    this.cookieOptions = authCookieOptions(nodeEnv);
  }

  @TsRestHandler(authContract)
  async handler(@Req() req: Request) {
    const res = req.res;
    if (!res) {
      throw new InternalServerErrorException('Response object not available');
    }

    return tsRestHandler(authContract, {
      login: async ({ body }) => {
        try {
          const { user, token } = await this.authService.login(body.email, body.password);
          res.cookie('auth_token', token, this.cookieOptions);
          return {
            status: 200 as const,
            body: { success: true as const, data: user },
          };
        } catch (error) {
          return {
            status: 401 as const,
            body: {
              success: false as const,
              error: error instanceof Error ? error.message : 'Login failed',
            },
          };
        }
      },
      logout: async () => {
        res.clearCookie('auth_token', { path: '/' });
        return { status: 200 as const, body: { success: true as const } };
      },
      forgotPassword: async ({ body }) => {
        await this.authService.forgotPassword(body.email);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            message:
              'If an account exists with this email, you will receive a password reset code.',
          },
        };
      },
      resetPassword: async ({ body }) => {
        try {
          await this.authService.resetPassword(body.email, body.otp, body.newPassword);
          return {
            status: 200 as const,
            body: { success: true as const, message: 'Password has been reset successfully.' },
          };
        } catch (error) {
          return {
            status: 400 as const,
            body: {
              success: false as const,
              error: error instanceof Error ? error.message : 'Failed to reset password',
            },
          };
        }
      },
      verifySetupToken: async ({ body }) => {
        try {
          const data = await this.authService.verifySetupToken(body.token);
          return {
            status: 200 as const,
            body: { success: true as const, data },
          };
        } catch (error) {
          return {
            status: 400 as const,
            body: {
              success: false as const,
              error: error instanceof Error ? error.message : 'Invalid token',
            },
          };
        }
      },
      completeAccount: async ({ body }) => {
        try {
          const { user, token } = await this.authService.completeAccount(body.token, body.password);
          res.cookie('auth_token', token, this.cookieOptions);
          return {
            status: 200 as const,
            body: { success: true as const, data: user },
          };
        } catch (error) {
          return {
            status: 400 as const,
            body: {
              success: false as const,
              error: error instanceof Error ? error.message : 'Failed to complete account setup',
            },
          };
        }
      },
      me: async () => {
        const token = req.cookies?.['auth_token'];
        if (!token) {
          return {
            status: 401 as const,
            body: { success: false as const, error: 'Not authenticated' },
          };
        }

        try {
          const decoded = jwt.verify(token, this.jwtSecret);
          const payload = parseJwtPayload(decoded);
          if (!payload) {
            return {
              status: 401 as const,
              body: { success: false as const, error: 'Invalid token payload' },
            };
          }
          const currentUser = await this.authService.getCurrentUser(payload.sub);
          if (!currentUser) {
            return {
              status: 401 as const,
              body: { success: false as const, error: 'User not found' },
            };
          }
          return { status: 200 as const, body: { success: true as const, data: currentUser } };
        } catch {
          return {
            status: 401 as const,
            body: { success: false as const, error: 'Invalid or expired token' },
          };
        }
      },
    });
  }
}
