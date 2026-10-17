# Docu Gentlemen
AI-powered document handling for business teams. Analyze text-based PDFs, DOCX files, and text documents to surface summaries, actions, dates, amounts, warnings, and key evidence.

## Run the backend

From the repository root, activate the Conda environment and install the backend dependencies:

```bash
conda activate samjhao-ai
python -m pip install -r backend/requirements.txt
```

Ensure `backend/.env` defines `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_MODEL`, then start the development server from the repository root:

```bash
python -m uvicorn main:app --app-dir backend --reload
```

Open `http://127.0.0.1:8000/docs` for the API docs. The health endpoint is `http://127.0.0.1:8000/api/health`.

## Run the React frontend

Keep the backend running, open a second terminal from the repository root, then run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server forwards `/api` requests to the backend at `http://127.0.0.1:8000`.
