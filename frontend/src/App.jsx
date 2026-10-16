import { useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt"];

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" />
      <path d="M5 13.5v4A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-4" />
    </svg>
  );
}

function FileIcon({ type = "document" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" className={`file-icon file-icon-${type}`}>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4m-8 4h5m-5 3h5m-5 3h3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

function ResultSection({ title, icon, items = [], tone = "" }) {
  return (
    <section className={`result-card ${tone}`}>
      <div className="result-card-heading">
        <span className="result-icon" aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
        <span className="result-count">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="result-list">
          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
        </ul>
      ) : (
        <p className="empty-result">Nothing specific found in this document.</p>
      )}
    </section>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("english");
  const [analysis, setAnalysis] = useState(null);
  const [analyzedFilename, setAnalyzedFilename] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function chooseFile(nextFile) {
    if (!nextFile) return;

    if (nextFile.size > 10 * 1024 * 1024) {
      setError("This file is larger than 10 MB. Please choose a smaller file.");
      setFile(null);
      setAnalysis(null);
      return;
    }

    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("For now, Samjhao can analyze text-based PDF, DOCX, and TXT files. Image and OCR support is coming soon.");
      setFile(null);
      setAnalysis(null);
      return;
    }

    setError("");
    setAnalysis(null);
    setFile(nextFile);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || isLoading) return;

    setError("");
    setAnalysis(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);

    try {
      const response = await fetch("/api/documents/analyze", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail || "The document could not be analyzed. Please try again.");
      }

      setAnalysis(payload.analysis);
      setAnalyzedFilename(payload.filename || file.name);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Could not connect to the backend. Start the backend on port 8000 and try again."
          : requestError.message,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Samjhao AI home">
          <span className="brand-mark">s<span>.</span></span>
          <span className="brand-name">samjhao<span>ai</span></span>
        </a>
        <div className="topbar-right">
          <div className="availability"><span /> Your document, made clear</div>
          <a className="topbar-link" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
            API docs <ArrowIcon />
          </a>
        </div>
      </header>

      <main id="top" className="main-content">
        <section className="hero-grid" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> DOCUMENTS, DECODED</div>
            <h1 id="hero-title">Big words.<br />Small <span className="highlight-word">headache.</span></h1>
            <p className="hero-description">
              Drop in a document. Get the important bits in plain language, with dates, actions, and warnings pulled out for you.
            </p>

            <div className="feature-list">
              <div className="feature-item"><span className="feature-check">✓</span><span>A clear, simple summary</span></div>
              <div className="feature-item"><span className="feature-check">✓</span><span>Dates, amounts, and next steps</span></div>
              <div className="feature-item"><span className="feature-check">✓</span><span>Evidence from the document</span></div>
            </div>

            <div className="hero-footnote">
              <span className="sparkle">✳</span>
              Made for the fine print you don’t have time for.
            </div>
          </div>

          <form className="analyzer-card" onSubmit={handleSubmit}>
            <div className="card-topline">
              <span className="card-step"><span>01</span> START HERE</span>
              <span className="file-limit">MAX 10 MB</span>
            </div>

            <div className="card-intro">
              <h2>What needs explaining?</h2>
              <p>Choose a file and we’ll take it from here.</p>
            </div>

            {!file ? (
              <label
                className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
                htmlFor="document-file"
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  id="document-file"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                />
                <span className="upload-icon-wrap"><UploadIcon /></span>
                <span className="dropzone-title">Drop your file here</span>
                <span className="dropzone-subtitle">or <span className="browse-text">browse files</span></span>
                <span className="file-types"><span>PDF</span><span>DOCX</span><span>TXT</span></span>
              </label>
            ) : (
              <div className="selected-file">
                <span className="selected-file-icon"><FileIcon /></span>
                <span className="selected-file-info">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatFileSize(file.size)} <span className="file-dot">·</span> Ready to explain</span>
                </span>
                <button
                  className="remove-file"
                  type="button"
                  aria-label="Remove selected file"
                  onClick={() => { setFile(null); setAnalysis(null); setError(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                >
                  ×
                </button>
              </div>
            )}

            <div className="form-bottom-row">
              <label className="language-field">
                <span>Explain in</span>
                <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="english">English</option>
                  <option value="hindi">हिंदी</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </label>
              <button className="analyze-button" type="submit" disabled={!file || isLoading}>
                {isLoading ? <><span className="button-spinner" /> Reading</> : <>Make it make sense <ArrowIcon /></>}
              </button>
            </div>

            <p className="privacy-note"><span aria-hidden="true">⌑</span> Document text is sent to AI to generate your explanation.</p>

            {error && <div className="error-message" role="alert">{error}</div>}

            <div className="image-note">
              <span className="image-note-icon">↗</span>
              <span><strong>Have a photo or scan?</strong> Image and OCR support is coming soon.</span>
            </div>
          </form>
        </section>

        {analysis && (
          <section className="analysis-results" ref={resultRef} aria-labelledby="results-title" aria-live="polite">
            <div className="results-topline">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> YOUR DOCUMENT, DECODED</div>
                <h2 id="results-title">Here’s what matters.</h2>
              </div>
              <div className="analyzed-file"><FileIcon /><span>{analyzedFilename}</span></div>
            </div>

            <article className="summary-card">
              <div className="summary-label"><span className="summary-sparkle">✳</span> THE SHORT VERSION</div>
              <p>{analysis.summary || "No summary was returned for this document."}</p>
            </article>

            <div className="result-grid">
              <ResultSection title="Action items" icon="↗" items={analysis.actions} tone="action-card" />
              <ResultSection title="Important dates" icon="◷" items={analysis.dates} />
              <ResultSection title="Amounts" icon="$" items={analysis.amounts} />
              <ResultSection title="Warnings" icon="!" items={analysis.warnings} tone="warning-card" />
              <ResultSection title="From the document" icon="“" items={analysis.evidence} tone="evidence-card" />
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>samjhao<span className="footer-ai">ai</span></span>
        <span>Clearer documents. Calmer decisions.</span>
        <span className="footer-language">SAMJHAO <i>·</i> UNDERSTAND</span>
      </footer>
    </div>
  );
}
