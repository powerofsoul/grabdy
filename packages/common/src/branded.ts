/**
 * Tagged/Branded Types
 *
 * A tagged type can only be created by specific functions,
 * providing compile-time guarantees about data validity.
 */

declare const tags: unique symbol;

/**
 * Creates a tagged type from a base type.
 *
 * @example
 * ```ts
 * type Email = Tagged<string, 'Email'>;
 * type UserId = Tagged<number, 'UserId'>;
 * ```
 */
export type Tagged<BaseType, Tag extends PropertyKey> = BaseType & {
  readonly [tags]: { readonly [K in Tag]: void };
};
