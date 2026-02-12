import { BadRequestException, type PipeTransform } from '@nestjs/common';

import type { ZodType } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(', ');
      throw new BadRequestException(message);
    }
    return result.data;
  }
}
