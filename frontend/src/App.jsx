import { useCallback, useEffect, useState } from "react";
import { ArrowIcon, SearchIcon } from "./components/icons.jsx";
import { API_DOCS_URL } from "./lib/config.js";
import { formatActivityTime, formatIndiaDate, formatRupees } from "./lib/formatters.js";
import { pathForRoute, routeForPath } from "./lib/routes.js";
import { getCurrentUser, logOut } from "./features/auth/api/authService.js";
import { ActivityChart } from "./features/activity/components/ActivityChart.jsx";
import { ActivityFeed } from "./features/activity/components/ActivityFeed.jsx";
import { AdminUsersPanel } from "./features/admin/components/AdminUsersPanel.jsx";
import { AuthPanel } from "./features/auth/components/AuthPanel.jsx";
import { getStockMarketData } from "./features/market/api/marketService.js";
import { DashboardStat } from "./features/dashboard/components/DashboardStat.jsx";
import { MarketPreview } from "./features/landing/components/MarketPreview.jsx";
import { MarketWatchTable } from "./features/market/components/MarketWatchTable.jsx";
import { DailyMarketNewsWidget } from "./features/market/components/DailyMarketNewsWidget.jsx";
import { StockMarketDataForm } from "./features/market/components/StockMarketDataForm.jsx";
import { StockMarketDetails } from "./features/market/components/StockMarketDetails.jsx";

const THEME_STORAGE_KEY = "marketbrief-theme";

function getInitialTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function ThemeToggle({ theme, onToggle }) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${nextTheme} mode`}
      onClick={onToggle}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
        {theme === "dark" ? (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" />
          </>
        ) : (
          <path d="M16.6 12.9A7 7 0 0 1 7.1 3.4a7 7 0 1 0 9.5 9.5Z" />
        )}
      </svg>
      <span>{nextTheme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => routeForPath(window.location.pathname));
  const [theme, setTheme] = useState(getInitialTheme);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState("Overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [stocks, setStocks] = useState([]);
  const [stockDetails, setStockDetails] = useState(null);
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasEntered = authReady && route === "workspace";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme remains active for this session if storage is unavailable.
    }
  }, [theme]);

  const handleMarketWatchUnauthorized = useCallback(() => {
    setCurrentUser(null);
    window.history.replaceState({}, "", pathForRoute("auth"));
    setRoute("auth");
  }, []);

  function navigateTo(nextRoute, replace = false) {
    const path = pathForRoute(nextRoute);
    if (replace) window.history.replaceState({}, "", path);
    else if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setRoute(nextRoute);
  }

  useEffect(() => {
    let mounted = true;
    const requestedRoute = routeForPath(window.location.pathname);
    getCurrentUser()
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
      await logOut();
    } catch {
      // Clear the local workspace even if the backend is temporarily offline.
    }
    setCurrentUser(null);
    setActivePortalTab("Overview");
    setStocks([]);
    setStockDetails(null);
    navigateTo("landing");
  }

  async function loadStockDetails(event, selectedSymbol) {
    event?.preventDefault();
    if (isLoading) return;
    const requestedSymbol = (selectedSymbol || symbol).trim().toUpperCase();
    if (!requestedSymbol) return;
    setError("");
    setStockDetails(null);
    setIsLoading(true);

    try {
      const payload = await getStockMarketData({ symbol: requestedSymbol, historyDays: 30 });
      const processedAt = payload.retrieved_at;
      const stockRecord = {
        id: `${Date.now()}-${payload.symbol}`,
        symbol: payload.symbol,
        processedAt,
        result: payload,
      };

      setSymbol(payload.symbol);
      setStockDetails(payload);
      setStocks((currentStocks) => [stockRecord, ...currentStocks]);
      setActivePortalTab("Details");
    } catch (requestError) {
      if (requestError.status === 401) {
        setCurrentUser(null);
        navigateTo("auth");
      }
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
    setStockDetails(stock.result);
    setSymbol(stock.symbol);
    setActivePortalTab("Details");
  }

  const matchingStocks = stocks.filter((stock) => {
    const query = searchTerm.trim().toLowerCase();
    return !query || stock.symbol.toLowerCase().includes(query);
  });
  const stockTotals = stocks.reduce((totals, stock) => ({
    dataPoints: totals.dataPoints + (stock.result.history?.length || 0),
  }), { dataPoints: 0 });
  const portalTabs = [
    "Overview",
    "Stocks",
    "Activity",
    ...(stockDetails ? ["Details"] : []),
    ...(currentUser?.role === "admin" ? ["Users"] : []),
  ];

  return (
    <div className={`app-shell ${hasEntered ? "portal-shell" : ""} ${hasEntered && activePortalTab === "Stocks" ? "portal-shell-market-watch" : ""}`} data-theme={theme}>
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
              <small>{currentUser?.role === "admin" ? "Administrator" : "India market desk"}</small>
            </span>
            <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
            <button className="workspace-logout" type="button" disabled={isLoading} onClick={() => void handleLogout()}>Log out</button>
          </div>
        ) : (
          <div className="topbar-right">
            <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
            <div className="availability"><span /> India stock market dashboard</div>
            <a className="topbar-link" href={API_DOCS_URL} target="_blank" rel="noreferrer">
              API docs <ArrowIcon />
            </a>
          </div>
        )}
      </header>

      {hasEntered ? (
        <main id="top" className="portal-main">
          {activePortalTab !== "Stocks" && !(activePortalTab === "Users" && currentUser?.role === "admin") && (
            <label className="portal-search">
              <SearchIcon />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search viewed stock symbols"
              aria-label="Search viewed stock symbols"
              />
            </label>
          )}

          <section className="portal-dashboard" aria-labelledby="portal-title">
            <div className="portal-intro-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> {activePortalTab === "Users" ? "ADMINISTRATION" : "MARKETBRIEF INDIA MARKETS"}</div>
                <h1 id="portal-title">{activePortalTab === "Users" ? "User management" : activePortalTab === "Stocks" ? "Latest stock details" : activePortalTab === "Activity" ? "Recently viewed stocks" : activePortalTab === "Details" ? "Stock market details" : "India market dashboard"}</h1>
                <p>{activePortalTab === "Users" ? "Manage accounts and workspace access." : "Latest available NSE quotes, stock details, and daily price trends."}</p>
              </div>
              {!(activePortalTab === "Users" && currentUser?.role === "admin") && (
                <button className="portal-stock-button" type="button" onClick={() => setActivePortalTab("Stocks")} disabled={isLoading}>
                  <span aria-hidden="true">＋</span>
                  <span>{isLoading ? "Loading data…" : "View stock details"}</span>
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
                  <DashboardStat icon="↗" label="Stocks viewed" value={stocks.length} detail="Lookups in this session" tone="stat-teal" />
                  <DashboardStat icon="₹" label="Latest price" value={stocks[0] ? formatRupees(stocks[0].result.quote.last_price) : "—"} detail={stocks[0]?.symbol || "No stock loaded yet"} tone="stat-blue" />
                  <DashboardStat icon="▥" label="Price points" value={stockTotals.dataPoints} detail="Recent NSE sessions" tone="stat-gold" />
                  <DashboardStat icon="◷" label="Latest update" value={stocks[0] ? formatIndiaDate(stocks[0].result.retrieved_at) : "—"} detail="Date shown in India time" tone="stat-slate" />
                </div>

                <div className="dashboard-panels">
                  <ActivityFeed stocks={stocks} onReview={reviewStock} onViewStocks={() => setActivePortalTab("Stocks")} />
                  <ActivityChart stocks={stocks} />
                </div>
              </>
            )}

            {activePortalTab === "Stocks" && (
              <div className="stock-market-view">
                <StockMarketDataForm
                  symbol={symbol}
                  setSymbol={setSymbol}
                  onSubmit={loadStockDetails}
                  isLoading={isLoading}
                />
                <MarketWatchTable
                  onUseSymbol={(selectedSymbol) => loadStockDetails(null, selectedSymbol)}
                  onUnauthorized={handleMarketWatchUnauthorized}
                />
                {matchingStocks.length > 0 && (
                  <section className="portal-card stock-library">
                    <div className="portal-panel-heading">
                      <div>
                        <h2>Recently viewed</h2>
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
                          <button className="activity-open" type="button" onClick={() => reviewStock(stock)}>View details</button>
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
                onViewStocks={() => setActivePortalTab("Stocks")}
                compact
                emptyTitle={stocks.length ? "No matching activity" : undefined}
                emptyMessage={stocks.length ? "Try another NSE symbol." : undefined}
                showViewStocks={!stocks.length && !searchTerm}
              />
            )}
            {activePortalTab === "Users" && currentUser?.role === "admin" && (
              <AdminUsersPanel currentUser={currentUser} />
            )}
            {activePortalTab === "Details" && stockDetails && (
              <StockMarketDetails data={stockDetails} onUnauthorized={handleMarketWatchUnauthorized} />
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
              <div className="eyebrow"><span className="eyebrow-line" /> INDIA STOCK MARKET DASHBOARD</div>
              <h1 id="hero-title">See the market.<br />Start with <span className="highlight-word">clarity.</span></h1>
              <p className="hero-description">
                Explore Indian NSE stocks with the latest available quote, a clear details table, and a recent closing-price graph.
              </p>

              <div className="feature-list">
                <div className="feature-item"><span className="feature-check">✓</span><span>Check the latest available NSE quote</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>Compare recent daily closing prices on a graph</span></div>
                <div className="feature-item"><span className="feature-check">✓</span><span>See company, price, range, and timestamp in a table</span></div>
              </div>

              <div className="hero-footnote">
                <span className="sparkle">✳</span>
                Exchange data through jugaad-data. Timestamps use India Standard Time.
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

      {hasEntered && <DailyMarketNewsWidget onUnauthorized={handleMarketWatchUnauthorized} />}

      <footer className="site-footer">
        <span>MarketBrief AI</span>
        <span>Latest available Indian stock details and daily price trends.</span>
        <span className="footer-language">MARKETS <i>·</i> STOCKS <i>·</i> DATA</span>
      </footer>
    </div>
  );
}
