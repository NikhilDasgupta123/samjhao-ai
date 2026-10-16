# samjhao-ai
AI-powered document assistant that explains PDFs, images, screenshots, and text in simple language and extracts important actions, dates, amounts, and warnings.

## Run the backend

From the repository root, create and activate a virtual environment, then install the backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ensure `backend/.env` defines `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_MODEL`, then start the development server:

```bash
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the API docs. The health endpoint is `http://127.0.0.1:8000/api/health`.
