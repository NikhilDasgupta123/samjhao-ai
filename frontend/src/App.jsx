import { useEffect, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_DOCS_URL = API_BASE_URL ? `${API_BASE_URL}/docs` : "http://127.0.0.1:8000/docs";

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
        <p className="empty-result">No additional details were returned.</p>
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

function StockAnalysisForm({ symbol, setSymbol, question, setQuestion, onSubmit, isLoading }) {
  return (
    <section className="portal-card stock-query-card">
      <div className="portal-panel-heading">
        <div>
          <h2>Research an NSE stock</h2>
          <p>Get the latest available quote, recent price history, and an AI brief.</p>
        </div>
        <span className="stock-query-badge"><i /> NSE · India</span>
      </div>
      <form className="stock-query-form" onSubmit={onSubmit}>
        <label>
          NSE symbol
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="RELIANCE"
            pattern="[A-Za-z0-9][A-Za-z0-9.&-]{0,29}([.]NS)?"
            maxLength={33}
            required
          />
        </label>
        <label className="stock-question-field">
          What would you like to know?
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="Summarize the latest quote and recent trend"
          />
        </label>
        <button className="analyze-button stock-query-submit" type="submit" disabled={isLoading}>
          {isLoading ? "Researching…" : "Analyze stock"} {!isLoading && <ArrowIcon />}
        </button>
      </form>
      <p className="stock-query-note">Data fetched from NSE through jugaad-data. Informational research, not investment advice.</p>
    </section>
  );
}

function QuoteMetrics({ quote }) {
  const formatPrice = (value) => value == null ? "—" : `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
  const changeValue = quote?.percent_change;
  const changeTone = changeValue > 0 ? "positive" : changeValue < 0 ? "negative" : "neutral";
  const metrics = [
    { label: "Last price", value: formatPrice(quote?.last_price), tone: "" },
    { label: "Day change", value: quote?.change == null ? "—" : `${formatPrice(quote.change)}${changeValue == null ? "" : ` (${changeValue.toFixed(2)}%)`}`, tone: changeTone },
    { label: "Day range", value: quote?.day_low == null || quote?.day_high == null ? "—" : `${formatPrice(quote.day_low)} – ${formatPrice(quote.day_high)}`, tone: "" },
    { label: "Previous close", value: formatPrice(quote?.previous_close), tone: "" },
  ];
  return (
    <div className="quote-grid" aria-label="Latest available quote">
      {metrics.map((metric) => (
        <article className={`quote-metric ${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </div>
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

function ActivityChart({ stocks }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    return {
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: stocks.filter((stock) => {
        const processedDate = new Date(stock.processedAt);
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
          <p>Stock briefs created · Last 7 days</p>
        </div>
        <span className="chart-total">{stocks.length}</span>
      </div>
      <svg className="activity-chart" viewBox="0 0 316 126" role="img" aria-label="Stock analyses over the last seven days">
        <defs>
          <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3e8b80" stopOpacity=".2" />
            <stop offset="100%" stopColor="#3e8b80" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[26, 62, 98].map((y) => <line key={y} x1="10" x2="306" y1={y} y2={y} className="chart-gridline" />)}
        <path d={areaPath} fill="url(#activity-fill)" />
        <path d={linePath} className={`chart-line ${stocks.length ? "" : "chart-line-empty"}`} />
        {stocks.length > 0 && points.map((point) => (
          <circle key={point.date.toISOString()} cx={point.x} cy={point.y} r="3.5" className="chart-point" />
        ))}
      </svg>
      <div className="chart-day-labels">
        {points.map((point) => <span key={point.date.toISOString()}>{point.label}</span>)}
      </div>
      {!stocks.length && <p className="chart-empty-note">Your research activity will appear here.</p>}
    </section>
  );
}

function ActivityFeed({
  stocks,
  onReview,
  onAnalyze,
  compact = false,
  emptyTitle = "No stocks researched yet",
  emptyMessage = "Analyze an NSE symbol to see its brief and latest available quote here.",
  showAnalyze = true,
}) {
  return (
    <section className={`portal-card activity-card ${compact ? "activity-card-compact" : ""}`}>
      <div className="portal-panel-heading">
        <div>
          <h2>Recent activity</h2>
          <p>Indian stocks researched with NSE data</p>
        </div>
        {stocks.length > 0 && <span className="activity-period">Latest {Math.min(stocks.length, compact ? 5 : 3)}</span>}
      </div>
      {stocks.length ? (
        <div className="activity-list">
          {stocks.slice(0, compact ? 5 : 3).map((stock, index) => (
            <article className="activity-item" key={stock.id}>
              <span className={`activity-marker activity-marker-${index % 3}`} aria-hidden="true">✓</span>
              <div className="activity-copy">
                <strong>{stock.symbol}</strong>
                <p>{stock.result.brief.summary || "Stock research brief completed."}</p>
                <time dateTime={stock.processedAt}>{formatActivityTime(stock.processedAt)}</time>
              </div>
              <button className="activity-open" type="button" onClick={() => onReview(stock)}>Review</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="portal-empty-state">
          <span className="empty-stock-icon" aria-hidden="true">↗</span>
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
          {showAnalyze && <button className="text-action" type="button" onClick={onAnalyze}>Research your first stock <span aria-hidden="true">→</span></button>}
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
        <span><i /> NSE STOCKS</span>
        <span>AI RESEARCH</span>
      </div>
      <div className="market-preview-title">
        <div>
          <span className="market-preview-kicker">YOUR NEXT STOCK BRIEF</span>
          <strong>Indian company research</strong>
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
        <div className="market-chart-axis"><span>NSE DATA</span><span>PRICE TREND</span><span>BRIEF</span></div>
      </div>
      <div className="market-preview-footer">
        <span><i className="preview-dot preview-dot-green" /> Live quote</span>
        <span><i className="preview-dot preview-dot-lime" /> Historical trend</span>
      </div>
      <button className="analyze-button market-preview-button" type="button" disabled={!authReady} onClick={onEnter}>
        {authReady ? (currentUser ? "Open research desk" : "Get started") : "Loading…"} <ArrowIcon />
      </button>
      <p className="market-preview-note">Illustrative preview · NSE data via jugaad-data MCP</p>
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
          {mode === "signup" ? "Create an account to research Indian stocks with AI." : "Sign in to continue to your stock research desk."}
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
  const [route, setRoute] = useState(() => routeForPath(window.location.pathname));
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState("Overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [stocks, setStocks] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [symbol, setSymbol] = useState("");
  const [question, setQuestion] = useState("Give me a concise overview of the latest quote and recent price trend.");
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
    setStocks([]);
    setAnalysis(null);
    navigateTo("landing");
  }

  async function analyzeStock(event) {
    event.preventDefault();
    if (isLoading) return;
    const requestedSymbol = symbol.trim().toUpperCase();
    if (!requestedSymbol) return;
    setError("");
    setAnalysis(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/stocks/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: requestedSymbol,
          question: question.trim() || "Give me a concise overview of the latest quote and recent price trend.",
          history_days: 30,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setCurrentUser(null);
          navigateTo("auth");
        }
        const detail = Array.isArray(payload.detail)
          ? payload.detail.map((item) => item.msg).join(" ")
          : payload.detail;
        throw new Error(detail || "The stock could not be analyzed. Please try again.");
      }

      const processedAt = new Date().toISOString();
      const stockRecord = {
        id: `${Date.now()}-${payload.symbol}`,
        symbol: payload.symbol,
        processedAt,
        result: payload,
      };

      setSymbol(payload.symbol);
      setAnalysis(payload);
      setStocks((currentStocks) => [stockRecord, ...currentStocks]);
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

  function reviewStock(stock) {
    setAnalysis(stock.result);
    setSymbol(stock.symbol);
    setActivePortalTab("Analysis");
  }

  const matchingStocks = stocks.filter((stock) => {
    const query = searchTerm.trim().toLowerCase();
    return !query || stock.symbol.toLowerCase().includes(query);
  });
  const stockTotals = stocks.reduce((totals, stock) => ({
    observations: totals.observations + (stock.result.brief.key_observations?.length || 0),
    dataPoints: totals.dataPoints + (stock.result.history?.length || 0),
    risks: totals.risks + (stock.result.brief.risks?.length || 0),
  }), { observations: 0, dataPoints: 0, risks: 0 });
  const portalTabs = [
    "Overview",
    "Stocks",
    "Activity",
    ...(analysis ? ["Analysis"] : []),
    ...(currentUser?.role === "admin" ? ["Users"] : []),
  ];

  return (
    <div className={`app-shell ${hasEntered ? "portal-shell" : ""}`}>
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
              placeholder="Search researched symbols"
              aria-label="Search researched stock symbols"
              />
            </label>
          )}

          <section className="portal-dashboard" aria-labelledby="portal-title">
            <div className="portal-intro-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> {activePortalTab === "Users" ? "ADMINISTRATION" : "MARKETBRIEF RESEARCH DESK"}</div>
                <h1 id="portal-title">{activePortalTab === "Users" ? "User management" : activePortalTab === "Stocks" ? "Stock research" : "Research overview"}</h1>
                <p>{activePortalTab === "Users" ? "Manage accounts and workspace access." : "Indian stock quotes, price history, and AI research briefs."}</p>
              </div>
              {!(activePortalTab === "Users" && currentUser?.role === "admin") && (
                <button className="portal-stock-button" type="button" onClick={() => setActivePortalTab("Stocks")} disabled={isLoading}>
                  <span aria-hidden="true">＋</span>
                  <span>{isLoading ? "Researching…" : "Analyze stock"}</span>
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
                  <DashboardStat icon="↗" label="Stocks researched" value={stocks.length} detail="Briefs in this session" tone="stat-teal" />
                  <DashboardStat icon="✳" label="Observations" value={stockTotals.observations} detail="Signals from the data" tone="stat-blue" />
                  <DashboardStat icon="▥" label="Price points" value={stockTotals.dataPoints} detail="Recent NSE sessions" tone="stat-gold" />
                  <DashboardStat icon="!" label="Risk notes" value={stockTotals.risks} detail="Items to review" tone="stat-slate" />
                </div>

                <div className="dashboard-panels">
                  <ActivityFeed stocks={stocks} onReview={reviewStock} onAnalyze={() => setActivePortalTab("Stocks")} />
                  <ActivityChart stocks={stocks} />
                </div>
              </>
            )}

            {activePortalTab === "Stocks" && (
              <div className="stock-research-view">
                <StockAnalysisForm
                  symbol={symbol}
                  setSymbol={setSymbol}
                  question={question}
                  setQuestion={setQuestion}
                  onSubmit={analyzeStock}
                  isLoading={isLoading}
                />
                {matchingStocks.length > 0 && (
                  <section className="portal-card stock-library">
                    <div className="portal-panel-heading">
                      <div>
                        <h2>Recently researched</h2>
                        <p>{matchingStocks.length} {matchingStocks.length === 1 ? "stock" : "stocks"} in this session</p>
                      </div>
                    </div>
                    <div className="stock-list">
                      {matchingStocks.slice(0, 8).map((stock) => (
                        <article className="stock-row" key={stock.id}>
                          <span className="stock-symbol-mark">{stock.symbol.slice(0, 2)}</span>
                          <div className="stock-row-copy">
                            <strong>{stock.symbol}</strong>
                            <span>{formatActivityTime(stock.processedAt)} · ₹{stock.result.quote.last_price?.toLocaleString("en-IN") || "—"}</span>
                          </div>
                          <button className="activity-open" type="button" onClick={() => reviewStock(stock)}>Open brief</button>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activePortalTab === "Activity" && (
              <ActivityFeed
                stocks={matchingStocks}
                onReview={reviewStock}
                onAnalyze={() => setActivePortalTab("Stocks")}
                compact
                emptyTitle={stocks.length ? "No matching activity" : undefined}
                emptyMessage={stocks.length ? "Try another NSE symbol." : undefined}
                showAnalyze={!stocks.length && !searchTerm}
              />
            )}
            {activePortalTab === "Users" && currentUser?.role === "admin" && (
              <AdminUsersPanel currentUser={currentUser} />
            )}
            {activePortalTab === "Analysis" && analysis && (
              <section className="analysis-results portal-analysis" aria-labelledby="results-title" aria-live="polite">
                <div className="results-topline">
                  <div>
                    <div className="eyebrow"><span className="eyebrow-line" /> STOCK AGENT · NSE MCP DATA</div>
                    <h2 id="results-title">{analysis.quote.company_name || analysis.symbol} <span>({analysis.symbol})</span></h2>
                  </div>
                  <div className="analyzed-file stock-data-source">
                    <span className="stock-source-dot" />
                    <span>{analysis.quote.source}{analysis.quote.data_as_of ? ` · ${analysis.quote.data_as_of}` : ""}</span>
                  </div>
                </div>

                <QuoteMetrics quote={analysis.quote} />

                <article className="summary-card">
                  <div className="summary-label"><span className="summary-sparkle">✳</span> STOCK BRIEF</div>
                  <p>{analysis.brief.summary}</p>
                </article>

                <div className="result-grid stock-result-grid">
                  <ResultSection title="Key observations" icon="↗" items={analysis.brief.key_observations} tone="action-card" />
                  <ResultSection title="Recent price history" icon="▥" items={analysis.history.slice(-7).map((point) => `${point.date}: close ₹${point.close?.toLocaleString("en-IN") || "—"}${point.volume == null ? "" : ` · volume ${point.volume.toLocaleString("en-IN")}`}`)} />
                  <ResultSection title="Risks & limitations" icon="!" items={analysis.brief.risks} tone="warning-card" />
                </div>
                <p className="analysis-disclaimer">{analysis.disclaimer} NSE quote availability can vary by market hours and source response.</p>
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
                Explore Indian NSE stocks with the latest available quote, recent price history, and a plain-language brief powered by Cloudflare AI.
              </p>

              <div className="feature-list">
                <div className="feature-item"><span className="feature-check">✓</span><span>Fetch live NSE quote data with MCP tools</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Review recent OHLCV price history</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Get a clear, data-grounded stock brief</span></div>
              </div>

              <div className="hero-footnote">
                <span className="sparkle">✳</span>
                NSE data through jugaad-data. Informational research, not investment advice.
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
        <span>Indian stock research briefs powered by NSE data and AI.</span>
        <span className="footer-language">RESEARCH <i>·</i> SIGNALS <i>·</i> AI</span>
      </footer>
    </div>
  );
}
