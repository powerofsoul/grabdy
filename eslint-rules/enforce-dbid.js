/**
 * ESLint rule: enforce-dbid
 *
 * Enforces that any identifier ending with "Id" (camelCase) is typed as
 * DbId<'...'> rather than plain string — everywhere in the codebase.
 *
 * Checks: function parameters, variable declarations, class properties,
 * interface/type properties, object destructuring.
 *
 * Catches: `userId: string`, `collectionId: string`, `orgId: string`, etc.
 * Allows: `DbId<'User'>`, `DbId<'Collection'> | null`, `Generated<DbId<'User'>>`, etc.
 *
 * Exceptions:
 * - The bare name `id` (primary keys are Generated<DbId<...>>)
 */

/** @type {Set<string>} Names that are NOT branded IDs */
const EXCEPTIONS = new Set([]);

/**
 * Check if a type annotation node contains "DbId" somewhere.
 * Works for: DbId<'User'>, DbId<'Collection'> | null, Generated<DbId<'User'>>, etc.
 */
function containsBrandedId(node) {
  if (!node) return false;

  // TSTypeReference: check if it's DbId<...>, or Generated<DbId<...>>
  if (node.type === 'TSTypeReference') {
    const typeName = node.typeName;
    if (typeName?.type === 'Identifier') {
      if (typeName.name === 'DbId' || typeName.name === 'OrgNumericId') return true;
    }
    // Check type parameters (e.g. Generated<DbId<'User'>>)
    if (node.typeArguments?.params) {
      return node.typeArguments.params.some(containsBrandedId);
    }
    if (node.typeParameters?.params) {
      return node.typeParameters.params.some(containsBrandedId);
    }
    return false;
  }

  // TSUnionType: DbId<'x'> | null
  if (node.type === 'TSUnionType') {
    return node.types.some(containsBrandedId);
  }

  // TSIntersectionType
  if (node.type === 'TSIntersectionType') {
    return node.types.some(containsBrandedId);
  }

  // TSArrayType: DbId<'x'>[]
  if (node.type === 'TSArrayType') {
    return containsBrandedId(node.elementType);
  }

  // TSTypeAnnotation wrapper
  if (node.type === 'TSTypeAnnotation') {
    return containsBrandedId(node.typeAnnotation);
  }

  return false;
}

/** @param {string} name */
function nameEndsWithId(name) {
  if (name === 'id') return false;
  return /[a-z]Id$/.test(name);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce DbId branded type for all identifiers ending with "Id"',
    },
    messages: {
      requireDbId:
        '"{{name}}" ends with "Id" but is typed as plain string. Use DbId<\'Table\'> instead.',
    },
    schema: [],
  },

  create(context) {
    function check(name, typeAnnotation, reportNode) {
      if (!name || !typeAnnotation) return;
      if (!nameEndsWithId(name)) return;
      if (EXCEPTIONS.has(name)) return;

      if (!containsBrandedId(typeAnnotation)) {
        context.report({
          node: reportNode,
          messageId: 'requireDbId',
          data: { name },
        });
      }
    }

    return {
      // Function parameters + variable declarations with type annotations
      'Identifier[typeAnnotation]'(node) {
        check(node.name, node.typeAnnotation, node);
      },

      // Interface/type properties: interface Foo { userId: string }
      TSPropertySignature(node) {
        if (node.key?.type === 'Identifier' && node.typeAnnotation) {
          check(node.key.name, node.typeAnnotation, node.key);
        }
      },

      // Class properties: private userId: string
      PropertyDefinition(node) {
        if (node.key?.type === 'Identifier' && node.typeAnnotation) {
          check(node.key.name, node.typeAnnotation, node.key);
        }
      },
    };
  },
};

module.exports = rule;
