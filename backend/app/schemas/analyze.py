from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        description="Content that needs to be explained",
    )

    language: str = Field(
        default="english",
        description="Output language",
    )


class AnalyzeResponse(BaseModel):
    status: str
    language: str
    summary: str
    actions: list[str]
    dates: list[str]
    amounts: list[str]
    warnings: list[str]