import { useEffect, useRef, useState } from "react";
import { SearchIcon, TableViewIcon, NodeViewIcon } from "../../../components/icons.jsx";
import { formatRupees, formatIndiaDateTime, formatMarketVolume } from "../../../lib/formatters.js";
import { getMarketWatch, getStockMarketData } from "../api/marketService.js";
import { StockDetailsPopover } from "./StockDetailsPopover.jsx";

export function MarketWatchTable({ onUseSymbol, onUnauthorized }) {
  const [marketWatch, setMarketWatch] = useState(null);
  const [marketWatchError, setMarketWatchError] = useState("");
  const [isMarketWatchLoading, setIsMarketWatchLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [viewFormat, setViewFormat] = useState("table");
  const [chartType, setChartType] = useState("line");
  const [hoveredGraphSymbol, setHoveredGraphSymbol] = useState(null);
  const [draggingGraphSymbol, setDraggingGraphSymbol] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [selectedGraphSymbol, setSelectedGraphSymbol] = useState(null);
  const [selectedGraphDetails, setSelectedGraphDetails] = useState(null);
  const [graphDetailsLoading, setGraphDetailsLoading] = useState(false);
  const [graphDetailsError, setGraphDetailsError] = useState("");
  const [hoveredTableSymbol, setHoveredTableSymbol] = useState(null);
  const [tablePopoverPosition, setTablePopoverPosition] = useState(null);
  const graphDetailsController = useRef(null);
  const graphNodeDrag = useRef(null);
  const suppressGraphClick = useRef(false);
  const tablePopoverTimer = useRef(null);
  const historyLoadTimer = useRef(null);
  const previousPrices = useRef(new Map());
  const priceFlashTimer = useRef(null);
  const tableWrapRef = useRef(null);
  const paginationSentinelRef = useRef(null);
  const [priceFlashes, setPriceFlashes] = useState({});
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    let refreshTimer;
    let controller;
    let refreshDelayMs = 1_000;

    async function loadMarketWatch() {
      controller = new AbortController();
      try {
        const payload = await getMarketWatch({ signal: controller.signal });
        if (!active) return;
        setMarketWatch(payload);
        refreshDelayMs = Math.max(1, Number(payload.refresh_interval_seconds) || 1) * 1_000;
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
          refreshTimer = window.setTimeout(loadMarketWatch, refreshDelayMs);
        }
      }
    }

    loadMarketWatch();
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      window.clearTimeout(tablePopoverTimer.current);
      window.clearTimeout(historyLoadTimer.current);
      controller?.abort();
      graphDetailsController.current?.abort();
    };
  }, [onUnauthorized]);

  useEffect(() => {
    if (!marketWatch?.rows) return undefined;

    const nextPrices = new Map();
    const nextFlashes = {};
    for (const row of marketWatch.rows) {
      const price = Number(row.last_price);
      if (!Number.isFinite(price)) continue;
      const previousPrice = previousPrices.current.get(row.symbol);
      if (previousPrice != null && price !== previousPrice) {
        nextFlashes[row.symbol] = price > previousPrice ? "up" : "down";
      }
      nextPrices.set(row.symbol, price);
    }
    previousPrices.current = nextPrices;
    setPriceFlashes(nextFlashes);

    window.clearTimeout(priceFlashTimer.current);
    if (Object.keys(nextFlashes).length) {
      priceFlashTimer.current = window.setTimeout(() => setPriceFlashes({}), 900);
    }
    return () => window.clearTimeout(priceFlashTimer.current);
  }, [marketWatch]);

  useEffect(() => {
    setPage(0);
    window.clearTimeout(tablePopoverTimer.current);
    window.clearTimeout(historyLoadTimer.current);
    setHoveredTableSymbol(null);
    setTablePopoverPosition(null);
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, [filter]);

  const filteredRows = (marketWatch?.rows || []).filter((row) => {
    const query = filter.trim().toLowerCase();
    return !query || row.symbol.toLowerCase().includes(query)
      || (row.company_name || "").toLowerCase().includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice(0, (page + 1) * pageSize);
  const hasMoreRows = visibleRows.length < filteredRows.length;

  useEffect(() => {
    if (viewFormat !== "table" || !hasMoreRows) return undefined;
    const root = tableWrapRef.current;
    const sentinel = paginationSentinelRef.current;
    if (!root || !sentinel) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setPage((currentPage) => Math.min(pageCount - 1, currentPage + 1));
    }, { root, rootMargin: "0px 0px 100px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreRows, pageCount, viewFormat, visibleRows.length]);
  const graphCenter = { x: 500, y: 380 };
  const graphNodes = visibleRows.map((row, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(visibleRows.length, 1);
    const savedPosition = nodePositions[row.symbol];
    return {
      ...row,
      x: savedPosition?.x ?? graphCenter.x + Math.cos(angle) * 275,
      y: savedPosition?.y ?? graphCenter.y + Math.sin(angle) * 275,
      tone: row.percent_change > 0 ? "positive" : row.percent_change < 0 ? "negative" : "flat",
    };
  });
  const activeGraphSymbol = viewFormat === "table"
    ? hoveredTableSymbol
    : hoveredGraphSymbol || selectedGraphSymbol;
  const activeGraphNode = (viewFormat === "table" ? filteredRows : graphNodes)
    .find((node) => node.symbol === activeGraphSymbol) || null;
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
    window.clearTimeout(tablePopoverTimer.current);
    window.clearTimeout(historyLoadTimer.current);
    setHoveredGraphSymbol(null);
    setHoveredTableSymbol(null);
    setTablePopoverPosition(null);
    setSelectedGraphSymbol(null);
    setSelectedGraphDetails(null);
    setGraphDetailsError("");
    setGraphDetailsLoading(false);
  }

  function showTablePopover(row, element) {
    window.clearTimeout(tablePopoverTimer.current);
    const bounds = element.getBoundingClientRect();
    const popoverWidth = Math.min(310, window.innerWidth - 24);
    const popoverHeight = 270;
    const isMobile = window.innerWidth <= 560;
    const left = isMobile
      ? 12
      : bounds.right + popoverWidth + 12 <= window.innerWidth
        ? bounds.right + 12
        : Math.max(12, bounds.left - popoverWidth - 12);
    const top = isMobile
      ? Math.max(12, Math.min(bounds.top, window.innerHeight - popoverHeight - 12))
      : Math.max(12, Math.min(bounds.top + bounds.height / 2 - popoverHeight / 2, window.innerHeight - popoverHeight - 12));
    setTablePopoverPosition({ top, left });
    setHoveredTableSymbol(row.symbol);
    scheduleStockHistoryLoad(row);
  }

  function scheduleTablePopoverClose() {
    window.clearTimeout(tablePopoverTimer.current);
    tablePopoverTimer.current = window.setTimeout(() => {
      window.clearTimeout(historyLoadTimer.current);
      setHoveredTableSymbol(null);
      setTablePopoverPosition(null);
    }, 220);
  }

  function closeTablePopover() {
    window.clearTimeout(tablePopoverTimer.current);
    window.clearTimeout(historyLoadTimer.current);
    setHoveredTableSymbol(null);
    setTablePopoverPosition(null);
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

    await loadStockHistory(row);
  }

  async function loadStockHistory(row) {
    window.clearTimeout(historyLoadTimer.current);
    graphDetailsController.current?.abort();
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

  function handleChartTypeChange(type, row) {
    setChartType(type);
    if (selectedGraphSymbol !== row.symbol || !selectedGraphDetails?.history?.length) {
      loadStockHistory(row);
    }
  }

  function scheduleStockHistoryLoad(row) {
    if (chartType !== "candlestick" || selectedGraphSymbol === row.symbol) return;
    window.clearTimeout(historyLoadTimer.current);
    historyLoadTimer.current = window.setTimeout(() => loadStockHistory(row), 350);
  }

  function showGraphPopover(node) {
    setHoveredGraphSymbol(node.symbol);
    scheduleStockHistoryLoad(node);
  }

  function closeGraphHover() {
    window.clearTimeout(historyLoadTimer.current);
    setHoveredGraphSymbol(null);
  }

  function getGraphPointerPosition(event) {
    const svg = event.currentTarget.ownerSVGElement;
    const screenMatrix = svg?.getScreenCTM();
    if (!svg || !screenMatrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(screenMatrix.inverse());
  }

  function startGraphNodeDrag(event, node) {
    if (event.button !== 0) return;
    const point = getGraphPointerPosition(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    graphNodeDrag.current = {
      symbol: node.symbol,
      pointerId: event.pointerId,
      offsetX: node.x - point.x,
      offsetY: node.y - point.y,
      startX: point.x,
      startY: point.y,
      moved: false,
    };
    setDraggingGraphSymbol(node.symbol);
    setHoveredGraphSymbol(node.symbol);
  }

  function moveGraphNode(event, node) {
    const drag = graphNodeDrag.current;
    if (!drag || drag.symbol !== node.symbol || drag.pointerId !== event.pointerId) return;
    const point = getGraphPointerPosition(event);
    if (!point) return;
    if (!drag.moved && Math.hypot(point.x - drag.startX, point.y - drag.startY) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    const x = Math.max(42, Math.min(958, point.x + drag.offsetX));
    const y = Math.max(42, Math.min(718, point.y + drag.offsetY));
    setNodePositions((positions) => ({ ...positions, [node.symbol]: { x, y } }));
  }

  function finishGraphNodeDrag(event) {
    const drag = graphNodeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    graphNodeDrag.current = null;
    setDraggingGraphSymbol(null);
    if (drag.moved) {
      suppressGraphClick.current = true;
      window.setTimeout(() => { suppressGraphClick.current = false; }, 80);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleGraphNodeClick(node, event) {
    if (suppressGraphClick.current) {
      suppressGraphClick.current = false;
      event.preventDefault();
      return;
    }
    openGraphNode(node);
  }

  return (
    <section className="portal-card market-watch-card">
      <div className="portal-panel-heading market-watch-heading">
        <div>
          <h2>India market watch <span className="market-watch-count">{marketWatch?.rows?.length || ""}</span></h2>
          <p>NIFTY 500 stocks · checks NSE snapshots every second</p>
        </div>
        <span className="market-watch-updated">
          <i className={marketWatch ? "market-watch-live-dot" : "market-watch-live-dot is-muted"} />
          {marketWatch ? `Snapshot checked ${formatIndiaDateTime(marketWatch.retrieved_at, { includeSeconds: true })}` : isMarketWatchLoading ? "Loading market data…" : "Waiting for data"}
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
        <span className="market-watch-note">Prices change when NSE publishes a new snapshot · not tick streaming</span>
      </div>
      {marketWatchError && <p className="market-watch-error" role="status">{marketWatchError}</p>}
      {viewFormat === "table" ? (
        <div className="market-watch-table-wrap" ref={tableWrapRef} onScroll={closeTablePopover}>
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
                const directionValue = row.change ?? row.percent_change;
                const direction = directionValue > 0 ? "up" : directionValue < 0 ? "down" : "flat";
                const priceFlash = priceFlashes[row.symbol];
                return (
                  <tr
                    className={`market-watch-row${priceFlash ? ` market-watch-row-flash-${priceFlash}` : ""}`}
                    key={row.symbol}
                    tabIndex="0"
                    onMouseEnter={(event) => showTablePopover(row, event.currentTarget)}
                    onMouseLeave={scheduleTablePopoverClose}
                    onFocus={(event) => showTablePopover(row, event.currentTarget)}
                    onBlur={scheduleTablePopoverClose}
                  >
                    <td><strong>{row.company_name || row.symbol}</strong><span className="market-watch-symbol">{row.symbol}</span></td>
                    <td className={priceFlash ? `market-price-tick market-price-tick-${priceFlash}` : ""}>{formatRupees(row.last_price)}</td>
                    <td className={tone}>{row.change == null ? "—" : (
                      <span className={`market-watch-move ${direction}`}>
                        <span className="market-watch-move-arrow" aria-hidden="true">{direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}</span>
                        {formatRupees(row.change)}
                      </span>
                    )}</td>
                    <td className={tone}>{row.percent_change == null ? "—" : `${Number(row.percent_change).toFixed(2)}%`}</td>
                    <td>{formatMarketVolume(row.volume)}</td>
                    <td><button className="market-watch-select" type="button" onClick={() => onUseSymbol(row.symbol)}>View</button></td>
                  </tr>
                );
              })}
              {!visibleRows.length && (
                <tr><td className="market-watch-empty" colSpan="6">{isMarketWatchLoading ? "Loading NIFTY 500 quotes…" : "No matching stock found."}</td></tr>
              )}
              {hasMoreRows && <tr className="market-watch-pagination-sentinel" ref={paginationSentinelRef} aria-hidden="true"><td colSpan="6" /></tr>}
            </tbody>
          </table>
          {activeGraphNode && activeGraphQuote && tablePopoverPosition && (
            <StockDetailsPopover
              stock={activeGraphNode}
              quote={activeGraphQuote}
              tone={activeGraphTone}
              details={activeGraphDetails}
              updatedAt={activeGraphUpdatedAt}
              loading={activeGraphLoading}
              error={activeGraphError}
              chartType={chartType}
              onChartTypeChange={(type) => handleChartTypeChange(type, activeGraphNode)}
              emptyHistoryCaption="Session move · previous close vs latest price"
              className="is-table"
              style={{ top: tablePopoverPosition.top, left: tablePopoverPosition.left }}
              onClose={closeGraphPopover}
              onMouseEnter={() => window.clearTimeout(tablePopoverTimer.current)}
              onMouseLeave={scheduleTablePopoverClose}
              onViewDetails={onUseSymbol}
            />
          )}
        </div>
      ) : (
        <div
          className="market-watch-graph-wrap"
          onMouseLeave={closeGraphHover}
        >
          <div className="market-watch-graph-legend">
            <span><i className="graph-legend-index" /> NIFTY 500 index</span>
            <span><i className="graph-legend-up" /> Gaining</span>
            <span><i className="graph-legend-down" /> Declining</span>
            <span>Showing {graphNodes.length} nodes · drag to rearrange · hover for a snapshot · click for the price graph</span>
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
                  className={`market-watch-network-node ${node.tone}${node.symbol === activeGraphSymbol ? " active" : ""}${node.symbol === draggingGraphSymbol ? " dragging" : ""}`}
                  key={node.symbol}
                  role="button"
                  tabIndex="0"
                  aria-label={`${node.company_name || node.symbol}, ${formatRupees(node.last_price)}, ${node.percent_change == null ? "change unavailable" : `${Number(node.percent_change).toFixed(2)} percent change`}. Drag to reposition; click to show the price graph.`}
                  onMouseEnter={() => showGraphPopover(node)}
                  onFocus={() => showGraphPopover(node)}
                  onPointerDown={(event) => startGraphNodeDrag(event, node)}
                  onPointerMove={(event) => moveGraphNode(event, node)}
                  onPointerUp={finishGraphNodeDrag}
                  onPointerCancel={finishGraphNodeDrag}
                  onLostPointerCapture={finishGraphNodeDrag}
                  onBlur={(event) => {
                    if (!event.currentTarget.closest(".market-watch-graph-wrap")?.contains(event.relatedTarget)) {
                      closeGraphHover();
                    }
                  }}
                  onClick={(event) => handleGraphNodeClick(node, event)}
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
          {activeGraphNode && activeGraphQuote && !draggingGraphSymbol && (
            <StockDetailsPopover
              stock={activeGraphNode}
              quote={activeGraphQuote}
              tone={activeGraphTone}
              details={activeGraphDetails}
              updatedAt={activeGraphUpdatedAt}
              loading={activeGraphLoading}
              error={activeGraphError}
              chartType={chartType}
              onChartTypeChange={(type) => handleChartTypeChange(type, activeGraphNode)}
              className={activeGraphPopoverPosition}
              onClose={closeGraphPopover}
              onViewDetails={onUseSymbol}
            />
          )}
        </div>
      )}
      <div className="market-watch-footer">
        <span>{filteredRows.length ? `Showing ${visibleRows.length} of ${filteredRows.length} stocks` : "0 stocks"}</span>
        <span>{hasMoreRows
          ? viewFormat === "table" ? "Scroll inside the table to load more" : "Switch to Table to load more stocks"
          : "All matching stocks loaded"}</span>
      </div>
      <p className="market-watch-disclaimer">NIFTY 500 covers 500 major NSE stocks, not every listed Indian stock. Refreshes provide the latest available NSE snapshot; updates can be delayed or unavailable outside market hours.</p>
    </section>
  );
}
