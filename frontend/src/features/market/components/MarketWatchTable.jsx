import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SearchIcon } from "../../../components/icons.jsx";
import { formatRupees, formatIndiaDateTime, formatMarketVolume } from "../../../lib/formatters.js";
import { getMarketWatch, getStockMarketData } from "../api/marketService.js";
import { StockDetailsPopover } from "./StockDetailsPopover.jsx";

export function MarketWatchTable({ onUseSymbol, onUnauthorized }) {
  const [marketWatch, setMarketWatch] = useState(null);
  const [marketWatchError, setMarketWatchError] = useState("");
  const [isMarketWatchLoading, setIsMarketWatchLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [chartType, setChartType] = useState("line");
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(null);
  const [selectedStockDetails, setSelectedStockDetails] = useState(null);
  const [stockDetailsLoading, setStockDetailsLoading] = useState(false);
  const [stockDetailsError, setStockDetailsError] = useState("");
  const [hoveredTableSymbol, setHoveredTableSymbol] = useState(null);
  const [tablePopoverPosition, setTablePopoverPosition] = useState(null);
  const stockDetailsController = useRef(null);
  const tablePopoverTimer = useRef(null);
  const historyLoadTimer = useRef(null);
  const previousMarketData = useRef(new Map());
  const priceFlashTimer = useRef(null);
  const tableWrapRef = useRef(null);
  const tablePopoverRef = useRef(null);
  const paginationSentinelRef = useRef(null);
  const [rowUpdates, setRowUpdates] = useState({});
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
      stockDetailsController.current?.abort();
    };
  }, [onUnauthorized]);

  useEffect(() => {
    if (!marketWatch?.rows) return undefined;

    const nextMarketData = new Map();
    const changedRows = {};
    const changedAt = Date.now();
    for (const row of marketWatch.rows) {
      const price = Number(row.last_price);
      const change = row.change == null ? null : Number(row.change);
      const percentChange = row.percent_change == null ? null : Number(row.percent_change);
      const volume = row.volume == null ? null : Number(row.volume);
      const previousClose = row.previous_close == null ? null : Number(row.previous_close);
      const currentData = {
        companyName: row.company_name ?? null,
        price: Number.isFinite(price) ? price : null,
        change: Number.isFinite(change) ? change : null,
        percentChange: Number.isFinite(percentChange) ? percentChange : null,
        previousClose: Number.isFinite(previousClose) ? previousClose : null,
        volume: Number.isFinite(volume) ? volume : null,
      };
      const previousData = previousMarketData.current.get(row.symbol);

      if (previousData) {
        const rowChanged = Object.keys(currentData).some((field) => currentData[field] !== previousData[field]);
        const priceChanged = currentData.price !== previousData.price
          && currentData.price != null
          && previousData.price != null;
        const changeValueChanged = currentData.change !== previousData.change;
        const percentChangeValueChanged = currentData.percentChange !== previousData.percentChange;
        const volumeChanged = currentData.volume !== previousData.volume;

        if (rowChanged) {
          const currentMove = currentData.change ?? currentData.percentChange ?? 0;
          let isMovingUp;
          if (priceChanged) {
            isMovingUp = currentData.price > previousData.price;
          } else if (changeValueChanged && currentData.change != null && previousData.change != null) {
            isMovingUp = currentData.change > previousData.change;
          } else if (percentChangeValueChanged && currentData.percentChange != null && previousData.percentChange != null) {
            isMovingUp = currentData.percentChange > previousData.percentChange;
          } else if (currentData.previousClose !== previousData.previousClose
            && currentData.previousClose != null
            && previousData.previousClose != null) {
            isMovingUp = currentData.previousClose < previousData.previousClose;
          } else {
            isMovingUp = currentMove === 0
              ? volumeChanged
                ? currentData.volume >= (previousData.volume ?? 0)
                : currentData.price >= (previousData.price ?? 0)
              : currentMove > 0;
          }

          changedRows[row.symbol] = {
            direction: isMovingUp ? "up" : "down",
            changedAt,
            expiresAt: changedAt + 5_000,
          };
        }
      }
      nextMarketData.set(row.symbol, currentData);
    }
    previousMarketData.current = nextMarketData;
    if (Object.keys(changedRows).length) {
      setRowUpdates((updates) => ({ ...updates, ...changedRows }));
    }
  }, [marketWatch]);

  useEffect(() => {
    window.clearTimeout(priceFlashTimer.current);
    const nextExpiry = Object.values(rowUpdates)
      .filter((update) => update.direction)
      .reduce((earliest, update) => Math.min(earliest, update.expiresAt), Infinity);
    if (!Number.isFinite(nextExpiry)) return undefined;

    priceFlashTimer.current = window.setTimeout(() => {
      const now = Date.now();
      setRowUpdates((updates) => {
        let hasExpiredUpdate = false;
        const nextUpdates = Object.fromEntries(Object.entries(updates).map(([symbol, update]) => {
          if (update.direction && update.expiresAt <= now) {
            hasExpiredUpdate = true;
            return [symbol, { ...update, direction: null }];
          }
          return [symbol, update];
        }));
        return hasExpiredUpdate ? nextUpdates : updates;
      });
    }, Math.max(0, nextExpiry - Date.now()));

    return () => window.clearTimeout(priceFlashTimer.current);
  }, [rowUpdates]);

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
  const sortedRows = [...filteredRows].sort((a, b) => (
    (rowUpdates[b.symbol]?.changedAt || 0) - (rowUpdates[a.symbol]?.changedAt || 0)
  ));
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = sortedRows.slice(0, (page + 1) * pageSize);
  const hasMoreRows = visibleRows.length < filteredRows.length;

  useEffect(() => {
    if (!hasMoreRows) return undefined;
    const root = tableWrapRef.current;
    const sentinel = paginationSentinelRef.current;
    if (!root || !sentinel) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setPage((currentPage) => Math.min(pageCount - 1, currentPage + 1));
    }, { root, rootMargin: "0px 0px 100px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreRows, pageCount, visibleRows.length]);
  const activeStock = filteredRows.find((row) => row.symbol === hoveredTableSymbol) || null;
  const activeStockDetails = selectedStockSymbol === activeStock?.symbol ? selectedStockDetails : null;
  const activeStockQuote = activeStockDetails?.quote || activeStock;
  const activeStockTone = activeStockQuote?.percent_change > 0
    ? "positive"
    : activeStockQuote?.percent_change < 0 ? "negative" : "flat";
  const activeStockLoading = selectedStockSymbol === activeStock?.symbol && stockDetailsLoading;
  const activeStockError = selectedStockSymbol === activeStock?.symbol ? stockDetailsError : "";
  const activeStockUpdatedAt = activeStockDetails?.retrieved_at
    || activeStockQuote?.data_as_of
    || activeStock?.updated_at
    || marketWatch?.retrieved_at;

  useLayoutEffect(() => {
    if (!tablePopoverPosition || !tablePopoverRef.current) return undefined;

    function keepPopoverInViewport() {
      const bounds = tablePopoverRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const left = Math.max(12, Math.min(tablePopoverPosition.left, window.innerWidth - bounds.width - 12));
      const top = Math.max(12, Math.min(tablePopoverPosition.top, window.innerHeight - bounds.height - 12));
      if (Math.abs(left - tablePopoverPosition.left) > 1 || Math.abs(top - tablePopoverPosition.top) > 1) {
        setTablePopoverPosition({ top, left });
      }
    }

    keepPopoverInViewport();
    window.addEventListener("resize", keepPopoverInViewport);
    return () => window.removeEventListener("resize", keepPopoverInViewport);
  }, [activeStock?.symbol, activeStockDetails, activeStockError, activeStockLoading, activeStockUpdatedAt, tablePopoverPosition]);

  function closeStockDetailsPopover() {
    stockDetailsController.current?.abort();
    stockDetailsController.current = null;
    window.clearTimeout(tablePopoverTimer.current);
    window.clearTimeout(historyLoadTimer.current);
    setHoveredTableSymbol(null);
    setTablePopoverPosition(null);
    setSelectedStockSymbol(null);
    setSelectedStockDetails(null);
    setStockDetailsError("");
    setStockDetailsLoading(false);
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

  async function loadStockHistory(row) {
    window.clearTimeout(historyLoadTimer.current);
    stockDetailsController.current?.abort();
    const requestController = new AbortController();
    stockDetailsController.current = requestController;
    setSelectedStockSymbol(row.symbol);
    setSelectedStockDetails(null);
    setStockDetailsError("");
    setStockDetailsLoading(true);
    try {
      const payload = await getStockMarketData({
        symbol: row.symbol,
        historyDays: 30,
        signal: requestController.signal,
      });
      setSelectedStockDetails(payload);
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      if (requestError.status === 401) onUnauthorized();
      else setStockDetailsError(requestError.message || "Stock details could not be loaded.");
    } finally {
      if (stockDetailsController.current === requestController) {
        stockDetailsController.current = null;
        setStockDetailsLoading(false);
      }
    }
  }

  function handleChartTypeChange(type, row) {
    setChartType(type);
    if (selectedStockSymbol !== row.symbol || !selectedStockDetails?.history?.length) {
      loadStockHistory(row);
    }
  }

  function scheduleStockHistoryLoad(row) {
    if (chartType !== "candlestick" || selectedStockSymbol === row.symbol) return;
    window.clearTimeout(historyLoadTimer.current);
    historyLoadTimer.current = window.setTimeout(() => loadStockHistory(row), 350);
  }

  return (
    <section className="portal-card market-watch-card">
      <div className="portal-panel-heading market-watch-heading">
        <div>
          <h2>India market watch</h2>
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
        </div>
        <span className="market-watch-note">Prices change when NSE publishes a new snapshot · not tick streaming</span>
      </div>
      {marketWatchError && <p className="market-watch-error" role="status">{marketWatchError}</p>}
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
              const priceFlash = rowUpdates[row.symbol]?.direction;
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
        {activeStock && activeStockQuote && tablePopoverPosition && (
          <StockDetailsPopover
            stock={activeStock}
            quote={activeStockQuote}
            tone={activeStockTone}
            details={activeStockDetails}
            updatedAt={activeStockUpdatedAt}
            loading={activeStockLoading}
            error={activeStockError}
            chartType={chartType}
            onChartTypeChange={(type) => handleChartTypeChange(type, activeStock)}
            emptyHistoryCaption="Session move · previous close vs latest price"
            className="is-table"
            style={{ top: tablePopoverPosition.top, left: tablePopoverPosition.left }}
            popoverRef={tablePopoverRef}
            onClose={closeStockDetailsPopover}
            onMouseEnter={() => window.clearTimeout(tablePopoverTimer.current)}
            onMouseLeave={scheduleTablePopoverClose}
            onViewDetails={onUseSymbol}
          />
        )}
      </div>
      <div className="market-watch-footer">
        <span>{filteredRows.length ? `Showing ${visibleRows.length} of ${filteredRows.length} stocks` : "0 stocks"}</span>
        <span>{hasMoreRows
          ? "Scroll inside the table to load more"
          : "All matching stocks loaded"}</span>
      </div>
      <p className="market-watch-disclaimer">NIFTY 500 covers 500 major NSE stocks, not every listed Indian stock. Refreshes provide the latest available NSE snapshot; updates can be delayed or unavailable outside market hours.</p>
    </section>
  );
}
