"""Unified LangGraph for stock analysis and catalyst research."""

import asyncio
from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.ai.agents.catalyst_agent import summarize_stock_catalysts
from app.ai.agents.stock_agent import summarize_stock
from app.ai.catalyst_schemas import CatalystBrief
from app.ai.errors import AIServiceError
from app.ai.sources.news_search import search_stock_news
from app.ai.sources.web_search import search_stock_videos, search_stock_web
from app.ai.workflows.state import WorkflowState
from app.core.flow_logger import log_flow_event, new_flow_id
from app.stocks.data.market_data_service import fetch_stock_market_data
from app.stocks.errors import StockDataUnavailableError


def route_workflow(state: WorkflowState) -> str:
    task = state.get("task")
    if task is None:
        # Studio may initialize or inspect a thread before the user enters input.
        return END

    if task not in ("stock_analysis", "catalysts"):
        raise ValueError("Choose task 'stock_analysis' or 'catalysts'.")

    symbol = state.get("symbol")
    if not symbol:
        raise ValueError("Enter a stock symbol to run the workflow.")

    if task == "stock_analysis":
        log_flow_event(
            state["flow_id"],
            "LANGGRAPH ROUTING",
            f"NSE:{symbol} → Stock Agent → NSE MCP data tools",
        )
        return "fetch_market_data"

    if task == "catalysts":
        log_flow_event(
            state["flow_id"],
            "LANGGRAPH ROUTING",
            f"NSE:{symbol} → catalyst source search → Market Catalyst Agent",
        )
        return "search_sources"
    return END


def prepare_workflow_node(state: WorkflowState) -> dict:
    updates: dict[str, object] = {"flow_id": state.get("flow_id") or new_flow_id()}
    if state.get("task") == "stock_analysis":
        updates["question"] = state.get("question") or (
            "Give me a concise overview of the latest quote and recent price trend."
        )
        updates["history_days"] = state.get("history_days", 30)
    return updates


async def fetch_market_data_node(state: WorkflowState) -> dict:
    quote, history = await fetch_stock_market_data(
        state["symbol"], state["history_days"], state["flow_id"]
    )
    return {"quote": quote, "history": history}


async def stock_agent_node(state: WorkflowState) -> dict:
    flow_id = state["flow_id"]
    log_flow_event(flow_id, "STOCK AGENT", "PydanticAI → Cloudflare Workers AI text model")
    try:
        brief = await summarize_stock(
            symbol=state["symbol"],
            question=state["question"],
            quote=state["quote"],
            history=state["history"],
        )
    except AIServiceError as exc:
        log_flow_event(flow_id, "STOCK AGENT FAILED", type(exc).__name__)
        raise
    except Exception as exc:
        log_flow_event(
            flow_id,
            "MCP WORKFLOW FAILED",
            f"{type(exc).__name__}: {str(exc)[:160]}",
        )
        raise StockDataUnavailableError(
            f"Could not fetch NSE data for {state['symbol']}. Confirm the NSE symbol and try again."
        ) from exc

    log_flow_event(flow_id, "STOCK AGENT", "Research brief returned")
    return {"stock_brief": brief}


async def _run_source_search(search, *args):
    try:
        return await search(*args), None
    except Exception as exc:
        return [], f"{type(exc).__name__}: {str(exc)[:160]}"


async def search_sources_node(state: WorkflowState) -> dict:
    symbol = state["symbol"]
    company_name = state.get("company_name")
    flow_id = state["flow_id"]
    log_flow_event(
        flow_id,
        "CATALYST SOURCE SEARCH",
        f"Searching recent news + public web/social for {symbol}",
    )
    (news, news_error), (web, web_error), (videos, video_error) = await asyncio.gather(
        _run_source_search(search_stock_news, symbol, company_name),
        _run_source_search(search_stock_web, symbol, company_name),
        _run_source_search(search_stock_videos, symbol, company_name),
    )
    log_flow_event(
        flow_id,
        "CATALYST SOURCES READY",
        f"{len(news)} news links, {len(web)} public web/social links, {len(videos)} videos",
    )
    if news_error:
        log_flow_event(flow_id, "NEWS SEARCH UNAVAILABLE", news_error.split(":", 1)[0])
    if web_error:
        log_flow_event(flow_id, "WEB SEARCH UNAVAILABLE", web_error.split(":", 1)[0])
    if video_error:
        log_flow_event(flow_id, "VIDEO SEARCH UNAVAILABLE", video_error.split(":", 1)[0])
    return {
        "news": news,
        "web": web,
        "videos": videos,
        "news_error": news_error,
        "web_error": web_error,
        "video_error": video_error,
    }


async def catalyst_agent_node(state: WorkflowState) -> dict:
    news = state.get("news", [])
    web = state.get("web", [])
    videos = state.get("videos", [])
    if not news and not web and not videos:
        unavailable = bool(
            state.get("news_error") or state.get("web_error") or state.get("video_error")
        )
        return {
            "catalyst_brief": CatalystBrief(
                summary=(
                    "The source search is temporarily unavailable. Try searching again shortly."
                    if unavailable
                    else "No recent news articles, public web results, or videos were found for this search."
                ),
                factors=[],
            ),
            "summary_error": None,
        }

    try:
        brief = await summarize_stock_catalysts(
            symbol=state["symbol"],
            company_name=state.get("company_name"),
            news=news,
            web=web,
            videos=videos,
        )
        return {"catalyst_brief": brief, "summary_error": None}
    except Exception as exc:
        log_flow_event(state["flow_id"], "CATALYST SUMMARY UNAVAILABLE", type(exc).__name__)
        return {
            "catalyst_brief": CatalystBrief(
                summary="Source links are available, but the AI summary is temporarily unavailable. Review the linked headlines and search snippets.",
                factors=[],
            ),
            "summary_error": "AI summary is temporarily unavailable.",
        }


@lru_cache(maxsize=1)
def get_workflow_graph():
    workflow = StateGraph(WorkflowState)
    workflow.add_node("prepare_workflow", prepare_workflow_node)
    workflow.add_node("fetch_market_data", fetch_market_data_node)
    workflow.add_node("stock_agent", stock_agent_node)
    workflow.add_node("search_sources", search_sources_node)
    workflow.add_node("catalyst_agent", catalyst_agent_node)

    workflow.add_edge(START, "prepare_workflow")
    workflow.add_conditional_edges(
        "prepare_workflow",
        route_workflow,
        {
            "fetch_market_data": "fetch_market_data",
            "search_sources": "search_sources",
            END: END,
        },
    )
    workflow.add_edge("fetch_market_data", "stock_agent")
    workflow.add_edge("stock_agent", END)
    workflow.add_edge("search_sources", "catalyst_agent")
    workflow.add_edge("catalyst_agent", END)
    return workflow.compile()


# Export the compiled graph for LangGraph CLI / Studio.
studio_graph = get_workflow_graph()
