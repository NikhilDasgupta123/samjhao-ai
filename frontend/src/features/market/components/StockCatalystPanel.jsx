import { useEffect, useRef, useState } from "react";
import { formatIndiaDateTime } from "../../../lib/formatters.js";
import { getStockCatalysts } from "../api/marketService.js";

function formatSourceDate(value) {
  if (!value) return "Date not supplied";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00+05:30` : value);
  if (Number.isNaN(date.getTime())) return "Date not supplied";
  return dateOnly
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date)
    : formatIndiaDateTime(date.toISOString());
}

function CatalystSourceList({ items, emptyLabel }) {
  if (!items.length) return <p className="catalyst-empty-sources">{emptyLabel}</p>;

  return (
    <ul className="catalyst-source-list">
      {items.map((source) => (
        <li id={`catalyst-source-${source.id}`} key={source.id} className="catalyst-source-item">
          <div className="catalyst-source-copy">
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
            <span>{source.publisher || (source.kind === "web" ? "Web source" : "News source")} · {formatSourceDate(source.published_at)}</span>
            {source.snippet && <p>{source.snippet}</p>}
          </div>
          {source.kind === "web" && <span className="catalyst-web-mark" aria-hidden="true">↗</span>}
        </li>
      ))}
    </ul>
  );
}

export function StockCatalystPanel({ data, onUnauthorized }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSourceTab, setActiveSourceTab] = useState("news");
  const [refreshCount, setRefreshCount] = useState(0);
  const forceRefresh = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const refresh = forceRefresh.current;
    forceRefresh.current = false;
    setLoading(true);
    setError("");
    setResult(null);

    getStockCatalysts({
      symbol: data.symbol,
      companyName: data.quote.company_name,
      refresh,
      signal: controller.signal,
    })
      .then((payload) => {
        if (active) setResult(payload);
      })
      .catch((requestError) => {
        if (!active || requestError.name === "AbortError") return;
        if (requestError.status === 401) onUnauthorized();
        else setError(requestError.message || "Source research could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [data.symbol, data.quote.company_name, onUnauthorized, refreshCount]);

  const sources = activeSourceTab === "news" ? result?.news || [] : result?.web || [];
  const sourceError = activeSourceTab === "news" ? result?.news_error : result?.web_error;

  function refreshSources() {
    forceRefresh.current = true;
    setRefreshCount((current) => current + 1);
  }

  return (
    <section className="portal-card stock-catalyst-card" aria-labelledby="stock-catalyst-title" aria-live="polite">
      <div className="portal-panel-heading stock-catalyst-heading">
        <div>
          <h2 id="stock-catalyst-title">What may be affecting this stock?</h2>
          <p>Recent news, blogs, and public web/social coverage for {data.quote.company_name || data.symbol}.</p>
        </div>
        <button type="button" className="stock-catalyst-refresh" onClick={refreshSources} disabled={loading}>
          {loading ? "Searching…" : "Search again"}
        </button>
      </div>

      {loading && <p className="stock-catalyst-status">Searching recent articles, blogs, and public web/social posts…</p>}
      {error && <p className="stock-catalyst-error" role="alert">{error}</p>}

      {result && (
        <>
          <div className="catalyst-summary">
            <span className="catalyst-summary-label">SOURCE-BASED SUMMARY</span>
            <p>{result.brief.summary}</p>
            {!!result.brief.factors?.length && (
              <ul className="catalyst-factor-list">
                {result.brief.factors.map((factor, index) => (
                  <li key={`${factor.topic}-${index}`}>
                    <span className={`catalyst-direction is-${factor.direction}`}>{factor.direction}</span>
                    <div>
                      <strong>{factor.topic}</strong>
                      <p>{factor.explanation}</p>
                      <small>
                        Sources: {factor.source_ids.map((sourceId, sourceIndex) => (
                          <span key={sourceId}>
                            {sourceIndex > 0 && ", "}
                            <a href={`#catalyst-source-${sourceId}`}>{sourceId}</a>
                          </span>
                        ))}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <small>{result.brief.limitation}</small>
          </div>

          <div className="stock-catalyst-source-toolbar">
            <div className="stock-catalyst-source-tabs" role="tablist" aria-label="Catalyst source type">
              <button type="button" role="tab" aria-selected={activeSourceTab === "news"} className={activeSourceTab === "news" ? "active" : ""} onClick={() => setActiveSourceTab("news")}>
                News & blogs <span>{result.news.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={activeSourceTab === "web"} className={activeSourceTab === "web" ? "active" : ""} onClick={() => setActiveSourceTab("web")}>
                Web & social <span>{result.web.length}</span>
              </button>
            </div>
            <span className="catalyst-retrieved-at">Searched {formatIndiaDateTime(result.retrieved_at)}{result.cached ? " · cached" : ""}</span>
          </div>

          {sourceError && <p className="stock-catalyst-error" role="status">{sourceError}</p>}
          <CatalystSourceList
            items={sources}
            emptyLabel={sourceError || (activeSourceTab === "news" ? "No recent news results found." : "No recent public web or social results found.")}
          />
          {result.summary_error && <p className="catalyst-summary-fallback" role="status">AI summary unavailable; source links are still shown above.</p>}
        </>
      )}
    </section>
  );
}
