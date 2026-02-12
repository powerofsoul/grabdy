/**
 * ESLint rule: enforce-entity-type-map
 *
 * Enforces that migration files use ENTITY_TYPE_MAP via sql.lit() instead of
 * hardcoded entity type codes in SQL template literals.
 *
 * Detects TWO categories of violations:
 *
 * 1. Hardcoded numbers in the static SQL string parts:
 *    - make_packed_uuid(0, 6)
 *    - extract_entity_type(id) = 6
 *
 * 2. sql.lit() calls whose argument is NOT ENTITY_TYPE_MAP.Something:
 *    - sql.lit('s'), sql.lit(6), sql.lit(someVar)
 *    Only sql.lit(ENTITY_TYPE_MAP.XYZ) is allowed.
 */

/**
 * Check if a quasi (static SQL part) ends with a pattern that expects an
 * entity type in the next interpolation slot.
 */
function endsWithEntityTypeContext(raw) {
  return (
    /make_packed_uuid\(\s*(?:NEW\.\w+|\d+)\s*,\s*$/.test(raw) ||
    /extract_entity_type\([^)]+\)\s*=\s*$/.test(raw)
  );
}

/**
 * Check if an expression node is `ENTITY_TYPE_MAP.Something`.
 */
function isEntityTypeMapAccess(node) {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'ENTITY_TYPE_MAP'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce ENTITY_TYPE_MAP usage instead of hardcoded entity type codes in migration SQL',
    },
    messages: {
      hardcodedEntityType:
        'Use ENTITY_TYPE_MAP via sql.lit() instead of hardcoded entity type code "{{value}}".',
      nonMapLitArg:
        'sql.lit() in entity type position must use ENTITY_TYPE_MAP.XYZ, not a literal or variable.',
    },
    schema: [],
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        // Only check sql`...` tagged templates
        if (node.tag.type !== 'Identifier' || node.tag.name !== 'sql') {
          return;
        }

        const quasis = node.quasi.quasis;
        const expressions = node.quasi.expressions;

        for (let i = 0; i < quasis.length; i++) {
          const raw = quasis[i].value.raw;

          // ── Check 1: hardcoded numbers in static SQL ──────────────
          const packUuidPattern =
            /make_packed_uuid\(\s*(?:NEW\.\w+|\d+)\s*,\s*(\d+)\s*\)/g;
          let match;
          while ((match = packUuidPattern.exec(raw)) !== null) {
            context.report({
              node: quasis[i],
              messageId: 'hardcodedEntityType',
              data: { value: match[1] },
            });
          }

          const extractPattern =
            /extract_entity_type\([^)]+\)\s*=\s*(\d+)/g;
          while ((match = extractPattern.exec(raw)) !== null) {
            context.report({
              node: quasis[i],
              messageId: 'hardcodedEntityType',
              data: { value: match[1] },
            });
          }

          // ── Check 2: expression in entity-type position ───────────
          // If this quasi ends with a pattern expecting an entity type,
          // the next expression (expressions[i]) must be sql.lit(ENTITY_TYPE_MAP.X).
          if (i < expressions.length && endsWithEntityTypeContext(raw)) {
            const expr = expressions[i];

            // Expected shape: sql.lit(ENTITY_TYPE_MAP.Something)
            // AST: CallExpression { callee: MemberExpression(sql.lit), arguments: [MemberExpression(ENTITY_TYPE_MAP.X)] }
            let valid = false;
            if (
              expr.type === 'CallExpression' &&
              expr.callee.type === 'MemberExpression' &&
              expr.callee.object.type === 'Identifier' &&
              expr.callee.object.name === 'sql' &&
              expr.callee.property.type === 'Identifier' &&
              expr.callee.property.name === 'lit' &&
              expr.arguments.length === 1 &&
              isEntityTypeMapAccess(expr.arguments[0])
            ) {
              valid = true;
            }

            if (!valid) {
              context.report({
                node: expr,
                messageId: 'nonMapLitArg',
              });
            }
          }
        }
      },
    };
  },
};
