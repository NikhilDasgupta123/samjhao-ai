from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.analyze import router as analyze_router
from app.api.routes.upload import router as upload_router

app = FastAPI(
    title="Samjhao AI API",
    version="0.1.0",
    description="Backend API for Samjhao AI"
)


app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(upload_router)

@app.get("/")
def root():
    return {
        "message": "Samjhao AI backend is running"
    }