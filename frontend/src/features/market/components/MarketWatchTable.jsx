import { useEffect, useRef, useState } from "react";
import { ArrowIcon, SearchIcon, TableViewIcon, NodeViewIcon } from "../../../components/icons.jsx";
import { formatRupees, formatIndiaDateTime, formatMarketVolume } from "../../../lib/formatters.js";
import { getMarketWatch, getStockMarketData } from "../api/marketService.js";
import { MiniStockChart } from "./MiniStockChart.jsx";

export function MarketWatchTable({ onUseSymbol, onUnauthorized }) {
  const [marketWatch, setMarketWatch] = useState(null);
  const [marketWatchError, setMarketWatchError] = useState("");
  const [isMarketWatchLoading, setIsMarketWatchLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [viewFormat, setViewFormat] = useState("table");
  const [hoveredGraphSymbol, setHoveredGraphSymbol] = useState(null);
  const [selectedGraphSymbol, setSelectedGraphSymbol] = useState(null);
  const [selectedGraphDetails, setSelectedGraphDetails] = useState(null);
  const [graphDetailsLoading, setGraphDetailsLoading] = useState(false);
  const [graphDetailsError, setGraphDetailsError] = useState("");
  const graphDetailsController = useRef(null);
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    let refreshTimer;
    let controller;

    async function loadMarketWatch() {
      controller = new AbortController();
      try {
        const payload = await getMarketWatch({ signal: controller.signal });
        if (!active) return;
        setMarketWatch(payload);
        setMarketWatchError("");
      } catch (requestError) {
        if (!active || requestError.name === "AbortError") return;
        if (requestError.status === 401) {
          onUnauthorized();
          return;
        }
        setMarketWatchError(requestError instanceof TypeError
          ? "Could not connect to the backend. Market watch will retry automatically."
          : requestError.message);
      } finally {
        if (active) {
          setIsMarketWatchLoading(false);
          refreshTimer = window.setTimeout(loadMarketWatch, 60_000);
        }
      }
    }

    loadMarketWatch();
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      controller?.abort();
      graphDetailsController.current?.abort();
    };
  }, [onUnauthorized]);

  useEffect(() => setPage(0), [filter]);

  const filteredRows = (marketWatch?.rows || []).filter((row) => {
    const query = filter.trim().toLowerCase();
    return !query || row.symbol.toLowerCase().includes(query)
      || (row.company_name || "").toLowerCase().includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);
  const graphCenter = { x: 500, y: 380 };
  const graphNodes = visibleRows.map((row, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(visibleRows.length, 1);
    return {
      ...row,
      x: graphCenter.x + Math.cos(angle) * 275,
      y: graphCenter.y + Math.sin(angle) * 275,
      tone: row.percent_change > 0 ? "positive" : row.percent_change < 0 ? "negative" : "flat",
    };
  });
  const activeGraphSymbol = hoveredGraphSymbol || selectedGraphSymbol;
  const activeGraphNode = graphNodes.find((node) => node.symbol === activeGraphSymbol) || null;
  const activeGraphDetails = selectedGraphSymbol === activeGraphNode?.symbol ? selectedGraphDetails : null;
  const activeGraphQuote = activeGraphDetails?.quote || activeGraphNode;
  const activeGraphTone = activeGraphQuote?.percent_change > 0
    ? "positive"
    : activeGraphQuote?.percent_change < 0 ? "negative" : "flat";
  const activeGraphLoading = selectedGraphSymbol === activeGraphNode?.symbol && graphDetailsLoading;
  const activeGraphError = selectedGraphSymbol === activeGraphNode?.symbol ? graphDetailsError : "";
  const activeGraphUpdatedAt = activeGraphDetails?.retrieved_at
    || activeGraphQuote?.data_as_of
    || activeGraphNode?.updated_at
    || marketWatch?.retrieved_at;
  const activeGraphPopoverPosition = activeGraphNode
    ? `${activeGraphNode.x >= graphCenter.x ? "is-left" : "is-right"} ${activeGraphNode.y >= graphCenter.y ? "is-top" : "is-bottom"}`
    : "";

  function closeGraphPopover() {
    graphDetailsController.current?.abort();
    graphDetailsController.current = null;
    setHoveredGraphSymbol(null);
    setSelectedGraphSymbol(null);
    setSelectedGraphDetails(null);
    setGraphDetailsError("");
    setGraphDetailsLoading(false);
  }

  async function openGraphNode(row) {
    graphDetailsController.current?.abort();
    if (selectedGraphSymbol === row.symbol) {
      graphDetailsController.current = null;
      setHoveredGraphSymbol(null);
      setSelectedGraphSymbol(null);
      setSelectedGraphDetails(null);
      setGraphDetailsError("");
      setGraphDetailsLoading(false);
      return;
    }

    const requestController = new AbortController();
    graphDetailsController.current = requestController;
    setSelectedGraphSymbol(row.symbol);
    setSelectedGraphDetails(null);
    setGraphDetailsError("");
    setGraphDetailsLoading(true);
    try {
      const payload = await getStockMarketData({
        symbol: row.symbol,
        historyDays: 30,
        signal: requestController.signal,
      });
      setSelectedGraphDetails(payload);
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      if (requestError.status === 401) onUnauthorized();
      else setGraphDetailsError(requestError.message || "Stock details could not be loaded.");
    } finally {
      if (graphDetailsController.current === requestController) {
        graphDetailsController.current = null;
        setGraphDetailsLoading(false);
      }
    }
  }

  return (
    <section className="portal-card market-watch-card">
      <div className="portal-panel-heading market-watch-heading">
        <div>
          <h2>India market watch <span className="market-watch-count">{marketWatch?.rows?.length || ""}</span></h2>
          <p>NIFTY 500 stocks · automatic snapshot refresh every 60 seconds</p>
        </div>
        <span className="market-watch-updated">
          <i className={marketWatch ? "market-watch-live-dot" : "market-watch-live-dot is-muted"} />
          {marketWatch ? `Updated ${formatIndiaDateTime(marketWatch.retrieved_at)}` : isMarketWatchLoading ? "Loading market data…" : "Waiting for data"}
        </span>
      </div>
      <div className="market-watch-toolbar">
        <div className="market-watch-search-controls">
          <label className="market-watch-filter">
            <SearchIcon />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search company or NSE symbol"
              aria-label="Filter market watch by company or symbol"
            />
          </label>
          <div className="market-watch-format-toggle" role="group" aria-label="Market watch display format">
            <button
              type="button"
              className={viewFormat === "table" ? "active" : ""}
              aria-pressed={viewFormat === "table"}
              onClick={() => setViewFormat("table")}
            >
              <TableViewIcon /> <span>Table</span>
            </button>
            <button
              type="button"
              className={viewFormat === "nodes" ? "active" : ""}
              aria-pressed={viewFormat === "nodes"}
              onClick={() => setViewFormat("nodes")}
            >
              <NodeViewIcon /> <span>Node Visual</span>
            </button>
          </div>
        </div>
        <span className="market-watch-note">Snapshot data, not tick-by-tick streaming</span>
      </div>
      {marketWatchError && <p className="market-watch-error" role="status">{marketWatchError}</p>}
      {viewFormat === "table" ? (
        <div className="market-watch-table-wrap">
          <table className="market-watch-table">
            <thead>
              <tr>
                <th scope="col">Company / symbol</th>
                <th scope="col">Last price</th>
                <th scope="col">Change</th>
                <th scope="col">Change %</th>
                <th scope="col">Volume</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const tone = row.percent_change > 0 ? "market-positive" : row.percent_change < 0 ? "market-negative" : "";
                return (
                  <tr key={row.symbol}>
                    <td><strong>{row.company_name || row.symbol}</strong><span className="market-watch-symbol">{row.symbol}</span></td>
                    <td>{formatRupees(row.last_price)}</td>
                    <td className={tone}>{row.change == null ? "—" : formatRupees(row.change)}</td>
                    <td className={tone}>{row.percent_change == null ? "—" : `${Number(row.percent_change).toFixed(2)}%`}</td>
                    <td>{formatMarketVolume(row.volume)}</td>
                    <td><button className="market-watch-select" type="button" onClick={() => onUseSymbol(row.symbol)}>View</button></td>
                  </tr>
                );
              })}
              {!visibleRows.length && (
                <tr><td className="market-watch-empty" colSpan="6">{isMarketWatchLoading ? "Loading NIFTY 500 quotes…" : "No matching stock found."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="market-watch-graph-wrap"
          onMouseLeave={() => setHoveredGraphSymbol(null)}
        >
          <div className="market-watch-graph-legend">
            <span><i className="graph-legend-index" /> NIFTY 500 index</span>
            <span><i className="graph-legend-up" /> Gaining</span>
            <span><i className="graph-legend-down" /> Declining</span>
            <span>Showing {graphNodes.length} nodes · hover for a snapshot · click for the price graph</span>
          </div>
          {graphNodes.length ? (
            <svg className="market-watch-network" viewBox="0 0 1000 760" role="group" aria-label={`NIFTY 500 connected to ${graphNodes.length} stocks on this page`}>
              <circle className="market-watch-network-orbit" cx={graphCenter.x} cy={graphCenter.y} r="275" />
              {graphNodes.map((node) => {
                const dx = node.x - graphCenter.x;
                const dy = node.y - graphCenter.y;
                const distance = Math.hypot(dx, dy);
                const startRatio = 67 / distance;
                const endRatio = 38 / distance;
                return (
                  <line
                    className={`market-watch-network-edge ${node.tone}${node.symbol === activeGraphSymbol ? " active" : ""}`}
                    key={`${node.symbol}-edge`}
                    x1={graphCenter.x + dx * startRatio}
                    y1={graphCenter.y + dy * startRatio}
                    x2={node.x - dx * endRatio}
                    y2={node.y - dy * endRatio}
                  />
                );
              })}
              <g className="market-watch-network-hub">
                <circle cx={graphCenter.x} cy={graphCenter.y} r="65" />
                <text x={graphCenter.x} y={graphCenter.y - 4}>NIFTY 500</text>
                <text className="market-watch-network-hub-count" x={graphCenter.x} y={graphCenter.y + 16}>{graphNodes.length} visible nodes</text>
              </g>
              {graphNodes.map((node) => (
                <g
                  className={`market-watch-network-node ${node.tone}${node.symbol === activeGraphSymbol ? " active" : ""}`}
                  key={node.symbol}
                  role="button"
                  tabIndex="0"
                  aria-label={`${node.company_name || node.symbol}, ${formatRupees(node.last_price)}, ${node.percent_change == null ? "change unavailable" : `${Number(node.percent_change).toFixed(2)} percent change`}. Click to show the price graph.`}
                  onMouseEnter={() => setHoveredGraphSymbol(node.symbol)}
                  onFocus={() => setHoveredGraphSymbol(node.symbol)}
                  onBlur={(event) => {
                    if (!event.currentTarget.closest(".market-watch-graph-wrap")?.contains(event.relatedTarget)) {
                      setHoveredGraphSymbol(null);
                    }
                  }}
                  onClick={() => openGraphNode(node)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openGraphNode(node);
                    } else if (event.key === "Escape") {
                      closeGraphPopover();
                    }
                  }}
                >
                  <circle cx={node.x} cy={node.y} r="38" />
                  <text className="market-watch-network-symbol" x={node.x} y={node.y - 3} fontSize={node.symbol.length > 8 ? 7 : 9}>{node.symbol}</text>
                  <text className="market-watch-network-change" x={node.x} y={node.y + 13}>{node.percent_change == null ? "—" : `${Number(node.percent_change) > 0 ? "+" : ""}${Number(node.percent_change).toFixed(1)}%`}</text>
                </g>
              ))}
            </svg>
          ) : (
            <p className="market-watch-empty-node">{isMarketWatchLoading ? "Loading NIFTY 500 quotes…" : "No matching stock found."}</p>
          )}
          {activeGraphNode && activeGraphQuote && (
            <aside
              className={`market-watch-stock-popover ${activeGraphTone} ${activeGraphPopoverPosition}`}
              aria-label={`${activeGraphNode.company_name || activeGraphNode.symbol} stock details`}
              aria-live="polite"
              onKeyDown={(event) => {
                if (event.key === "Escape") closeGraphPopover();
              }}
            >
              <div className="market-watch-popover-heading">
                <div>
                  <strong>{activeGraphNode.company_name || activeGraphNode.symbol}</strong>
                  <span>{activeGraphNode.symbol} · NSE</span>
                </div>
                <button type="button" onClick={closeGraphPopover} aria-label="Close stock details">×</button>
              </div>
              <div className="market-watch-popover-price-row">
                <strong>{formatRupees(activeGraphQuote.last_price)}</strong>
                <span className={`market-watch-popover-change ${activeGraphTone}`}>
                  {activeGraphQuote.change == null ? "—" : `${Number(activeGraphQuote.change) > 0 ? "+" : Number(activeGraphQuote.change) < 0 ? "-" : ""}${formatRupees(Math.abs(Number(activeGraphQuote.change)))}`}
                  {activeGraphQuote.percent_change == null ? "" : ` (${Number(activeGraphQuote.percent_change) > 0 ? "+" : ""}${Number(activeGraphQuote.percent_change).toFixed(2)}%)`}
                </span>
              </div>
              <div className="market-watch-popover-metrics">
                <span>Previous close <strong>{formatRupees(activeGraphQuote.previous_close)}</strong></span>
                <span>Volume <strong>{formatMarketVolume(activeGraphNode.volume)}</strong></span>
              </div>
              <MiniStockChart
                history={activeGraphDetails?.history || []}
                previousClose={activeGraphQuote.previous_close}
                currentPrice={activeGraphQuote.last_price}
              />
              <p className="market-watch-popover-caption">
                {activeGraphDetails ? "Recent closing prices · 30 sessions" : "Session move · click the node for a 30-day graph"}
                {activeGraphUpdatedAt && ` · ${formatIndiaDateTime(activeGraphUpdatedAt)}`}
              </p>
              {activeGraphLoading && <p className="market-watch-popover-status">Loading price history…</p>}
              {activeGraphError && <p className="market-watch-popover-error" role="status">{activeGraphError}</p>}
              <button className="market-watch-popover-link" type="button" onClick={() => onUseSymbol(activeGraphNode.symbol)}>
                View full stock details <ArrowIcon />
              </button>
            </aside>
          )}
        </div>
      )}
      <div className="market-watch-footer">
        <span>{filteredRows.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filteredRows.length)} of ${filteredRows.length} stocks` : "0 stocks"}</span>
        <div>
          <button type="button" disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button>
          <span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span>
          <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button>
        </div>
      </div>
      <p className="market-watch-disclaimer">NIFTY 500 covers 500 major NSE stocks, not every listed Indian stock. Refreshes provide the latest available NSE snapshot; updates can be delayed or unavailable outside market hours.</p>
    </section>
  );
}
