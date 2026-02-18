/**
 * ESLint rule: enforce-dbid
 *
 * Enforces that any identifier ending with "Id" (camelCase) is typed as
 * DbId<'...'> or NonDbId<'...'> rather than plain string.
 *
 * Also enforces that identifiers ending with "Ids" or "ids" (plural) are
 * typed as arrays of DbId<'...'> or NonDbId<'...'>.
 *
 * Checks: function parameters, variable declarations, class properties,
 * interface/type properties, object destructuring.
 *
 * Catches: `userId: string`, `collectionIds: string[]`, `orgId: string`, etc.
 * Allows: `DbId<'User'>`, `DbId<'Collection'>[]`, `NonDbId<'CanvasCard'>[]`, etc.
 *
 * Exceptions:
 * - The bare name `id` (primary keys are Generated<DbId<...>>)
 */

/** @type {Set<string>} Names that are NOT branded IDs */
const EXCEPTIONS = new Set([]);

/** Names containing these substrings before Id/Ids are third-party identifiers, not our packed UUIDs */
const EXTERNAL_PATTERNS = [
  'externalId',
  'ExternalId',
  'externalIds',
  'ExternalIds',
  'slackChannelId',
  'SlackChannelId',
  'slackBotUserId',
  'SlackBotUserId',
  'linearIssueId',
  'LinearIssueId',
  'linearCommentId',
  'LinearCommentId',
  'linearClientId',
  'LinearClientId',
  'githubInstallationId',
  'GithubInstallationId',
  'githubCommentId',
  'GithubCommentId',
  'githubAppId',
  'GithubAppId',
  'installationId',
  'InstallationId',
  'googleClientId',
  'notionClientId',
  'notionPageId',
  'notionBlockId',
  'notionWorkspaceId',
];

/**
 * Check if a type annotation node contains "DbId" or "NonDbId" somewhere.
 * Works for: DbId<'User'>, NonDbId<'CanvasCard'>, DbId<'Collection'> | null, Generated<DbId<'User'>>, etc.
 */
function containsBrandedId(node) {
  if (!node) return false;

  // TSTypeReference: check if it's DbId<...>, NonDbId<...>, or Generated<DbId<...>>
  if (node.type === 'TSTypeReference') {
    const typeName = node.typeName;
    if (typeName?.type === 'Identifier') {
      if (
        typeName.name === 'DbId' ||
        typeName.name === 'NonDbId' ||
        typeName.name === 'OrgNumericId'
      )
        return true;
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

/**
 * Check if a name refers to a singular ID (e.g. userId, collectionId).
 * @param {string} name
 */
function nameEndsWithId(name) {
  if (name === 'id') return false;
  return /[a-z]Id$/.test(name);
}

/**
 * Check if a name refers to a plural ID array (e.g. collectionIds, userIds, ids).
 * Matches: ids, collectionIds, rawIds, etc.
 * @param {string} name
 */
function nameEndsWithIds(name) {
  return /[iI]ds$/.test(name);
}

/**
 * Check if a type annotation is an array containing branded IDs.
 * Matches: DbId<'X'>[], Array<DbId<'X'>>, NonDbId<'X'>[], etc.
 */
function containsBrandedIdArray(node) {
  if (!node) return false;

  // TSTypeAnnotation wrapper
  if (node.type === 'TSTypeAnnotation') {
    return containsBrandedIdArray(node.typeAnnotation);
  }

  // DbId<'X'>[]
  if (node.type === 'TSArrayType') {
    return containsBrandedId(node.elementType);
  }

  // Array<DbId<'X'>>
  if (node.type === 'TSTypeReference') {
    if (node.typeName?.type === 'Identifier' && node.typeName.name === 'Array') {
      const params = node.typeArguments?.params || node.typeParameters?.params;
      if (params) return params.some(containsBrandedId);
    }
  }

  // Union: DbId<'X'>[] | undefined
  if (node.type === 'TSUnionType') {
    return node.types.some(containsBrandedIdArray);
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce DbId branded type for all identifiers ending with "Id" or "Ids"',
    },
    messages: {
      requireDbId:
        '"{{name}}" ends with "Id" but is typed as plain string. Use DbId<\'Table\'> or NonDbId<\'Entity\'> instead.',
      requireDbIdArray:
        '"{{name}}" ends with "Ids" but is not typed as a branded ID array. Use DbId<\'Table\'>[] or NonDbId<\'Entity\'>[] instead.',
    },
    schema: [],
  },

  create(context) {
    function check(name, typeAnnotation, reportNode) {
      if (!name || !typeAnnotation) return;
      if (EXCEPTIONS.has(name)) return;
      if (EXTERNAL_PATTERNS.some((p) => name.includes(p))) return;

      if (nameEndsWithIds(name)) {
        if (!containsBrandedIdArray(typeAnnotation)) {
          context.report({
            node: reportNode,
            messageId: 'requireDbIdArray',
            data: { name },
          });
        }
        return;
      }

      if (nameEndsWithId(name)) {
        if (!containsBrandedId(typeAnnotation)) {
          context.report({
            node: reportNode,
            messageId: 'requireDbId',
            data: { name },
          });
        }
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
