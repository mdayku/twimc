// Run database migrations
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getPool } from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigrations() {
  console.log('🔄 Running database migrations...')

  try {
    const pool = getPool()

    // Execute statements in logical groups to handle dependencies
    // 1. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facts (
        facts_id VARCHAR(255) PRIMARY KEY,
        facts_json JSONB NOT NULL,
        attachments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY,
        facts_id VARCHAR(255) NOT NULL REFERENCES facts(facts_id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        draft_md TEXT NOT NULL,
        issues JSONB DEFAULT '[]'::jsonb,
        explanations JSONB DEFAULT '{}'::jsonb,
        input_hash VARCHAR(64),
        change_log JSONB DEFAULT '[]'::jsonb,
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(facts_id, version)
      );
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        jurisdiction VARCHAR(100),
        firm_style JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    // 2. Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_drafts_facts_id ON drafts(facts_id);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_drafts_version ON drafts(facts_id, version DESC);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_facts_created_at ON facts(created_at DESC);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_templates_jurisdiction ON templates(jurisdiction);`)

    // 3. Create function (needs to be a single statement)
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    // 4. Create triggers
    await pool.query(`
      DROP TRIGGER IF EXISTS update_facts_updated_at ON facts;
      CREATE TRIGGER update_facts_updated_at BEFORE UPDATE ON facts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `)

    await pool.query(`
      DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
      CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `)

    console.log('✅ Migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  import('../db.js').then(({ initDb, closeDb }) => {
    initDb()
    runMigrations()
      .then(() => closeDb())
      .catch((err) => {
        console.error(err)
        process.exit(1)
      })
  })
}

export { runMigrations }

