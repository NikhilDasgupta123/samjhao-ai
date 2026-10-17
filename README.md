# Docu Gentlemen
AI analysis for business documents and images using Cloudflare Workers AI. PDF, DOCX, and TXT files go through text extraction; JPG, PNG, and WEBP files go through a separate vision route. LangGraph routes each request to a PydanticAI agent, which returns a validated analysis schema.

## Cloudflare model setup

Create a Cloudflare API token with `Workers AI - Read` and `Workers AI - Edit` permissions, then copy the example environment file and add your account credentials:

```bash
cp backend/.env.example backend/.env
```

`CLOUDFLARE_MODEL` configures the text model, while `CLOUDFLARE_VISION_MODEL` configures image analysis. The defaults use Llama 3.1 8B for text and Llama 3.2 11B Vision for images. Llama 3.2 11B Vision requires a one-time acceptance of Meta's license and acceptable use policy before first use. Cloudflare currently includes 10,000 Workers AI Neurons per day on the Free plan; see [current pricing and limits](https://developers.cloudflare.com/workers-ai/platform/pricing/) for details.

## Run the backend

From the repository root, activate the Conda environment and install the backend dependencies:

```bash
conda activate samjhao-ai
python -m pip install -r backend/requirements.txt
```

Start the development server from the repository root:

```bash
python -m uvicorn main:app --app-dir backend --reload
```

Open `http://127.0.0.1:8000/docs` for the API docs. The health endpoint is `http://127.0.0.1:8000/api/health`.

## Local PostgreSQL database

Start PostgreSQL from the repository root:

```bash
docker compose up -d postgres
docker compose ps
docker compose logs -f postgres
```

The backend uses these local connection settings by default:

```text
Host:     127.0.0.1
Port:     5432
Database: samjhao
User:     samjhao
Password: samjhao_local_dev
```

The Compose file binds the database port to this computer only and keeps data in the `postgres_data` Docker volume. These credentials are for local development; set `POSTGRES_PASSWORD` in the repository-root `.env` file to override the local default. The API connects to PostgreSQL at startup and creates the auth tables if they do not exist.

### Authentication and roles

Copy the backend environment example, then add your Cloudflare credentials:

```bash
cp backend/.env.example backend/.env
```

The default `DATABASE_URL` matches the Compose database above. After installing requirements and starting PostgreSQL, create the first administrator from the backend directory:

```bash
cd backend
python -m auth.cli create-admin
```

The command prompts for an email and password. Public sign-up always creates a `user`; there is no public admin selector. An administrator can list accounts and change other users' roles from the workspace's **Users** tab. The last remaining admin cannot be demoted.

Clicking **Enter** opens `/auth` when signed out and `/workspace` when a valid session exists. Sign-in and sign-up create an HTTP-only session cookie. The API stores only a hash of each random session token in PostgreSQL. Logout deletes the active server-side session. The document, image, and text-analysis endpoints require a signed-in user; `/api/health` stays public.

Authentication endpoints:

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/signup` | Public; creates a user and signs them in |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Signed in |
| POST | `/api/auth/logout` | Signed in |
| GET | `/api/admin/users` | Admin |
| PATCH | `/api/admin/users/{user_id}/role` | Admin |

For a separate frontend and backend deployment, use a persistent PostgreSQL `DATABASE_URL`, set `AUTH_COOKIE_SECURE=true` and `AUTH_COOKIE_SAMESITE=none`, and list the exact frontend origin in `CORS_ORIGINS`. For same-site local development, the example uses an insecure local cookie with `SameSite=Lax`. The first version creates tables with SQLAlchemy `create_all`; add versioned migrations before changing deployed schemas.

### Backend layout

```text
backend/
├── auth/                  # Authentication and role-based access control
│   ├── admin.py             # Admin-only user and role endpoints
│   ├── cli.py               # Admin account creation command
│   ├── database.py          # Auth database engine and request sessions
│   ├── dependencies.py      # Current-user and admin authorization
│   ├── models.py            # User and login-session tables
│   ├── routes.py            # Signup, login, current-user, and logout endpoints
│   ├── schemas.py           # Auth request/response validation
│   ├── security.py          # Password hashing and session tokens
│   └── services.py          # Signup, login, and session persistence
└── app/
    ├── agents/              # PydanticAI document and image agents, Cloudflare model setup
    ├── api/routes/          # Document, image, text, upload, and health endpoints
    ├── core/                # Runtime configuration and workflow logging
    ├── prompts/             # Agent instructions
    ├── schemas/             # Analysis request/response models
    ├── services/            # File validation and format-specific extraction
    └── workflows/           # LangGraph file type routing and analysis flow
