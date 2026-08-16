import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import get_settings
from core.db import Base

# import all models so Base.metadata has every table (FK targets must resolve)
from domain.projects.models import Project  # noqa: F401
from domain.members.models import Member  # noqa: F401
from domain.tasks.models import Task, TaskDependency  # noqa: F401
from domain.milestones.models import Milestone  # noqa: F401


@pytest.fixture(scope="function")
def db_session():
    settings = get_settings()
    engine = create_engine(settings.database_url)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()
