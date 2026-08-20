"""add memory_events table

Revision ID: ed66c68f321d
Revises: e548cbdf6d5f
Create Date: 2026-08-20 19:30:03.900568

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'ed66c68f321d'
down_revision: Union[str, Sequence[str], None] = 'e548cbdf6d5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'memory_events',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        # requirement_update | casual_chat | preference_signal | assignment | risk_flag | timeline_shift
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('agent_source', sa.String(length=50), nullable=True),
        # AssignmentAgent | RiskAgent | CascadeAgent | MemoryAgent | user
        sa.Column('member_id', sa.UUID(), nullable=True),
        sa.Column('sprint_id', sa.UUID(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        # Decay fields — populated with defaults now, acted on by Phase 1.5's Celery jobs later
        sa.Column('relevance_score', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('superseded_by', sa.UUID(), nullable=True),
        sa.Column('memory_tier', sa.String(length=20), server_default='active', nullable=False),
        # active | compressed | archived
        sa.Column('last_accessed', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('access_count', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['superseded_by'], ['memory_events.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("memory_tier IN ('active', 'compressed', 'archived')", name='valid_tier'),
        sa.CheckConstraint('relevance_score >= 0.0 AND relevance_score <= 1.0', name='valid_score'),
    )
    op.create_index(
        'idx_memory_events_project', 'memory_events',
        [sa.text("(metadata->>'project_id')")],
    )
    op.create_index('idx_memory_events_tier', 'memory_events', ['memory_tier'])
    op.create_index('idx_memory_events_score', 'memory_events', ['relevance_score'])
    op.create_index('idx_memory_events_accessed', 'memory_events', ['last_accessed'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_memory_events_accessed', table_name='memory_events')
    op.drop_index('idx_memory_events_score', table_name='memory_events')
    op.drop_index('idx_memory_events_tier', table_name='memory_events')
    op.drop_index('idx_memory_events_project', table_name='memory_events')
    op.drop_table('memory_events')
