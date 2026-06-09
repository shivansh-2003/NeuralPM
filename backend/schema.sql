-- NeuralPM Postgres Schema
-- Run: psql $DATABASE_URL < schema.sql
--
-- Iteration coverage:
--   I-0/I-1: memory_events (core memory layer)
--   I-3:     tasks, members, assignment_history, sprints
--   I-5:     risk_log
--   I-6:     task_dependencies, milestones, cascade_log
--   I-4/I-7: user_preference_memory
--
-- NOTE: No `embedding` column anywhere — vectors live exclusively in Qdrant.
--       The UUID in memory_events.id == the Qdrant point ID.

-- ─────────────────────────────────────────────────────────────────────────────
-- I-0 / I-1 — Memory Layer
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memory_events (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id          UUID,
    event_type       VARCHAR(50) NOT NULL,
    -- requirement_update | assignment | risk_flag | timeline_shift | preference_signal
    description      TEXT,
    agent_source     VARCHAR(50),
    -- AssignmentAgent | RiskAgent | CascadeAgent | MemoryAgent | user
    member_id        UUID,
    sprint_id        UUID,
    metadata         JSONB,
    timestamp        TIMESTAMP   NOT NULL DEFAULT NOW(),

    -- Decay fields — updated by Celery Beat (Iteration 2)
    relevance_score  FLOAT       NOT NULL DEFAULT 1.0,
    superseded_by    UUID        REFERENCES memory_events(id),
    memory_tier      VARCHAR(20) NOT NULL DEFAULT 'active',
    -- active | compressed | archived
    last_accessed    TIMESTAMP   NOT NULL DEFAULT NOW(),
    access_count     INT         NOT NULL DEFAULT 0,

    CONSTRAINT valid_tier CHECK (memory_tier IN ('active', 'compressed', 'archived')),
    CONSTRAINT valid_score CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0)
);

CREATE INDEX IF NOT EXISTS idx_memory_events_project
    ON memory_events ((metadata->>'project_id'));
CREATE INDEX IF NOT EXISTS idx_memory_events_tier
    ON memory_events (memory_tier);
CREATE INDEX IF NOT EXISTS idx_memory_events_score
    ON memory_events (relevance_score);
CREATE INDEX IF NOT EXISTS idx_memory_events_accessed
    ON memory_events (last_accessed);

-- ─────────────────────────────────────────────────────────────────────────────
-- I-3 — Assignment Agent
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sprints (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name       TEXT NOT NULL,
    start_date TIMESTAMP,
    end_date   TIMESTAMP,
    status     VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID    NOT NULL,
    name            TEXT    NOT NULL,
    role            VARCHAR(100),
    skills          JSONB,
    -- [{"skill": "python", "proficiency": 4}, ...]  proficiency 1-5
    capacity        INT     NOT NULL DEFAULT 100,   -- story points per sprint
    active_points   INT     NOT NULL DEFAULT 0,     -- currently assigned
    velocity_avg    FLOAT   NOT NULL DEFAULT 0,     -- rolling avg sp/sprint
    availability    VARCHAR(20) NOT NULL DEFAULT 'available',
    -- available | partial | pto | deactivated
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID        NOT NULL,
    sprint_id        UUID        REFERENCES sprints(id),
    title            TEXT        NOT NULL,
    description      TEXT,
    category         VARCHAR(50),
    -- frontend | backend | api | testing | devops
    severity         VARCHAR(20),
    -- critical | high | medium | low
    urgency          VARCHAR(20),
    -- immediate | this_sprint | next_sprint | backlog
    status           VARCHAR(20) NOT NULL DEFAULT 'backlog',
    -- backlog | assigned | ongoing | review | completed | cancelled
    required_skills  JSONB,
    -- [{"skill": "stripe", "weight": 0.8}, ...]
    affected_module  VARCHAR(100),
    estimated_points INT,
    progress_pct     INT         NOT NULL DEFAULT 0,
    due_date         TIMESTAMP,
    assignee_id      UUID        REFERENCES members(id),
    created_at       TIMESTAMP   DEFAULT NOW(),
    updated_at       TIMESTAMP   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_history (
    id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id               UUID    REFERENCES tasks(id),
    member_id             UUID    REFERENCES members(id),
    manager_id            UUID,
    project_id            UUID    NOT NULL,
    was_agent_suggestion  BOOLEAN NOT NULL DEFAULT TRUE,
    was_override          BOOLEAN NOT NULL DEFAULT FALSE,
    agent_top_pick_id     UUID    REFERENCES members(id),
    raw_score             FLOAT,
    final_score           FLOAT,
    preference_applied    BOOLEAN NOT NULL DEFAULT FALSE,
    rationale             TEXT,
    assigned_at           TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- I-4 / I-7 — Preference Learning (all agents)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preference_memory (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID    NOT NULL,
    preference_type  VARCHAR(50) NOT NULL,
    -- assignment_override | risk_tolerance | timeline_philosophy | communication_style
    preference_value JSONB   NOT NULL,
    confidence       FLOAT   NOT NULL DEFAULT 0.0,
    evidence_count   INT     NOT NULL DEFAULT 0,
    last_observed    TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

CREATE INDEX IF NOT EXISTS idx_pref_user_type
    ON user_preference_memory (user_id, preference_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- I-5 — Risk Agent
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_log (
    id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id               UUID    NOT NULL,
    risk_type                VARCHAR(50) NOT NULL,
    -- stale | overload | deadline | blocker_chain
    severity                 VARCHAR(20) NOT NULL,
    -- critical | high | medium | low | suppressed | escalated
    affected_task_id         UUID    REFERENCES tasks(id),
    affected_member_id       UUID    REFERENCES members(id),
    description              TEXT,
    suggested_action         TEXT,
    agent_reasoning          TEXT,
    status                   VARCHAR(20) NOT NULL DEFAULT 'open',
    -- open | acknowledged | resolved | dismissed | suppressed
    suppressed_by_preference BOOLEAN NOT NULL DEFAULT FALSE,
    suppression_reason       TEXT,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- I-6 — Cascade Agent
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on
    ON task_dependencies (depends_on_id);

CREATE TABLE IF NOT EXISTS milestones (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID    NOT NULL,
    title       TEXT    NOT NULL,
    due_date    TIMESTAMP NOT NULL,
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE = hard client commitment
    description TEXT
);

CREATE TABLE IF NOT EXISTS cascade_log (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID    NOT NULL,
    trigger_task_id  UUID    REFERENCES tasks(id),
    manager_id       UUID,
    original_dates   JSONB,
    -- {task_id: iso_date_string, ...}
    revised_dates    JSONB,
    conflict_flags   JSONB,
    mitigation_chosen VARCHAR(50),
    -- scope_cut | buffer | parallelize | standard
    simulate_only    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT NOW()
);
