"""Public interface for AI response generation."""

from app.services.ai_service.errors import AIServiceError
from app.services.ai_service.llm import get_llm

__all__ = ["AIServiceError", "get_llm"]
