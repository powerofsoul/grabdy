import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS agent.mastra_messages;
    DROP TABLE IF EXISTS agent.mastra_threads;
    DROP TABLE IF EXISTS agent.mastra_agents;
    DROP TABLE IF EXISTS agent.mastra_agent_versions;
    DROP TABLE IF EXISTS agent.mastra_ai_spans;
    DROP TABLE IF EXISTS agent.mastra_observational_memory;
    DROP TABLE IF EXISTS agent.mastra_resources;
    DROP TABLE IF EXISTS agent.mastra_scorers;
    DROP TABLE IF EXISTS agent.mastra_workflow_snapshot;
  `.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Mastra tables replaced by agent.chat_messages, not recreating
}
