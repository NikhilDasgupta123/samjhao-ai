# Backend map

[Detailed LangGraph + Stock Agent flow diagram](../docs/langgraph-stock-agent-flow.pdf)

```text
backend/
|-- main.py                         FastAPI app and router registration
|-- requirements.txt                Python dependencies
|-- auth/                            Login, sessions, roles, admin users
|   |-- routes.py                    Signup, login, current user, logout
|   |-- admin.py                     Admin-only user routes
|   |-- services.py                  Account and session operations
|   |-- dependencies.py              CurrentUser and AdminUser access checks
|   |-- models.py | schemas.py        Database models and API shapes
|   |-- security.py | database.py     Password/session security and PostgreSQL
|   |-- cli.py                       Create the first admin account
|-- app/
    |-- api/routes/
    |   |-- health.py                GET /api/health
    |   |-- stock_routes.py          Stock HTTP endpoints
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
    |-- ai/                           AI application logic
        |-- schemas.py                 Analysis request, brief and response models
        |-- errors.py                  AI provider errors
        |-- workflows/
        |   |-- stock_analysis.py     LangGraph flow and request state
        |-- agents/
        |   |-- stock_agent.py        PydanticAI Stock Agent
        |-- models/
        |   |-- cloudflare.py         Cloudflare Workers AI connection
        |-- prompts/
            |-- stock_analysis.py     Stock Agent instructions
```

```text
POST /api/stocks/analyze
    -> app/api/routes/stock_routes.py
    -> app/ai/workflows/stock_analysis.py
    -> app/stocks/data/market_data_service.py
    -> app/stocks/data/nse_mcp_server.py
    -> jugaad-data / NSE
    -> app/ai/agents/stock_agent.py
    -> app/ai/models/cloudflare.py
    -> StockResearchBrief
```

```text
GET  /api/stocks/market-watch
POST /api/stocks/market-data
    -> stock_routes.py
    -> stocks/data/market_data_service.py
    -> stocks/data/nse_mcp_server.py
    -> quote / history response
```

```text
Request path      -> app/api/routes/
Login and roles   -> auth/
Environment       -> app/core/settings.py
NSE tools         -> app/stocks/data/nse_mcp_server.py
Quote and cache   -> app/stocks/data/market_data_service.py
NSE schemas/errors -> app/stocks/schemas.py | app/stocks/errors.py
AI workflow       -> app/ai/workflows/stock_analysis.py
AI agent          -> app/ai/agents/stock_agent.py
AI schemas/errors -> app/ai/schemas.py | app/ai/errors.py
Prompt            -> app/ai/prompts/stock_analysis.py
Cloudflare model  -> app/ai/models/cloudflare.py
```
