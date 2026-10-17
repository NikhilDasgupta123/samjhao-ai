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
        <p className="empty-result">Nothing specific found in this report.</p>
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

function formatLocalDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
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
          <h2 id="activity-chart-title">Research activity</h2>
          <p>Reports reviewed · Last 7 days</p>
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
      {!documents.length && <p className="chart-empty-note">Your research activity will appear here.</p>}
    </section>
  );
}

function ActivityFeed({
  documents,
  onReview,
  onUpload,
  compact = false,
  emptyTitle = "No reports analyzed yet",
  emptyMessage = "Upload an earnings report, company filing, or chart screenshot to see its key signals here.",
  showUpload = true,
}) {
  return (
    <section className={`portal-card activity-card ${compact ? "activity-card-compact" : ""}`}>
      <div className="portal-panel-heading">
        <div>
          <h2>Recent activity</h2>
          <p>Reports and market visuals reviewed by AI</p>
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
          <span className="empty-document-icon" aria-hidden="true">↗</span>
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
          {showUpload && <button className="text-action" type="button" onClick={onUpload}>Upload your first report <span aria-hidden="true">→</span></button>}
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

function MarketPreview({ authReady, currentUser, onEnter }) {
  return (
    <section className="market-preview" aria-label="Stock research workspace preview">
      <div className="market-preview-topline">
        <span><i /> RESEARCH DESK</span>
        <span>AI INSIGHTS</span>
      </div>
      <div className="market-preview-title">
        <div>
          <span className="market-preview-kicker">YOUR NEXT REPORT</span>
          <strong>Company research</strong>
        </div>
        <span className="market-preview-spark" aria-hidden="true">↗</span>
      </div>
      <div className="market-preview-chart" aria-hidden="true">
        <div className="market-chart-grid"><i /><i /><i /></div>
        <svg viewBox="0 0 420 150" preserveAspectRatio="none">
          <defs>
            <linearGradient id="market-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#65e6a3" stopOpacity=".25" />
              <stop offset="100%" stopColor="#65e6a3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="market-chart-area" d="M0 118 L42 103 L78 109 L117 76 L153 88 L194 52 L229 66 L267 38 L302 56 L343 23 L378 35 L420 12 L420 150 L0 150 Z" />
          <path className="market-chart-line" d="M0 118 L42 103 L78 109 L117 76 L153 88 L194 52 L229 66 L267 38 L302 56 L343 23 L378 35 L420 12" />
          {[42, 117, 194, 267, 343, 420].map((x, index) => {
            const y = [103, 76, 52, 38, 23, 12][index];
            return <circle key={x} cx={x} cy={y} r="3.5" className="market-chart-point" />;
          })}
        </svg>
        <div className="market-chart-axis"><span>REPORT</span><span>INSIGHTS</span><span>EVIDENCE</span></div>
      </div>
      <div className="market-preview-footer">
        <span><i className="preview-dot preview-dot-green" /> Earnings & filings</span>
        <span><i className="preview-dot preview-dot-lime" /> Risks & catalysts</span>
      </div>
      <button className="analyze-button market-preview-button" type="button" disabled={!authReady} onClick={onEnter}>
        {authReady ? (currentUser ? "Open research desk" : "Get started") : "Loading…"} <ArrowIcon />
      </button>
      <p className="market-preview-note">Illustrative preview · Upload-based insights · No live prices</p>
    </section>
  );
}

function pathForRoute(route) {
  if (route === "auth") return "/auth";
  if (route === "workspace") return "/workspace";
  return "/";
}

function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
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
          password,
          ...(isSignUp ? {
            email: identifier.trim(),
            username: username.trim(),
            ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
          } : { identifier: identifier.trim() }),
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
        <div className="eyebrow"><span className="eyebrow-line" /> STOCK RESEARCH WORKSPACE</div>
        <h1 id="auth-title">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-description">
          {mode === "signup" ? "Create an account to start reviewing company reports with AI." : "Sign in to continue to your stock research desk."}
        </p>
        {formError && <div className="error-message" role="alert">{formError}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Username
              <input autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. nikhil_dev" />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Name <span>Optional</span>
              <input autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            {mode === "signup" ? "Email" : "Email or username"}
            <input
              type={mode === "signup" ? "email" : "text"}
              autoComplete={mode === "signup" ? "email" : "username"}
              maxLength={320}
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={mode === "signup" ? "you@company.com" : "you@company.com or username"}
            />
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
          {mode === "signup" ? "Already have an account?" : "New to MarketBrief AI?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setIdentifier(""); setFormError(""); }}>
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
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [newUser, setNewUser] = useState({ full_name: "", username: "", email: "", password: "" });

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

  function suggestPassword() {
    if (!globalThis.crypto?.getRandomValues) {
      setError("Secure password suggestions require HTTPS or localhost.");
      return;
    }

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
    const maxAcceptedByte = Math.floor(256 / alphabet.length) * alphabet.length;
    const password = [];
    while (password.length < 18) {
      const randomBytes = new Uint8Array(24);
      globalThis.crypto.getRandomValues(randomBytes);
      for (const byte of randomBytes) {
        if (byte < maxAcceptedByte) password.push(alphabet[byte % alphabet.length]);
        if (password.length === 18) break;
      }
    }

    setNewUser((currentUser) => ({ ...currentUser, password: password.join("") }));
    setShowInitialPassword(true);
    setError("");
  }

  async function addUser(event) {
    event.preventDefault();
    setIsCreatingUser(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: newUser.email.trim(),
          username: newUser.username.trim(),
          password: newUser.password,
          ...(newUser.full_name.trim() ? { full_name: newUser.full_name.trim() } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(payload.detail)
          ? payload.detail.map((item) => item.msg).join(" ")
          : payload.detail;
        throw new Error(detail || "Could not create this user.");
      }
      setUsers((currentUsers) => [payload, ...currentUsers]);
      setNewUser({ full_name: "", username: "", email: "", password: "" });
      setShowInitialPassword(false);
      setIsAddUserOpen(false);
      setNotice(`@${payload.username} was added. Share the initial password securely.`);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not connect to the backend." : requestError.message);
    } finally {
      setIsCreatingUser(false);
    }
  }

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
        <div className="admin-users-actions">
          <button className="admin-add-user-button" type="button" onClick={() => {
            if (isAddUserOpen) {
              setNewUser({ full_name: "", username: "", email: "", password: "" });
              setShowInitialPassword(false);
            }
            setIsAddUserOpen((open) => !open);
            setError("");
            setNotice("");
          }} disabled={isLoading || isCreatingUser}>
            {isAddUserOpen ? "Cancel" : "＋ Add user"}
          </button>
          <button className="activity-open" type="button" onClick={() => void loadUsers()} disabled={isLoading || isCreatingUser || updatingUserId !== null}>Refresh</button>
        </div>
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}
      {notice && <p className="admin-users-success" role="status">{notice}</p>}
      {isAddUserOpen && (
        <form className="admin-add-user-form" onSubmit={addUser}>
          <div className="admin-add-user-fields">
            <label>
              Name <span>Optional</span>
              <input autoComplete="name" maxLength={120} value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} placeholder="Full name" />
            </label>
            <label>
              Username
              <input autoComplete="off" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" required value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} placeholder="e.g. nikhil_dev" />
            </label>
            <label>
              Email
              <input type="email" autoComplete="off" required value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="user@company.com" />
            </label>
            <label>
              Initial password
              <div className="admin-password-field">
                <input type={showInitialPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="At least 8 characters" />
                <button className="admin-suggest-password" type="button" onClick={suggestPassword}>Suggest password</button>
              </div>
            </label>
          </div>
          <div className="admin-add-user-form-footer">
            <span>The new account gets the User role. You can promote it from the table.</span>
            <button className="admin-add-user-submit" type="submit" disabled={isCreatingUser}>
              {isCreatingUser ? "Adding user…" : "Create user"}
            </button>
          </div>
        </form>
      )}
      {isLoading ? <p className="admin-users-note">Loading accounts…</p> : users.length ? (
        <div className="table-responsive admin-users-table-wrap">
          <table className="table table-striped table-hover align-middle admin-users-table">
            <caption className="visually-hidden">Users with their account roles and join dates</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Joined · local time</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="admin-table-name">{user.full_name || "—"}</td>
                  <td>{user.email}</td>
                  <td><span className="admin-table-username">@{user.username}</span></td>
                  <td><span className={`role-badge role-${user.role}`}>{user.role}</span></td>
                  <td><time dateTime={user.created_at}>{formatLocalDateTime(user.created_at)}</time></td>
                  <td>
                    {user.id !== currentUser.id ? (
                      <button className="activity-open" type="button" disabled={updatingUserId === user.id} onClick={() => void changeRole(user, user.role === "admin" ? "user" : "admin")}>
                        {updatingUserId === user.id ? "Saving…" : user.role === "admin" ? "Make user" : "Make admin"}
                      </button>
                    ) : <span className="admin-self-label">You</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          aria-label="MarketBrief AI home"
          onClick={(event) => {
            if (hasEntered) {
              event.preventDefault();
              navigateTo("landing");
              setActivePortalTab("Overview");
            }
          }}
        >
          <span className="brand-mark">M<span>B</span></span>
          <span className="brand-name">MarketBrief <i>AI</i></span>
        </a>
        {hasEntered ? (
          <div className="workspace-user">
            <span className="workspace-avatar">{(currentUser?.full_name || currentUser?.email || "MB").slice(0, 2).toUpperCase()}</span>
            <span className="workspace-user-copy">
              <strong>{currentUser?.full_name || currentUser?.email || "MarketBrief workspace"}</strong>
              <small>{currentUser?.role === "admin" ? "Administrator" : "Stock research desk"}</small>
            </span>
            <button className="workspace-logout" type="button" disabled={isLoading} onClick={() => void handleLogout()}>Log out</button>
          </div>
        ) : (
          <div className="topbar-right">
            <div className="availability"><span /> AI stock research assistant</div>
            <a className="topbar-link" href={API_DOCS_URL} target="_blank" rel="noreferrer">
              API docs <ArrowIcon />
            </a>
          </div>
        )}
      </header>

      {hasEntered ? (
        <main id="top" className="portal-main">
          {!(activePortalTab === "Users" && currentUser?.role === "admin") && (
            <label className="portal-search">
              <SearchIcon />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search reports"
                aria-label="Search reports"
              />
            </label>
          )}

          <section className="portal-dashboard" aria-labelledby="portal-title">
            <div className="portal-intro-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> {activePortalTab === "Users" ? "ADMINISTRATION" : "MARKETBRIEF RESEARCH DESK"}</div>
                <h1 id="portal-title">{activePortalTab === "Users" ? "User management" : "Research overview"}</h1>
                <p>{activePortalTab === "Users" ? "Manage accounts and workspace access." : "Company reports, earnings, and chart insights in one place."}</p>
              </div>
              {!(activePortalTab === "Users" && currentUser?.role === "admin") && (
                <button className="portal-upload-button" type="button" onClick={uploadDocument} disabled={isLoading}>
                  <span aria-hidden="true">＋</span>
                  <span className="upload-button-long">{isLoading ? "Analyzing…" : "Upload file"}</span>
                  <span className="upload-button-short">{isLoading ? "Analyzing…" : "Upload"}</span>
                </button>
              )}
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
                  <DashboardStat icon="▤" label="Reports analyzed" value={documents.length} detail="Research files reviewed" tone="stat-teal" />
                  <DashboardStat icon="↗" label="Catalysts" value={documentTotals.actions} detail="Signals in your reports" tone="stat-blue" />
                  <DashboardStat icon="◷" label="Key dates" value={documentTotals.dates} detail="Events surfaced by AI" tone="stat-gold" />
                  <DashboardStat icon="!" label="Risks flagged" value={documentTotals.warnings} detail="Worth a closer look" tone="stat-slate" />
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
                    <h2>Research library</h2>
                    <p>{matchingDocuments.length} {matchingDocuments.length === 1 ? "report" : "reports"} in this session</p>
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
                    <strong>{documents.length ? "No matching reports" : "Your research desk is ready"}</strong>
                    <p>{documents.length ? "Try another search term." : "Upload an earnings report, company filing, or chart screenshot (PDF, DOCX, TXT, JPG, PNG, or WEBP)."}</p>
                    {!documents.length && <button className="text-action" type="button" onClick={uploadDocument}>Upload research <span aria-hidden="true">→</span></button>}
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
                    <div className="eyebrow"><span className="eyebrow-line" /> STOCK REPORT ANALYSIS</div>
                    <h2 id="results-title">The signals behind the story.</h2>
                  </div>
                  <div className="analyzed-file"><FileIcon /><span>{analyzedFilename}</span></div>
                </div>

                <article className="summary-card">
                  <div className="summary-label"><span className="summary-sparkle">✳</span> COMPANY BRIEF</div>
                  <p>{analysis.summary || "No summary was returned for this file."}</p>
                </article>

                <div className="result-grid">
                  <ResultSection title="Catalysts & events" icon="↗" items={analysis.actions} tone="action-card" />
                  <ResultSection title="Key dates" icon="◷" items={analysis.dates} />
                  <ResultSection title="Reported figures" icon="$" items={analysis.amounts} />
                  <ResultSection title="Risks to review" icon="!" items={analysis.warnings} tone="warning-card" />
                  <ResultSection title="Source evidence" icon="“" items={analysis.evidence} tone="evidence-card" />
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
              <div className="eyebrow"><span className="eyebrow-line" /> AI STOCK RESEARCH ASSISTANT</div>
              <h1 id="hero-title">Read the market.<br />Start with <span className="highlight-word">clarity.</span></h1>
              <p className="hero-description">
                Turn earnings reports, company filings, and chart screenshots into a clear brief with catalysts, key dates, reported figures, risks, and source evidence.
              </p>

              <div className="feature-list">
                <div className="feature-item"><span className="feature-check">✓</span><span>Understand filings and earnings faster</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Surface catalysts, figures, dates, and risks</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Keep every insight tied to source evidence</span></div>
              </div>

              <div className="hero-footnote">
                <span className="sparkle">✳</span>
                Research support based on your uploads. No live market data.
              </div>
            </div>

            <div className="analyzer-entry">
              <MarketPreview authReady={authReady} currentUser={currentUser} onEnter={() => {
                setError("");
                navigateTo(currentUser ? "workspace" : "auth");
              }} />
            </div>
          </section>
        </main>
      )}

      <footer className="site-footer">
        <span>MarketBrief AI</span>
        <span>Stock research briefs from your company reports and charts.</span>
        <span className="footer-language">RESEARCH <i>·</i> SIGNALS <i>·</i> AI</span>
      </footer>
    </div>
  );
}
