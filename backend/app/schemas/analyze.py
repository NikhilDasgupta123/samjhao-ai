from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        description="Text that user wants to understand"
    )

    language: str = Field(
        default="english",
        description="Output language"
    )


class AnalyzeResponse(BaseModel):
    status: str
    language: str
    input_text: str