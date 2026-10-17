from pydantic import BaseModel, Field


class AnalysisResult(BaseModel):
    """Structured fields returned by the document and image agents."""

    summary: str = Field(description="A simple explanation of the content")
    actions: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    amounts: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)


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
    evidence: list[str]
