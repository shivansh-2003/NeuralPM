from domain.projects import service as project_service
from domain.projects.schemas import ProjectCreate
from domain.tasks import service as task_service
from domain.tasks.schemas import TaskCreate


def _make_task(db_session, project_id, title):
    return task_service.create_task(db_session, TaskCreate(project_id=project_id, title=title))


def test_downstream_dependency_chain(db_session):
    project = project_service.create_project(db_session, ProjectCreate(name="Chain Project"))

    task_a = _make_task(db_session, project.id, "A")
    task_b = _make_task(db_session, project.id, "B")
    task_c = _make_task(db_session, project.id, "C")

    # B depends on A, C depends on B  =>  A -> B -> C
    task_service.add_dependency(db_session, task_b.id, task_a.id)
    task_service.add_dependency(db_session, task_c.id, task_b.id)

    downstream = task_service.get_downstream(db_session, task_a.id, project.id)
    downstream_ids = [row["id"] for row in downstream]

    assert downstream_ids == [task_b.id, task_c.id]
