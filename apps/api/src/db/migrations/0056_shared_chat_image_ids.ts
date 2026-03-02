import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.shared_chats ADD COLUMN image_ids UUID[] NOT NULL DEFAULT '{}';

    ALTER TABLE data.shared_chats ADD CONSTRAINT chk_shared_chats_image_ids_org
      CHECK (
        NOT EXISTS (
          SELECT 1 FROM unnest(image_ids) AS img_id
          WHERE extract_org_numeric_id(img_id) != extract_org_numeric_id(org_id)
        )
      );

    ALTER TABLE data.shared_chats ADD CONSTRAINT chk_shared_chats_image_ids_entity_type
      CHECK (
        NOT EXISTS (
          SELECT 1 FROM unnest(image_ids) AS img_id
          WHERE extract_entity_type(img_id) != ${sql.lit(ENTITY_TYPE_MAP.ExtractedImage)}
        )
      );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.shared_chats DROP CONSTRAINT IF EXISTS chk_shared_chats_image_ids_entity_type;
    ALTER TABLE data.shared_chats DROP CONSTRAINT IF EXISTS chk_shared_chats_image_ids_org;
    ALTER TABLE data.shared_chats DROP COLUMN image_ids;
  `.execute(db);
}
