import { Injectable, SetMetadata } from '@nestjs/common';

export const INNGEST_FUNCTIONS = Symbol('INNGEST_FUNCTIONS');

/**
 * Marks a class as an Inngest function provider.
 * The class must implement a `definitions()` method returning Inngest function definitions.
 * The global InngestModule auto-discovers all providers with this decorator.
 */
export function InngestFunctions(): ClassDecorator {
  return (target) => {
    SetMetadata(INNGEST_FUNCTIONS, true)(target);
    Injectable()(target);
  };
}
