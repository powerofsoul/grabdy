import { SetMetadata } from '@nestjs/common';

import { OrgRole } from '@db/enums';
import type { AppRoute, AppRouteMutation } from '@ts-rest/core';
import type { z } from 'zod';

export const ORG_ACCESS_KEY = 'orgAccess';

// -- Type-level helpers --

/** Extract the inferred output type from a route's Zod schema field. */
type InferSchema<T> = T extends z.ZodTypeAny ? z.output<T> : never;

/**
 * Pick only keys whose non-nullable value is a branded string (DbId).
 * Uses the "subtype of string but not string itself" trick to detect
 * branded types without depending on Tagged internals.
 */
type DbIdKeys<T> = {
  [K in keyof T]: NonNullable<T[K]> extends string
    ? string extends NonNullable<T[K]>
      ? never
      : K
    : never;
}[keyof T] &
  string;

/** Infer path params type from a route. */
type RouteParams<T extends AppRoute> = T extends { pathParams: infer P } ? InferSchema<P> : never;

/** Infer query type from a route. */
type RouteQuery<T extends AppRoute> = T extends { query: infer Q } ? InferSchema<Q> : never;

/** Infer body type from a mutation route. */
type RouteBody<T> = T extends AppRouteMutation
  ? T extends { body: infer B }
    ? InferSchema<B>
    : never
  : never;

// -- Typed options (with route) --

interface TypedOrgAccessOptions<TRoute extends AppRoute> {
  roles?: OrgRole[];
  params?: DbIdKeys<RouteParams<TRoute>>[];
  query?: DbIdKeys<RouteQuery<TRoute>>[];
  body?: (body: RouteBody<TRoute>) => unknown[];
}

// -- Untyped options (class-level, no route) --

interface UntypedOrgAccessOptions {
  roles?: OrgRole[];
  params?: string[];
  query?: string[];
  body?: (body: Record<string, unknown>) => unknown[];
}

// -- Runtime metadata (stored by SetMetadata) --

export interface OrgAccessMetadata {
  roles: OrgRole[];
  params: string[];
  query: string[];
  body?: (body: Record<string, unknown>) => unknown[];
}

// -- Decorator --

/**
 * Declares org access requirements for a controller or handler.
 *
 * Typed overload (method-level): pass the ts-rest route for compile-time
 * validation of field names and body extractor types.
 *
 * Untyped overload (class-level): plain string field names.
 */
export function OrgAccess<TRoute extends AppRoute>(
  route: TRoute,
  options?: TypedOrgAccessOptions<TRoute>
): MethodDecorator & ClassDecorator;
export function OrgAccess(options: UntypedOrgAccessOptions): MethodDecorator & ClassDecorator;
export function OrgAccess(
  routeOrOptions: AppRoute | UntypedOrgAccessOptions,
  maybeOptions?: TypedOrgAccessOptions<AppRoute>
): MethodDecorator & ClassDecorator {
  // Distinguish overloads: AppRoute has a `method` property
  const options = 'method' in routeOrOptions ? (maybeOptions ?? {}) : routeOrOptions;

  const metadata: OrgAccessMetadata = {
    roles: options.roles ?? [],
    params: options.params ?? [],
    query: options.query ?? [],
    body: options.body,
  };

  return SetMetadata(ORG_ACCESS_KEY, metadata);
}
