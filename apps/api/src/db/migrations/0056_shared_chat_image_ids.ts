import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.shared_chats ADD COLUMN image_ids UUID[] NOT NULL DEFAULT '{}';

    CREATE OR REPLACE FUNCTION data.validate_shared_chat_image_ids()
    RETURNS TRIGGER AS $$
    DECLARE
      img_id UUID;
    BEGIN
      FOREACH img_id IN ARRAY NEW.image_ids LOOP
        IF extract_org_numeric_id(img_id) != extract_org_numeric_id(NEW.org_id) THEN
          RAISE EXCEPTION 'image_ids contains ID from wrong org: %', img_id;
        END IF;
        IF extract_entity_type(img_id) != ${sql.lit(ENTITY_TYPE_MAP.ExtractedImage)} THEN
          RAISE EXCEPTION 'image_ids contains non-ExtractedImage ID: %', img_id;
        END IF;
      END LOOP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_shared_chats_validate_image_ids
      BEFORE INSERT OR UPDATE OF image_ids ON data.shared_chats
      FOR EACH ROW
      WHEN (cardinality(NEW.image_ids) > 0)
      EXECUTE FUNCTION data.validate_shared_chat_image_ids();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS trg_shared_chats_validate_image_ids ON data.shared_chats;
    DROP FUNCTION IF EXISTS data.validate_shared_chat_image_ids();
    ALTER TABLE data.shared_chats DROP COLUMN image_ids;
  `.execute(db);
}
