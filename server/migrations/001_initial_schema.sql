-- Initial schema for Steno Demand Letter Generator
-- Run this migration to set up the database tables

-- Facts table: stores case facts and metadata
CREATE TABLE IF NOT EXISTS facts (
  facts_id VARCHAR(255) PRIMARY KEY,
  facts_json JSONB NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drafts table: stores draft versions linked to facts
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

-- Templates table: stores demand letter templates
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drafts_facts_id ON drafts(facts_id);
CREATE INDEX IF NOT EXISTS idx_drafts_version ON drafts(facts_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_facts_created_at ON facts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_jurisdiction ON templates(jurisdiction);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_facts_updated_at BEFORE UPDATE ON facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

