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
      signup: async ({ body }) => {
        const data = await this.authService.register(
          body.email,
          body.password,
          body.firstName,
          body.lastName
        );
        return {
          status: 200 as const,
          body: { success: true as const, data },
        };
      },
      verifyEmail: async ({ body }) => {
        const { user, token } = await this.authService.verifyEmail(body.email, body.otp);
        res.cookie('auth_token', token, this.cookieOptions);
        return {
          status: 200 as const,
          body: { success: true as const, data: user },
        };
      },
      resendVerification: async ({ body }) => {
        await this.authService.resendVerificationOTP(body.email);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            message: 'If an account exists, a new verification code has been sent.',
          },
        };
      },
      googleAuth: async ({ body }) => {
        const { user, token } = await this.authService.googleAuth(body.credential);
        res.cookie('auth_token', token, this.cookieOptions);
        return {
          status: 200 as const,
          body: { success: true as const, data: user },
        };
      },
      login: async ({ body }) => {
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        const { user, token } = await this.authService.login(body.email, body.password, clientIp);
        res.cookie('auth_token', token, this.cookieOptions);
        return {
          status: 200 as const,
          body: { success: true as const, data: user },
        };
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
        await this.authService.resetPassword(body.email, body.otp, body.newPassword);
        return {
          status: 200 as const,
          body: { success: true as const, message: 'Password has been reset successfully.' },
        };
      },
      verifySetupToken: async ({ body }) => {
        const data = await this.authService.verifySetupToken(body.token);
        return {
          status: 200 as const,
          body: { success: true as const, data },
        };
      },
      completeAccount: async ({ body }) => {
        const { user, token } = await this.authService.completeAccount(
          body.token,
          body.password,
          body.firstName,
          body.lastName
        );
        res.cookie('auth_token', token, this.cookieOptions);
        return {
          status: 200 as const,
          body: { success: true as const, data: user },
        };
      },
      updateProfile: async ({ body }) => {
        const authToken = req.cookies?.['auth_token'];
        if (!authToken) {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'Not authenticated' },
          };
        }

        let decoded;
        try {
          decoded = jwt.verify(authToken, this.jwtSecret);
        } catch {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'Invalid or expired token' },
          };
        }
        const payload = parseJwtPayload(decoded);
        if (!payload) {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'Invalid token payload' },
          };
        }
        const result = await this.authService.updateProfile(payload.sub, body);
        res.cookie('auth_token', result.token, this.cookieOptions);
        return {
          status: 200 as const,
          body: { success: true as const, data: result.user },
        };
      },
      me: async () => {
        const authToken = req.cookies?.['auth_token'];
        if (!authToken) {
          return {
            status: 401 as const,
            body: { success: false as const, error: 'Not authenticated' },
          };
        }

        try {
          const decoded = jwt.verify(authToken, this.jwtSecret);
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
