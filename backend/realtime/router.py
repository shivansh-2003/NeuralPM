from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from realtime.websocket_manager import manager

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(project_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive; client doesn't need to send anything meaningful
    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)
