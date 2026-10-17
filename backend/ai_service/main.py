from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.ai.errors import AIServiceError
from app.stocks.errors import StockDataUnavailableError
from ai_service.routes import router as ai_router


app = FastAPI(
    title="MarketBrief AI Worker",
    version="0.1.0",
    description="Private service for LangGraph stock analysis and Cloudflare Workers AI.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.include_router(ai_router)


@app.exception_handler(AIServiceError)
async def handle_ai_service_error(_request: Request, exc: AIServiceError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(StockDataUnavailableError)
async def handle_stock_data_error(_request: Request, exc: StockDataUnavailableError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai"}
