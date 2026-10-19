import { useEffect, useRef, useState } from "react";
import { formatIndiaDateTime } from "../../../lib/formatters.js";
import { getDailyMarketDigest } from "../api/marketService.js";
import { CatalystSourceThumbnail } from "./CatalystSourceThumbnail.jsx";

const AUTO_REFRESH_MS = 60 * 60 * 1000;

function formatSourceDate(value) {
  if (!value) return "Date not supplied";
  const relative = String(value).match(/^(\d+\s+(?:day|week|month)s?\s+ago|today|yesterday)$/i);
  if (relative) return relative[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : formatIndiaDateTime(date.toISOString());
}

function DigestSource({ source }) {
  const kind = source.kind === "video" ? "YOUTUBE" : source.kind === "news" ? "NEWS" : "WEB";
  return (
    <a className="daily-market-source" href={source.url} target="_blank" rel="noopener noreferrer">
      <CatalystSourceThumbnail source={source} className={`daily-market-source-thumb is-${source.kind}`} />
      <span className="daily-market-source-copy">
        <span>{kind}</span>
        <strong>{source.title}</strong>
        <small>{source.publisher || "Market source"} · {formatSourceDate(source.published_at)}</small>
      </span>
      <span className="daily-market-source-arrow" aria-hidden="true">↗</span>
    </a>
  );
}

export function DailyMarketNewsWidget({ onUnauthorized }) {
  const [open, setOpen] = useState(false);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const loadDigestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadDigest(refresh = false) {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      setError("");
      try {
        const payload = await getDailyMarketDigest({ refresh, signal: controller.signal });
        if (active) setDigest(payload);
      } catch (requestError) {
        if (!active || requestError.name === "AbortError") return;
        if (requestError.status === 401) onUnauthorized();
        setError(requestError.message || "The daily market brief could not be loaded.");
      } finally {
        inFlight.current = false;
        if (active) setLoading(false);
      }
    }

    loadDigestRef.current = loadDigest;
    void loadDigest();
    const timer = window.setInterval(() => void loadDigest(), AUTO_REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      loadDigestRef.current = null;
    };
  }, [onUnauthorized]);

  const stories = [...(digest?.news || []), ...(digest?.web || [])].slice(0, 3);
  const videos = (digest?.videos || []).slice(0, 2);
  const sourceCount = (digest?.news?.length || 0) + (digest?.web?.length || 0) + (digest?.videos?.length || 0);
  const launcherPreview = stories[0]?.title || videos[0]?.title;

  return (
    <div className="daily-market-widget">
      {open && (
        <section className="daily-market-panel" id="daily-market-panel" aria-label="Daily AI market news">
          <header className="daily-market-panel-header">
            <span className="daily-market-agent-avatar" aria-hidden="true">AI</span>
            <div>
              <strong>Market Catalyst Agent</strong>
              <small>Daily India stock market brief</small>
            </div>
            <button
              className="daily-market-refresh"
              type="button"
              disabled={loading}
              onClick={() => loadDigestRef.current?.(true)}
              aria-label="Refresh today's market brief"
              title="Refresh today's market brief"
            >
              ↻
            </button>
            <button className="daily-market-close" type="button" onClick={() => setOpen(false)} aria-label="Close daily market brief">×</button>
          </header>

          <div className="daily-market-content" aria-live="polite">
            <div className="daily-market-agent-message">
              <span>MARKET UPDATE · {digest?.as_of_date || "TODAY"}</span>
              {loading && !digest ? <p>Gathering today's market news and YouTube videos…</p> : (
                <p>{digest?.brief?.summary || (error ? "I couldn't load today's market brief." : "Today's market brief will appear here shortly.")}</p>
              )}
              {!!digest?.brief?.factors?.length && (
                <ul>
                  {digest.brief.factors.slice(0, 2).map((factor, index) => (
                    <li key={`${factor.topic}-${index}`}><strong>{factor.topic}:</strong> {factor.explanation}</li>
                  ))}
                </ul>
              )}
              <small>Reported coverage can provide context; it does not confirm what caused a stock move.</small>
            </div>

            {error && <p className="daily-market-error" role="alert">{error}</p>}
            {!!stories.length && (
              <section className="daily-market-source-section" aria-label="News and market coverage">
                <h3>NEWS & MARKET COVERAGE</h3>
                {stories.map((source) => <DigestSource key={source.id} source={source} />)}
              </section>
            )}
            {!!videos.length && (
              <section className="daily-market-source-section" aria-label="YouTube videos">
                <h3>YOUTUBE VIDEOS</h3>
                {videos.map((source) => <DigestSource key={source.id} source={source} />)}
              </section>
            )}
            {!!digest && !sourceCount && !loading && <p className="daily-market-empty">No recent market stories or videos were found today.</p>}
            {digest?.retrieved_at && <small className="daily-market-updated">Updated {formatIndiaDateTime(digest.retrieved_at)} IST · refreshes hourly</small>}
          </div>
        </section>
      )}

      <button
        className={`daily-market-launcher${open ? " is-open" : ""}`}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="daily-market-launcher-icon" aria-hidden="true">✦</span>
        <span><strong>Daily AI brief</strong><small>{loading ? "Gathering market news…" : launcherPreview || "News & YouTube"}</small></span>
        {sourceCount > 0 && <span className="daily-market-count">{sourceCount}</span>}
      </button>
    </div>
  );
}
