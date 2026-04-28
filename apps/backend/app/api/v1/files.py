import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".docx", ".xlsx"}

router = APIRouter(prefix="/files", tags=["files"])


class FileUploadResponse(BaseModel):
    id: str
    name: str
    content_type: str
    size: int


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20MB limit")

    file_id = str(uuid.uuid4())
    (UPLOADS_DIR / f"{file_id}{ext}").write_bytes(data)

    return FileUploadResponse(
        id=file_id,
        name=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        size=len(data),
    )


@router.get("/{file_id}")
async def get_file(file_id: str):
    if not all(c.isalnum() or c == "-" for c in file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")

    matches = list(UPLOADS_DIR.glob(f"{file_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")

    path = matches[0]
    return FileResponse(
        path,
        headers={"Content-Disposition": f'inline; filename="{path.name}"'},
    )
