# Building Skills for Claude

Reference for creating and maintaining skills in this project. Based on Anthropic's official guide.

## What is a Skill

A skill is a folder containing:

- `SKILL.md` (required): Instructions in Markdown with YAML frontmatter
- `scripts/` (optional): Executable code (Python, Bash, etc.)
- `references/` (optional): Documentation loaded as needed
- `assets/` (optional): Templates, fonts, icons used in output

## Progressive Disclosure (Three Levels)

1. **First level (YAML frontmatter)**: Always loaded in system prompt. Tells Claude WHEN to use the skill.
2. **Second level (SKILL.md body)**: Loaded when Claude decides the skill is relevant. Contains full instructions.
3. **Third level (linked files)**: Additional files in the skill directory, discovered only as needed.

Keep SKILL.md focused on core instructions. Move detailed docs to `references/` and link to them.

## Critical Rules

### SKILL.md naming

- Must be exactly `SKILL.md` (case-sensitive)
- No variations (SKILL.MD, skill.md, etc.)

### Skill folder naming

- Use kebab-case: `notion-project-setup`
- No spaces: ~~`Notion Project Setup`~~
- No underscores: ~~`notion_project_setup`~~
- No capitals: ~~`NotionProjectSetup`~~

### No README.md

- Don't include README.md inside your skill folder
- All documentation goes in SKILL.md or references/

## File Structure

```
your-skill-name/
  SKILL.md                    # Required
  scripts/                    # Optional - executable code
    process_data.py
    validate.sh
  references/                 # Optional - documentation
    api-guide.md
    examples/
  assets/                     # Optional - templates, etc.
    report-template.md
```

## YAML Frontmatter

The frontmatter is how Claude decides whether to load your skill. This is the most important part.

### Minimal required format

```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

### Field requirements

**name** (required):

- kebab-case only
- No spaces or capitals
- Should match folder name

**description** (required):

- MUST include BOTH: what the skill does AND when to use it (trigger conditions)
- Under 1024 characters
- No XML tags
- Include specific tasks users might say
- Mention file types if relevant
- Structure: `[What it does] + [When to use it] + [Key capabilities]`

**disable-model-invocation** (optional):

- Set to `true` to prevent the skill from being auto-triggered (only invoked via `/skill-name`)

**allowed-tools** (optional):

- Restrict which tools the skill can use (e.g., `Bash, Read, Grep, Glob`)

**argument-hint** (optional):

- Hint shown to user for expected arguments (e.g., `'[path]'`, `'[task]'`)

**license** (optional):

- MIT, Apache-2.0, etc.

**compatibility** (optional):

- 1-500 characters
- Environment requirements (e.g., intended product, required system packages, network access needs)

**metadata** (optional):

- Any custom key-value pairs (e.g., `author`, `version`, `mcp-server`)

### Security restrictions

- No XML angle brackets in frontmatter
- No skills with "claude" or "anthropic" in name

## Writing Good Descriptions

### Good examples

```yaml
# Specific and actionable
description: Analyzes Figma design files and generates developer handoff documentation. Use when user uploads .fig files, asks for "design specs", "component documentation", or "design-to-code handoff".

# Includes trigger phrases
description: Manages Linear project workflows including sprint planning, task creation, and status tracking. Use when user mentions "sprint", "Linear tasks", "project planning", or asks to "create tickets".

# Clear value proposition
description: End-to-end customer onboarding workflow for PayFlow. Handles account creation, payment setup, and subscription management. Use when user says "onboard new customer", "set up subscription", or "create PayFlow account".
```

### Bad examples

```yaml
# Too vague
description: Helps with projects.

# Missing triggers
description: Creates sophisticated multi-page documentation systems.

# Too technical, no user triggers
description: Implements the Project entity model with hierarchical relationships.
```

## Writing the Main Instructions

After the frontmatter, write actual instructions in Markdown.

### Recommended structure

````markdown
---
name: your-skill
description: [...]
---

# Your Skill Name

## Instructions

### Step 1: [First Major Step]

Clear explanation of what happens.

Example:

```bash
python scripts/fetch_data.py --project-id PROJECT_ID
Expected output: [describe what success looks like]
```
````

### Step 2: [Next Step]

...

## Examples

### Example 1: [common scenario]

User says: "..."
Actions:

1. ...
2. ...
   Result: ...

## Troubleshooting

### Error: [Common error message]

Cause: [Why it happens]
Solution: [How to fix]

```

### Best practices for instructions
- Be specific and actionable (e.g., `Run python scripts/validate.py --input {filename}` not `Validate the data`)
- Include error handling with common issues and fixes
- Reference bundled resources clearly (e.g., `Before writing queries, consult references/api-patterns.md`)
- Use bullet points and numbered lists, keep instructions concise
- Put critical instructions at the top, use `## Important` or `## Critical` headers
- Avoid ambiguous language (e.g., say `CRITICAL: Before calling create_project, verify: - Project name is non-empty - At least one team member assigned` not `Make sure to validate things properly`)
- Keep SKILL.md under 5,000 words. Move detailed docs to references/

## Common Skill Patterns

### Pattern 1: Sequential workflow orchestration
Use when: Multi-step processes in a specific order.
Key: Explicit step ordering, dependencies between steps, validation at each stage, rollback for failures.

### Pattern 2: Multi-MCP coordination
Use when: Workflows span multiple services.
Key: Clear phase separation, data passing between MCPs, validation before next phase.

### Pattern 3: Iterative refinement
Use when: Output quality improves with iteration.
Key: Explicit quality criteria, validation scripts, know when to stop iterating.

### Pattern 4: Context-aware tool selection
Use when: Same outcome, different tools depending on context.
Key: Clear decision criteria, fallback options, transparency about choices.

### Pattern 5: Domain-specific intelligence
Use when: Skill adds specialized knowledge beyond tool access.
Key: Domain expertise embedded in logic, compliance before action, comprehensive documentation.

## Troubleshooting

### Skill won't upload
- "Could not find SKILL.md": Rename to exactly `SKILL.md` (case-sensitive)
- "Invalid frontmatter": Must use `---` delimiters, check for unclosed quotes
- "Invalid skill name": Name has spaces or capitals, use kebab-case

### Skill doesn't trigger
- Description is too generic ("Helps with projects" won't work)
- Missing trigger phrases users would actually say
- Missing relevant file types
- Debug: Ask Claude "When would you use the [skill name] skill?" and adjust based on what's missing

### Skill triggers too often
- Add negative triggers (e.g., "Do NOT use for simple data exploration, use data-viz skill instead")
- Be more specific in description
- Clarify scope (e.g., "Use specifically for online payment workflows, not for general financial queries")

### Instructions not followed
- Instructions too verbose: keep concise, use bullet points
- Instructions buried: put critical ones at the top with `## Important` headers
- Ambiguous language: be explicit about what to check/verify
- Model "laziness": add explicit encouragement like `Take your time to do this thoroughly`

### Large context issues
- Skill content too large: keep SKILL.md under 5,000 words, link to references/
- Too many skills enabled: evaluate if 20+ skills are truly needed
```
