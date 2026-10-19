from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.health import router as health_router
from app.api.routes.market_routes import router as market_router
from app.api.routes.stock_routes import router as stocks_router
from app.core.settings import settings
from app.ai.errors import AIServiceError
from app.stocks.errors import StockDataUnavailableError
from auth.admin import router as admin_router
from auth.database import initialize_auth_database
from auth.routes import router as auth_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_auth_database()
    yield


app = FastAPI(
    title="MarketBrief AI API",
    version="0.1.0",
    description="Indian stock research using NSE data from jugaad-data MCP tools and Cloudflare Workers AI",
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
app.include_router(stocks_router)
app.include_router(market_router)


@app.exception_handler(AIServiceError)
async def handle_ai_service_error(_request: Request, exc: AIServiceError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(StockDataUnavailableError)
async def handle_stock_data_error(_request: Request, exc: StockDataUnavailableError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/")
def root():
    return {"message": "MarketBrief AI backend is running"}
