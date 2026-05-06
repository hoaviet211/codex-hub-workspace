CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE IF EXISTS memory_sessions
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE IF EXISTS memory_turns
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE IF EXISTS memory_facts
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE IF EXISTS memory_decisions
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE IF EXISTS memory_entities
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE IF EXISTS memory_relations
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE IF EXISTS memory_summaries
  ADD COLUMN IF NOT EXISTS project_id text;

CREATE TABLE IF NOT EXISTS memory_sessions (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  user_id text,
  title text,
  summary text,
  summary_embedding vector,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_sessions_workspace_updated_idx
  ON memory_sessions (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS memory_sessions_workspace_project_updated_idx
  ON memory_sessions (workspace_id, project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_turns (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid NOT NULL REFERENCES memory_sessions(id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'turn',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_turns_session_idx
  ON memory_turns (session_id, turn_index DESC);

CREATE INDEX IF NOT EXISTS memory_turns_workspace_created_idx
  ON memory_turns (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_turns_workspace_project_created_idx
  ON memory_turns (workspace_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_facts (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid REFERENCES memory_sessions(id) ON DELETE SET NULL,
  subject text NOT NULL,
  predicate text NOT NULL,
  object text,
  statement text NOT NULL,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 0.7,
  source_turn_id uuid REFERENCES memory_turns(id) ON DELETE SET NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  source text NOT NULL DEFAULT 'extracted',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_facts_workspace_status_idx
  ON memory_facts (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_facts_workspace_project_status_idx
  ON memory_facts (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_decisions (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid REFERENCES memory_sessions(id) ON DELETE SET NULL,
  task_id text,
  title text NOT NULL,
  decision text NOT NULL,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 0.8,
  source_turn_id uuid REFERENCES memory_turns(id) ON DELETE SET NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  source text NOT NULL DEFAULT 'extracted',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_decisions_workspace_status_idx
  ON memory_decisions (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_decisions_workspace_project_status_idx
  ON memory_decisions (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_entities (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid REFERENCES memory_sessions(id) ON DELETE SET NULL,
  canonical_name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'unknown',
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 0.6,
  source_turn_id uuid REFERENCES memory_turns(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'extracted',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_entities_workspace_status_idx
  ON memory_entities (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_entities_workspace_project_status_idx
  ON memory_entities (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_relations (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid REFERENCES memory_sessions(id) ON DELETE SET NULL,
  from_entity_id uuid REFERENCES memory_entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  to_entity_id uuid REFERENCES memory_entities(id) ON DELETE CASCADE,
  relation text NOT NULL,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 0.55,
  source_turn_id uuid REFERENCES memory_turns(id) ON DELETE SET NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  source text NOT NULL DEFAULT 'extracted',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_relations_workspace_status_idx
  ON memory_relations (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_relations_workspace_project_status_idx
  ON memory_relations (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_summaries (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid REFERENCES memory_sessions(id) ON DELETE CASCADE,
  summary text NOT NULL,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 0.75,
  source text NOT NULL DEFAULT 'summarizer',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_summaries_workspace_status_idx
  ON memory_summaries (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_summaries_workspace_project_status_idx
  ON memory_summaries (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_sources (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid,
  source_type text NOT NULL,
  source_path text NOT NULL,
  source_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_sources_scope_idx
  ON memory_sources (workspace_id, project_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS memory_candidates (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES memory_sources(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence double precision NOT NULL DEFAULT 0.5,
  suggested_destination text NOT NULL DEFAULT 'memory-service',
  conflicts_with jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'proposed',
  model text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  destination_record_id uuid
);

CREATE INDEX IF NOT EXISTS memory_candidates_scope_status_idx
  ON memory_candidates (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_items (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  session_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_candidate_id uuid NOT NULL REFERENCES memory_candidates(id) ON DELETE RESTRICT,
  embedding vector,
  confidence double precision NOT NULL DEFAULT 0.7,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_items_scope_status_idx
  ON memory_items (workspace_id, project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_reviews (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES memory_candidates(id) ON DELETE CASCADE,
  action text NOT NULL,
  reviewer text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_reviews_candidate_created_idx
  ON memory_reviews (candidate_id, created_at DESC);
