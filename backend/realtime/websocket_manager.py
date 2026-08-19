import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, project_id: str, ws: WebSocket):
        await ws.accept()
        self.connections[project_id].append(ws)

    def disconnect(self, project_id: str, ws: WebSocket):
        if ws in self.connections.get(project_id, []):
            self.connections[project_id].remove(ws)

    async def _broadcast_async(self, project_id: str, message: dict):
        dead = []
        for ws in self.connections.get(project_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(project_id, ws)


manager = ConnectionManager()


def broadcast(project_id: str, message: dict):
    """Sync-callable wrapper — safe to call from service.py without awaiting."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager._broadcast_async(project_id, message))
    except RuntimeError:
        asyncio.run(manager._broadcast_async(project_id, message))
