import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';

import type { Response } from 'express';
import { z } from 'zod';

import { UserFacingError } from '../errors/user-facing.error';

const nestErrorSchema = z.object({ message: z.union([z.string(), z.array(z.string())]) });

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Headers already sent (e.g. SSE stream mid-flight): just close.
    if (response.headersSent) {
      this.logger.error('Exception after headers sent', exception);
      response.end();
      return;
    }

    // NestJS HttpException (guards, pipes, throttler, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Normalize to { success, error } shape. Validation pipes return
      // { statusCode, message: string | string[], error } which we flatten.
      if (typeof exceptionResponse === 'object') {
        const parsed = nestErrorSchema.safeParse(exceptionResponse);
        const msg = parsed.success ? parsed.data.message : null;
        response.status(status).json({
          success: false,
          error: typeof msg === 'string' ? msg : exception.message,
          ...(Array.isArray(msg) ? { details: msg } : {}),
        });
        return;
      }

      response.status(status).json({
        success: false,
        error: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
      });
      return;
    }

    // UserFacingError: service explicitly chose this message for the user
    if (exception instanceof UserFacingError) {
      response.status(exception.statusCode).json({
        success: false,
        error: exception.message,
      });
      return;
    }

    // Everything else: log the real error, return a generic message
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      { err: exception },
      `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`
    );

    response.status(500).json({
      success: false,
      error: 'Something went wrong',
      ...(process.env.NODE_ENV !== 'production' && {
        debug: {
          message: exception instanceof Error ? exception.message : String(exception),
          stack,
        },
      }),
    });
  }
}