```

The upload endpoints are `POST /api/documents/analyze` for PDF/DOCX/TXT and `POST /api/images/analyze` for JPG/PNG/WEBP. `POST /api/analyze` accepts plain text.

### Analysis flow

```mermaid
flowchart TD
    User[User uploads content] --> DocAPI[POST /api/documents/analyze]
    User --> ImageAPI[POST /api/images/analyze]
    User --> TextAPI[POST /api/analyze]

    DocAPI --> Validate[Validate file type and 10 MB size limit]
    ImageAPI --> Validate
    Validate --> Graph[LangGraph workflow]
    TextAPI --> TextState[Create text/plain workflow state]
    TextState --> Graph

    Graph --> IsImage{Does content type start with image/?}
    IsImage -->|Yes| VisionAgent[PydanticAI image agent]
    VisionAgent --> VisionModel[Cloudflare vision model]

    IsImage -->|No| Extract[Extract PDF, DOCX, or TXT text]
    Extract --> Readable{Readable text and within 20,000 characters?}
    Readable -->|No| FileError[Return a clear file error]
    Readable -->|Yes| DocumentAgent[PydanticAI document agent]
    DocumentAgent --> TextModel[Cloudflare text model]

    VisionModel --> Result[Validate AnalysisResult schema]
    TextModel --> Result
    Result --> Response[Return structured JSON response]
```

The document and image endpoints validate their allowed file types before starting the graph. Inside LangGraph, the image MIME type selects the vision branch; PDF, DOCX, TXT, and plain-text requests use the extraction and document-analysis branch.

### Live terminal logs

Run the backend normally with Uvicorn. It prints one box at each workflow step, and the short request ID lets you follow one request when multiple uploads are processing:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ a1b2c3d4 | LANGGRAPH ROUTING                                           │
│ image/png → image branch (vision agent → Cloudflare vision model)      │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ a1b2c3d4 | IMAGE AGENT                                                 │
│ Cloudflare vision model | image/png | 84,212 bytes                     │
└────────────────────────────────────────────────────────────────────────┘
```

Document requests additionally show upload validation, text extraction, the document agent, and the final API response. Uploaded content itself is not written to these flow logs.

## Run the React frontend

Keep the backend running, open a second terminal from the repository root, then run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server forwards `/api` requests to the backend at `http://127.0.0.1:8000`.

## Free deployment (separate frontend and backend)

The React/Vite frontend can run on Cloudflare Pages and the FastAPI backend on Render. The backend calls Cloudflare Workers AI directly, so it needs Cloudflare credentials but does not need a separate model server.

### 1. Deploy the backend on Render

Create a **Web Service** from this repository and set:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- Instance type: **Free**
- Health check path: `/api/health`

Add these environment variables in Render:

```text
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct
CLOUDFLARE_VISION_MODEL=@cf/meta/llama-3.2-11b-vision-instruct
CORS_ORIGINS=https://your-project.pages.dev
DATABASE_URL=your-persistent-postgresql-connection-string
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
```

Set `CORS_ORIGINS` to the exact `https://...pages.dev` origin with no trailing slash. The backend will be available at a Render URL such as `https://your-api.onrender.com`.

### 2. Deploy the frontend on Cloudflare Pages

Create a Pages project from the same repository with:

- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

Add this Pages environment variable for the production environment, then deploy:

```text
VITE_API_BASE_URL=https://your-api.onrender.com
NODE_VERSION=22
```

Use the backend's base URL only (no `/api` suffix). Once Pages gives you its `https://...pages.dev` URL, add that exact URL to Render's `CORS_ORIGINS` and redeploy the backend if needed. The Vite proxy remains enabled for local development. Use a managed, persistent PostgreSQL database for deployed user accounts and sessions; the local Docker database is only reachable on your computer.

### Free-tier behavior

- Render's free backend sleeps after 15 minutes without traffic; its first request after sleeping can take about a minute. Its filesystem is temporary, so don't use it to store uploaded files or durable records.
- The current document analysis history is held in browser memory and clears when the page reloads; user accounts and login sessions are stored in PostgreSQL.
- Model inference uses Cloudflare Workers AI. Its included allocation and any additional charges depend on current Cloudflare pricing and usage limits.
