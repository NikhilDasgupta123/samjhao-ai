import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.analyze import router as analyze_router
from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.api.routes.images import router as images_router
from app.api.routes.upload import router as upload_router
from app.services.ai_service import AIServiceError
from app.workflows.file_analysis import (
    DocumentTextNotFoundError,
    DocumentTooLargeError,
)

app = FastAPI(
    title="Docu Gentlemen API",
    version="0.1.0",
    description="AI-powered analysis for business documents and images via Cloudflare Workers AI",
)

cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(documents_router)
app.include_router(images_router)
app.include_router(upload_router)


@app.exception_handler(AIServiceError)
async def handle_ai_service_error(_request: Request, exc: AIServiceError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(DocumentTextNotFoundError)
async def handle_unreadable_document(_request: Request, exc: DocumentTextNotFoundError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(DocumentTooLargeError)
async def handle_large_document(_request: Request, exc: DocumentTooLargeError):
    return JSONResponse(status_code=413, content={"detail": str(exc)})


@app.get("/")
def root():
    return {"message": "Docu Gentlemen backend is running"}
