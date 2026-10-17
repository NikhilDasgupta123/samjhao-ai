# Backend map

[LangGraph + Stock Agent flow diagram](../docs/langgraph-stock-agent-flow.pdf)
[Market Catalyst Agent flow diagram](../docs/langgraph-catalyst-agent-flow.pdf)

```text
backend/
|-- main.py                         Public API service (port 8000)
|-- ai_service/                     Separate internal AI HTTP service (port 8001)
|   |-- main.py                     AI service app + error responses
|   |-- routes.py                   Analysis + stock catalyst endpoints
|-- requirements.txt                Python dependencies
|-- auth/                            Login, sessions, roles, admin users
|   |-- routes.py | admin.py         Auth and admin HTTP routes
|   |-- services.py                  Account and session operations
|   |-- dependencies.py              CurrentUser and AdminUser checks
|   |-- models.py | schemas.py        Database models and API shapes
|   |-- security.py | database.py     Password/session security + PostgreSQL
|   |-- cli.py                       Create the first admin account
|-- app/
    |-- api/routes/
    |   |-- health.py                GET /api/health
    |   |-- stock_routes.py          Public stock HTTP endpoints
    |-- core/
    |   |-- settings.py              Environment and .env configuration
    |   |-- flow_logger.py           Request IDs and terminal flow boxes
    |-- stocks/                      NSE market-data feature
    |   |-- schemas.py                Quote, history and market-watch models
    |   |-- symbols.py                NSE symbol normalization
    |   |-- errors.py                 NSE data errors
    |   |-- data/
    |       |-- market_data_service.py Quote/history calls and cache
    |       |-- nse_mcp_server.py     NSE MCP tools using jugaad-data
    |-- ai/                           AI logic and service client
        |-- client.py                 Public API -> AI service HTTP client
        |-- schemas.py | errors.py    Stock analysis types and AI errors
        |-- catalyst_schemas.py       Catalyst source, summary and response models
        |-- sources/                  GDELT news + DDGS web/social search
        |-- workflows/stock_analysis.py LangGraph flow and state
        |-- workflows/stock_catalysts.py Catalyst search + summary LangGraph
        |-- agents/stock_agent.py     PydanticAI Stock Agent
        |-- agents/catalyst_agent.py  PydanticAI Market Catalyst Agent
        |-- models/cloudflare.py      Cloudflare Workers AI connection
        |-- prompts/                    Agent instructions
```

```text
PUBLIC API | port 8000
POST /api/stocks/analyze
    -> auth + request validation
    -> app/ai/client.py
    -> HTTP POST http://127.0.0.1:8001/internal/stocks/analyze

AI SERVICE | port 8001
    -> ai_service/routes.py
    -> app/ai/workflows/stock_analysis.py
    -> app/stocks/data/market_data_service.py
    -> app/stocks/data/nse_mcp_server.py -> jugaad-data / NSE
    -> app/ai/agents/stock_agent.py -> app/ai/models/cloudflare.py
    -> StockResearchBrief -> public API response

POST /api/stocks/catalysts
    -> API forwards to POST /internal/stocks/catalysts
    -> app/ai/workflows/stock_catalysts.py
    -> GDELT news + DDGS public web/social search (in parallel)
    -> Market Catalyst Agent summarizes source titles with source IDs
    -> source links + possible factors -> frontend stock details
```

```text
GET  /api/stocks/market-watch
POST /api/stocks/market-data
    -> public API port 8000
    -> app/stocks/data/market_data_service.py
    -> local NSE MCP tools
```

```bash
# Terminal 1: public API
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2: AI service
cd backend
python -m uvicorn ai_service.main:app --reload --host 127.0.0.1 --port 8001
```

The analysis request waits for the AI result. LangGraph, NSE fetches, and Cloudflare calls run in the separate AI process, so that work does not execute inside the public API process. The API uses an async HTTP call while it waits, so it can continue serving other requests. Terminal 2 shows the LangGraph routing boxes. Both processes still share the machine, so CPU or memory pressure can affect both. For an immediate response while analysis continues in the background, add a job queue and return a job ID (202 Accepted).

Catalyst searches run only when a user opens a company's full details, not for all 500 companies at once. Results are cached in the AI process for 15 minutes. News and web searches target recent results from the past week. The web search uses the open-source DDGS metasearch library to search publicly indexed pages, blogs, and social posts, including X/Twitter, Facebook, Reddit, Stocktwits, LinkedIn, Threads, Instagram, and Telegram. Private, login-only, and non-indexed posts are unavailable. The summary uses headlines and search-result snippets rather than verified full posts, so displayed factors are possible coverage, not confirmed causes of price changes.

```text
Request path       -> app/api/routes/
Public API -> AI   -> app/ai/client.py
AI HTTP service    -> ai_service/
Login and roles    -> auth/
NSE tools          -> app/stocks/data/nse_mcp_server.py
Quote and cache    -> app/stocks/data/market_data_service.py
AI workflow       -> app/ai/workflows/stock_analysis.py
AI agent           -> app/ai/agents/stock_agent.py
Cloudflare model   -> app/ai/models/cloudflare.py
```

For a remote or container deployment, put the AI service on a private network and configure `AI_SERVICE_URL` to its private address; the local command binds it to `127.0.0.1` so it is reachable only from the same machine.
