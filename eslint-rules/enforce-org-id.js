/**
 * ESLint rule: enforce-org-id
 *
 * Enforces that Kysely queries (selectFrom, updateTable, deleteFrom) on
 * multi-tenant tables include a `.where('org_id', ...)` condition in the
 * method chain. Prevents cross-org data leaks.
 *
 * Catches:
 *   db.selectFrom('data.chunks').where('id', '=', x).execute()
 *   db.deleteFrom('data.data_sources').where('connection_id', '=', x).execute()
 *
 * Allows:
 *   db.selectFrom('data.chunks').where('org_id', '=', orgId).execute()
 *   db.selectFrom('data.chunks').where('data.chunks.org_id', '=', orgId).execute()
 */

/** Tables that have an org_id column and require org-scoped queries. */
const ORG_ID_TABLES = new Set([
  'org.org_memberships',
  'org.org_invitations',
  'data.collections',
  'data.data_sources',
  'data.chunks',
  'data.extracted_images',
  'data.chat_threads',
  'data.shared_chats',
  'integration.connections',
  'api.api_keys',
  'api.usage_logs',
  'analytics.ai_usage_logs',
]);

/** Kysely methods that start a query on a table. */
const QUERY_ENTRY_METHODS = new Set(['selectFrom', 'updateTable', 'deleteFrom']);

/**
 * Check if a CallExpression is a `.where('org_id', ...)` or `.where('table.org_id', ...)`.
 */
function isOrgIdWhere(callNode) {
  if (callNode.callee?.type !== 'MemberExpression') return false;

  const prop = callNode.callee.property;
  if (prop?.type !== 'Identifier' || prop.name !== 'where') return false;

  const args = callNode.arguments;
  if (args.length === 0) return false;

  const firstArg = args[0];
  if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
    return firstArg.value === 'org_id' || firstArg.value.endsWith('.org_id');
  }

  return false;
}

/**
 * Check if the statement containing a node has an `// org-safe: <reason>` comment
 * on the preceding line. This is the escape hatch for legitimate cross-org queries.
 */
function hasOrgSafeComment(node, sourceCode) {
  const comments = sourceCode.getCommentsBefore(node);
  for (const comment of comments) {
    if (comment.type === 'Line' && comment.value.trim().startsWith('org-safe:')) {
      return true;
    }
  }

  // Also check comments before the entire statement (walk up to ExpressionStatement/VariableDeclaration)
  let stmt = node;
  while (stmt.parent && stmt.parent.type !== 'Program' && stmt.parent.type !== 'BlockStatement') {
    stmt = stmt.parent;
  }
  if (stmt !== node) {
    const stmtComments = sourceCode.getCommentsBefore(stmt);
    for (const comment of stmtComments) {
      if (comment.type === 'Line' && comment.value.trim().startsWith('org-safe:')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Walk UP the method chain from a CallExpression and check if any
 * chained method call is `.where('org_id', ...)`.
 *
 * Chain structure in AST:
 *   CallExpr(.selectFrom)
 *     → parent MemberExpr(.where)
 *       → parent CallExpr(.where('org_id',...))   ← match
 *         → parent MemberExpr(.select)
 *           → parent CallExpr(.select([...]))
 *             → ...
 */
function chainHasOrgIdFilter(startNode) {
  let current = startNode;

  while (current.parent) {
    const parent = current.parent;

    // Expect: current is the `object` of a MemberExpression (i.e., the next chained call)
    if (parent.type === 'MemberExpression' && parent.object === current) {
      const grandParent = parent.parent;

      // The MemberExpression should be the callee of a CallExpression
      if (grandParent?.type === 'CallExpression' && grandParent.callee === parent) {
        if (isOrgIdWhere(grandParent)) {
          return true;
        }
        current = grandParent;
        continue;
      }
    }

    break;
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce org_id filter on Kysely queries for multi-tenant tables',
    },
    messages: {
      missingOrgId:
        'Query on "{{table}}" is missing a .where(\'org_id\', ...) filter. Multi-tenant tables must be scoped to an organization.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      CallExpression(node) {
        // Match: *.selectFrom('table'), *.updateTable('table'), *.deleteFrom('table')
        if (node.callee?.type !== 'MemberExpression') return;

        const prop = node.callee.property;
        if (prop?.type !== 'Identifier' || !QUERY_ENTRY_METHODS.has(prop.name)) return;

        // Get the table name from the first argument
        const args = node.arguments;
        if (args.length === 0) return;

        const firstArg = args[0];
        if (firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') return;

        const tableName = firstArg.value;
        if (!ORG_ID_TABLES.has(tableName)) return;

        // Check for // org-safe: comment escape hatch
        if (hasOrgSafeComment(node, sourceCode)) return;

        // Walk up the method chain to find .where('org_id', ...)
        if (!chainHasOrgIdFilter(node)) {
          context.report({
            node,
            messageId: 'missingOrgId',
            data: { table: tableName },
          });
        }
      },
    };
  },
};

module.exports = rule;
