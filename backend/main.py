from fastapi import FastAPI

from app.api.routes.analyze import router as analyze_router
from app.api.routes.health import router as health_router
from app.api.routes.upload import router as upload_router

app = FastAPI(
    title="Docu Gentlemen API",
    version="0.1.0",
    description="AI-powered document analysis for business teams",
)

app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(upload_router)


@app.get("/")
def root():
    return {"message": "Docu Gentlemen backend is running"}
