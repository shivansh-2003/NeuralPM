from domain.projects import service
from domain.projects.schemas import ProjectCreate


def test_create_and_get_project(db_session):
    project = service.create_project(db_session, ProjectCreate(name="Test Project"))
    fetched = service.get_project(db_session, project.id)
    assert fetched.name == "Test Project"
    assert fetched.status == "active"
