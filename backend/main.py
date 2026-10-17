from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.analyze import router as analyze_router
from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.api.routes.images import router as images_router
from app.api.routes.upload import router as upload_router
from app.core.config import settings
from app.services.ai_service import AIServiceError
from app.workflows.file_analysis import (
    DocumentTextNotFoundError,
    DocumentTooLargeError,
)
from auth.admin import router as admin_router
from auth.database import initialize_auth_database
from auth.routes import router as auth_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_auth_database()
    yield


app = FastAPI(
    title="Docu Gentlemen API",
    version="0.1.0",
    description="AI-powered analysis for business documents and images via Cloudflare Workers AI",
    lifespan=lifespan,
)

cors_origins = [origin.strip().rstrip("/") for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.middleware("http")
async def check_request_origin(request: Request, call_next):
    """Reject cross-site browser form/fetch requests that could use the session cookie."""
    origin = request.headers.get("origin")
    if origin and request.method not in {"GET", "HEAD", "OPTIONS"}:
        request_origin = f"{urlsplit(str(request.base_url)).scheme}://{urlsplit(str(request.base_url)).netloc}"
        if origin.rstrip("/") not in {*cors_origins, request_origin}:
            return JSONResponse(status_code=403, content={"detail": "Request origin is not allowed."})
    return await call_next(request)


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(admin_router)
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
