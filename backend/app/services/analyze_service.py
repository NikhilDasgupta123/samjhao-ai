from app.schemas.analyze import AnalyzeRequest


def analyze_text(request: AnalyzeRequest) -> dict:
    return {
        "status": "success",
        "language": request.language,
        "input_text": request.text
    }