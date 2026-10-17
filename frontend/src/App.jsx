import { useEffect, useRef, useState } from "react";

const DOCUMENT_EXTENSIONS = ["pdf", "docx", "txt"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const ACCEPTED_EXTENSIONS = [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS];
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_DOCS_URL = API_BASE_URL ? `${API_BASE_URL}/docs` : "http://127.0.0.1:8000/docs";

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
        <p className="empty-result">Nothing specific found in this file.</p>
      )}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="m12.7 12.7 4 4" />
    </svg>
  );
}

function DashboardStat({ icon, label, value, detail, tone }) {
  return (
    <article className={`dashboard-stat ${tone}`}>
      <span className="dashboard-stat-icon" aria-hidden="true">{icon}</span>
      <span className="dashboard-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="dashboard-stat-detail">{detail}</span>
    </article>
  );
}

function formatActivityTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ActivityChart({ documents }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    return {
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: documents.filter((document) => {
        const processedDate = new Date(document.processedAt);
        return processedDate.toDateString() === date.toDateString();
      }).length,
    };
  });
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  const points = days.map((day, index) => ({
    x: 14 + index * 48,
    y: 98 - (day.count / maxCount) * 68,
    ...day,
  }));
  const linePath = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} 114 L ${points[0].x} 114 Z`;

  return (
    <section className="portal-card insights-card" aria-labelledby="activity-chart-title">
      <div className="portal-panel-heading">
        <div>
          <h2 id="activity-chart-title">Files analyzed</h2>
          <p>Processing activity · Last 7 days</p>
        </div>
        <span className="chart-total">{documents.length}</span>
      </div>
      <svg className="activity-chart" viewBox="0 0 316 126" role="img" aria-label="File analyses over the last seven days">
        <defs>
          <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3e8b80" stopOpacity=".2" />
            <stop offset="100%" stopColor="#3e8b80" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[26, 62, 98].map((y) => <line key={y} x1="10" x2="306" y1={y} y2={y} className="chart-gridline" />)}
        <path d={areaPath} fill="url(#activity-fill)" />
        <path d={linePath} className={`chart-line ${documents.length ? "" : "chart-line-empty"}`} />
        {documents.length > 0 && points.map((point) => (
          <circle key={point.date.toISOString()} cx={point.x} cy={point.y} r="3.5" className="chart-point" />
        ))}
      </svg>
      <div className="chart-day-labels">
        {points.map((point) => <span key={point.date.toISOString()}>{point.label}</span>)}
      </div>
      {!documents.length && <p className="chart-empty-note">Your file analysis activity will appear here.</p>}
    </section>
  );
}

function ActivityFeed({
  documents,
  onReview,
  onUpload,
  compact = false,
  emptyTitle = "No files analyzed yet",
  emptyMessage = "Upload a business document or image to see AI summaries, key dates, and next steps here.",
  showUpload = true,
}) {
  return (
    <section className={`portal-card activity-card ${compact ? "activity-card-compact" : ""}`}>
      <div className="portal-panel-heading">
        <div>
          <h2>Recent activity</h2>
          <p>AI work completed in this workspace</p>
        </div>
        {documents.length > 0 && <span className="activity-period">Latest {Math.min(documents.length, compact ? 5 : 3)}</span>}
      </div>
      {documents.length ? (
        <div className="activity-list">
          {documents.slice(0, compact ? 5 : 3).map((document, index) => (
            <article className="activity-item" key={document.id}>
              <span className={`activity-marker activity-marker-${index % 3}`} aria-hidden="true">✓</span>
              <div className="activity-copy">
                <strong>{document.filename}</strong>
                <p>{document.analysis.summary || "AI analysis completed."}</p>
                <time dateTime={document.processedAt}>{formatActivityTime(document.processedAt)}</time>
              </div>
              <button className="activity-open" type="button" onClick={() => onReview(document)}>Review</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="portal-empty-state">
          <span className="empty-document-icon" aria-hidden="true">▤</span>
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
          {showUpload && <button className="text-action" type="button" onClick={onUpload}>Upload your first file <span aria-hidden="true">→</span></button>}
        </div>
      )}
    </section>
  );
}

function routeForPath(pathname) {
  if (pathname === "/auth") return "auth";
  if (pathname === "/workspace") return "workspace";
  return "landing";
}

function pathForRoute(route) {
  if (route === "auth") return "/auth";
  if (route === "workspace") return "/workspace";
  return "/";
}

function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    const isSignUp = mode === "signup";

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${isSignUp ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          ...(isSignUp && fullName.trim() ? { full_name: fullName.trim() } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not sign in. Please try again.");
      onAuthenticated(payload);
    } catch (requestError) {
      setFormError(requestError instanceof TypeError
        ? "Could not connect to the backend. Start the backend and try again."
        : requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="eyebrow"><span className="eyebrow-line" /> BUSINESS WORKSPACE</div>
        <h1 id="auth-title">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-description">
          {mode === "signup" ? "Create an account to start analyzing your team's files." : "Sign in to continue to your file workspace."}
        </p>
        {formError && <div className="error-message" role="alert">{formError}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Name <span>Optional</span>
              <input autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
          </label>
          <label>
            Password
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
          </label>
          <button className="analyze-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            {!isSubmitting && <ArrowIcon />}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to Docu Gentlemen?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setFormError(""); }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}

function AdminUsersPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  async function loadUsers() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not load users.");
      setUsers(payload);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not connect to the backend." : requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  async function changeRole(user, role) {
    setUpdatingUserId(user.id);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not update this role.");
      setUsers((currentUsers) => currentUsers.map((item) => item.id === user.id ? payload : item));
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not connect to the backend." : requestError.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <section className="portal-card admin-users-card">
      <div className="portal-panel-heading">
        <div><h2>User accounts</h2><p>Manage access to the workspace</p></div>
        <button className="activity-open" type="button" onClick={() => void loadUsers()} disabled={isLoading || updatingUserId !== null}>Refresh</button>
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}
      {isLoading ? <p className="admin-users-note">Loading accounts…</p> : users.length ? (
        <div className="admin-user-list">
          {users.map((user) => (
            <article className="admin-user-row" key={user.id}>
              <div className="admin-user-copy">
                <strong>{user.full_name || user.email}</strong>
                {user.full_name && <span>{user.email}</span>}
              </div>
              <span className={`role-badge role-${user.role}`}>{user.role}</span>
              {user.id !== currentUser.id && (
                <button className="activity-open" type="button" disabled={updatingUserId === user.id} onClick={() => void changeRole(user, user.role === "admin" ? "user" : "admin")}>
                  {updatingUserId === user.id ? "Saving…" : user.role === "admin" ? "Make user" : "Make admin"}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : <p className="admin-users-note">No accounts found.</p>}
    </section>
  );
}

export default function App() {
  const fileInputRef = useRef(null);
  const [route, setRoute] = useState(() => routeForPath(window.location.pathname));
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState("Overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [documents, setDocuments] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzedFilename, setAnalyzedFilename] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasEntered = authReady && route === "workspace";

  function navigateTo(nextRoute, replace = false) {
    const path = pathForRoute(nextRoute);
    if (replace) window.history.replaceState({}, "", path);
    else if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setRoute(nextRoute);
  }

  useEffect(() => {
    let mounted = true;
    const requestedRoute = routeForPath(window.location.pathname);
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
      .then(async (response) => response.ok ? response.json() : null)
      .catch(() => null)
      .then((user) => {
        if (!mounted) return;
        setCurrentUser(user);
        const nextRoute = requestedRoute === "workspace"
          ? (user ? "workspace" : "auth")
          : requestedRoute === "auth" && user ? "workspace" : requestedRoute;
        if (nextRoute !== requestedRoute) window.history.replaceState({}, "", pathForRoute(nextRoute));
        setRoute(nextRoute);
        setAuthReady(true);
      });

    const onPopState = () => setRoute(routeForPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => {
      mounted = false;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (route === "workspace" && !currentUser) navigateTo("auth", true);
    if (route === "auth" && currentUser) navigateTo("workspace", true);
  }, [authReady, currentUser, route]);

  function handleAuthenticated(user) {
    setCurrentUser(user);
    setError("");
    navigateTo("workspace");
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // Clear the local workspace even if the backend is temporarily offline.
    }
    setCurrentUser(null);
    setActivePortalTab("Overview");
    setDocuments([]);
    setAnalysis(null);
    setAnalyzedFilename("");
    navigateTo("landing");
  }

  function chooseFile(nextFile) {
    if (!nextFile) return false;

    if (nextFile.size > 10 * 1024 * 1024) {
      setError("This file is larger than 10 MB. Please choose a smaller file.");
      setAnalysis(null);
      return false;
    }

    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("Choose a PDF, DOCX, TXT, JPG, PNG, or WEBP file.");
      setAnalysis(null);
      return false;
    }

    setError("");
    setAnalysis(null);
    return true;
  }

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0];
    if (!chooseFile(nextFile)) {
      event.target.value = "";
      return;
    }

    event.target.value = "";
    void analyzeFile(nextFile);
  }

  async function analyzeFile(fileToAnalyze) {
    if (!fileToAnalyze || isLoading) return;

    setError("");
    setAnalysis(null);
    setActivePortalTab("Overview");
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", fileToAnalyze);
    formData.append("language", "english");

    try {
      const extension = fileToAnalyze.name.split(".").pop()?.toLowerCase();
      const route = IMAGE_EXTENSIONS.includes(extension) ? "images" : "documents";
      const response = await fetch(`${API_BASE_URL}/api/${route}/analyze`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setCurrentUser(null);
          navigateTo("auth");
        }
        throw new Error(payload.detail || "The file could not be analyzed. Please try again.");
      }

      const filename = payload.filename || fileToAnalyze.name;
      const processedAt = new Date().toISOString();
      const documentRecord = {
        id: `${Date.now()}-${filename}`,
        filename,
        processedAt,
        analysis: payload.analysis,
      };

      setAnalysis(payload.analysis);
      setAnalyzedFilename(filename);
      setDocuments((currentDocuments) => [documentRecord, ...currentDocuments]);
      setActivePortalTab("Analysis");
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

  function reviewDocument(document) {
    setAnalysis(document.analysis);
    setAnalyzedFilename(document.filename);
    setActivePortalTab("Analysis");
  }

  const uploadDocument = () => fileInputRef.current?.click();
  const matchingDocuments = documents.filter((document) => {
    const query = searchTerm.trim().toLowerCase();
    return !query || document.filename.toLowerCase().includes(query);
  });
  const documentTotals = documents.reduce((totals, document) => ({
    actions: totals.actions + (document.analysis.actions?.length || 0),
    dates: totals.dates + (document.analysis.dates?.length || 0),
    warnings: totals.warnings + (document.analysis.warnings?.length || 0),
  }), { actions: 0, dates: 0, warnings: 0 });
  const portalTabs = [
    ...(analysis ? ["Overview", "Files", "Activity", "Analysis"] : ["Overview", "Files", "Activity"]),
    ...(currentUser?.role === "admin" ? ["Users"] : []),
  ];

  return (
    <div className={`app-shell ${hasEntered ? "portal-shell" : ""}`}>
      <input
        ref={fileInputRef}
        className="file-picker-input"
        id="document-file"
        type="file"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      <header className={`topbar ${hasEntered ? "portal-topbar" : ""}`}>
        <a
          className="brand"
          href={hasEntered ? "/workspace" : "/"}
          aria-label="Docu Gentlemen home"
          onClick={(event) => {
            if (hasEntered) {
              event.preventDefault();
              navigateTo("landing");
              setActivePortalTab("Overview");
            }
          }}
        >
          <span className="brand-mark">D<span>G</span></span>
          <span className="brand-name">Docu Gentlemen</span>
        </a>
        {hasEntered ? (
          <div className="workspace-user">
            <span className="workspace-avatar">{(currentUser?.full_name || currentUser?.email || "DG").slice(0, 2).toUpperCase()}</span>
            <span className="workspace-user-copy">
              <strong>{currentUser?.full_name || currentUser?.email || "Business workspace"}</strong>
              <small>{currentUser?.role === "admin" ? "Administrator" : "AI document desk"}</small>
            </span>
            <button className="workspace-logout" type="button" disabled={isLoading} onClick={() => void handleLogout()}>Log out</button>
          </div>
        ) : (
          <div className="topbar-right">
            <div className="availability"><span /> AI file analysis for teams</div>
            <a className="topbar-link" href={API_DOCS_URL} target="_blank" rel="noreferrer">
              API docs <ArrowIcon />
            </a>
          </div>
        )}
      </header>

      {hasEntered ? (
        <main id="top" className="portal-main">
          <label className="portal-search">
            <SearchIcon />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search files"
              aria-label="Search files"
            />
          </label>

          <section className="portal-dashboard" aria-labelledby="portal-title">
            <div className="portal-intro-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> BUSINESS FILE WORKSPACE</div>
                <h1 id="portal-title">File overview</h1>
                <p>AI-powered summaries for your documents and images.</p>
              </div>
              <button className="portal-upload-button" type="button" onClick={uploadDocument} disabled={isLoading}>
                <span aria-hidden="true">＋</span>
                <span className="upload-button-long">{isLoading ? "Analyzing…" : "Upload file"}</span>
                <span className="upload-button-short">{isLoading ? "Analyzing…" : "Upload"}</span>
              </button>
            </div>

            <div className="portal-tabs" role="tablist" aria-label="Workspace sections">
              {portalTabs.map((tab) => (
                <button
                  key={tab}
                  className={activePortalTab === tab ? "portal-tab active" : "portal-tab"}
                  type="button"
                  role="tab"
                  id={`workspace-tab-${tab.toLowerCase()}`}
                  aria-controls="workspace-panel"
                  aria-selected={activePortalTab === tab}
                  onClick={() => setActivePortalTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {error && <div className="error-message portal-error" role="alert">{error}</div>}

            <div
              className="portal-tabpanel"
              id="workspace-panel"
              role="tabpanel"
              aria-labelledby={`workspace-tab-${activePortalTab.toLowerCase()}`}
              tabIndex={0}
            >
            {activePortalTab === "Overview" && (
              <>
                <div className="dashboard-stats">
                  <DashboardStat icon="▤" label="Files reviewed" value={documents.length} detail="AI analyses completed" tone="stat-teal" />
                  <DashboardStat icon="↗" label="Action items" value={documentTotals.actions} detail="Found in your files" tone="stat-blue" />
                  <DashboardStat icon="◷" label="Important dates" value={documentTotals.dates} detail="Dates surfaced by AI" tone="stat-gold" />
                  <DashboardStat icon="!" label="Warnings" value={documentTotals.warnings} detail="Items to review" tone="stat-slate" />
                </div>

                <div className="dashboard-panels">
                  <ActivityFeed documents={documents} onReview={reviewDocument} onUpload={uploadDocument} />
                  <ActivityChart documents={documents} />
                </div>
              </>
            )}

            {activePortalTab === "Files" && (
              <section className="portal-card document-library">
                <div className="portal-panel-heading">
                  <div>
                    <h2>File library</h2>
                    <p>{matchingDocuments.length} {matchingDocuments.length === 1 ? "file" : "files"} in this session</p>
                  </div>
                </div>
                {matchingDocuments.length ? (
                  <div className="document-list">
                    {matchingDocuments.slice(0, 5).map((document) => (
                      <article className="document-row" key={document.id}>
                        <span className="document-row-icon"><FileIcon /></span>
                        <div className="document-row-copy">
                          <strong>{document.filename}</strong>
                          <span>{formatActivityTime(document.processedAt)}</span>
                        </div>
                        <button className="activity-open" type="button" onClick={() => reviewDocument(document)}>Review</button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="portal-empty-state">
                    <span className="empty-document-icon" aria-hidden="true">▤</span>
                    <strong>{documents.length ? "No matching files" : "Your library is ready"}</strong>
                    <p>{documents.length ? "Try another search term." : "Upload a PDF, DOCX, TXT, JPG, PNG, or WEBP file to start your library."}</p>
                    {!documents.length && <button className="text-action" type="button" onClick={uploadDocument}>Upload a file <span aria-hidden="true">→</span></button>}
                  </div>
                )}
              </section>
            )}

            {activePortalTab === "Activity" && (
              <ActivityFeed
                documents={matchingDocuments}
                onReview={reviewDocument}
                onUpload={uploadDocument}
                compact
                emptyTitle={documents.length ? "No matching activity" : undefined}
                emptyMessage={documents.length ? "Try searching for another file." : undefined}
                showUpload={!documents.length && !searchTerm}
              />
            )}
            {activePortalTab === "Users" && currentUser?.role === "admin" && (
              <AdminUsersPanel currentUser={currentUser} />
            )}
            {activePortalTab === "Analysis" && analysis && (
              <section className="analysis-results portal-analysis" aria-labelledby="results-title" aria-live="polite">
                <div className="results-topline">
                  <div>
                    <div className="eyebrow"><span className="eyebrow-line" /> AI FILE ANALYSIS</div>
                    <h2 id="results-title">Key information, at a glance.</h2>
                  </div>
                  <div className="analyzed-file"><FileIcon /><span>{analyzedFilename}</span></div>
                </div>

                <article className="summary-card">
                  <div className="summary-label"><span className="summary-sparkle">✳</span> EXECUTIVE SUMMARY</div>
                  <p>{analysis.summary || "No summary was returned for this file."}</p>
                </article>

                <div className="result-grid">
                  <ResultSection title="Action items" icon="↗" items={analysis.actions} tone="action-card" />
                  <ResultSection title="Important dates" icon="◷" items={analysis.dates} />
                  <ResultSection title="Amounts" icon="$" items={analysis.amounts} />
                  <ResultSection title="Warnings" icon="!" items={analysis.warnings} tone="warning-card" />
                  <ResultSection title="From the file" icon="“" items={analysis.evidence} tone="evidence-card" />
                </div>
              </section>
            )}
            </div>
          </section>
        </main>
      ) : route === "auth" ? (
        <AuthPanel onAuthenticated={handleAuthenticated} />
      ) : (
        <main id="top" className="main-content">
          <section className="hero-grid" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> AI DOCUMENT AND IMAGE ANALYSIS</div>
              <h1 id="hero-title">Business docs.<br />Handled with <span className="highlight-word">AI.</span></h1>
              <p className="hero-description">
                Give your team a clear read on documents and images. AI surfaces the summary, dates, amounts, actions, and key evidence.
              </p>

              <div className="feature-list">
                <div className="feature-item"><span className="feature-check">✓</span><span>Plain-language summaries for your team</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Important dates, amounts, and actions</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Key excerpts from the original file</span></div>
              </div>

              <div className="hero-footnote">
                <span className="sparkle">✳</span>
                Built for the details busy teams can’t afford to miss.
              </div>
            </div>

            <div className="analyzer-entry">
              <button className="analyze-button" type="button" disabled={!authReady} onClick={() => {
                setError("");
                navigateTo(currentUser ? "workspace" : "auth");
              }}>
                {authReady ? (currentUser ? "Open workspace" : "Enter") : "Loading…"} <ArrowIcon />
              </button>
            </div>
          </section>
        </main>
      )}

      <footer className="site-footer">
        <span>Docu Gentlemen</span>
        <span>AI document and image analysis for modern teams.</span>
        <span className="footer-language">DOCUMENTS <i>·</i> AI <i>·</i> TEAMS</span>
      </footer>
    </div>
  );
}
