import { ArrowIcon } from "../../../components/icons.jsx";
import { formatRupees, formatIndiaDateTime, formatMarketVolume } from "../../../lib/formatters.js";
import { MiniStockChart } from "./MiniStockChart.jsx";

export function StockDetailsPopover({
  stock,
  quote,
  tone,
  details,
  updatedAt,
  loading,
  error,
  chartType,
  onChartTypeChange,
  emptyHistoryCaption = "Session move · click the node for a 30-day graph",
  className = "",
  style,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onViewDetails,
}) {
  return (
    <aside
      className={`market-watch-stock-popover ${tone} ${className}`.trim()}
      style={style}
      aria-label={`${stock.company_name || stock.symbol} stock details`}
      aria-live="polite"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="market-watch-popover-heading">
        <div>
          <strong>{stock.company_name || stock.symbol}</strong>
          <span>{stock.symbol} · NSE</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close stock details">×</button>
      </div>
      <div className="market-watch-popover-price-row">
        <strong>{formatRupees(quote.last_price)}</strong>
        <span className={`market-watch-popover-change ${tone}`}>
          {quote.change == null ? "—" : `${Number(quote.change) > 0 ? "+" : Number(quote.change) < 0 ? "-" : ""}${formatRupees(Math.abs(Number(quote.change)))}`}
          {quote.percent_change == null ? "" : ` (${Number(quote.percent_change) > 0 ? "+" : ""}${Number(quote.percent_change).toFixed(2)}%)`}
        </span>
      </div>
      <div className="market-watch-popover-metrics">
        <span>Previous close <strong>{formatRupees(quote.previous_close)}</strong></span>
        <span>Volume <strong>{formatMarketVolume(stock.volume)}</strong></span>
      </div>
      <div className="market-watch-chart-toolbar" role="group" aria-label="Stock chart type">
        {[["line", "Line"], ["area", "Area"], ["candlestick", "Candles"]].map(([type, label]) => (
          <button
            key={type}
            type="button"
            className={chartType === type ? "active" : ""}
            aria-pressed={chartType === type}
            onClick={() => onChartTypeChange(type)}
          >
            {label}
          </button>
        ))}
      </div>
      <MiniStockChart
        history={details?.history || []}
        previousClose={quote.previous_close}
        currentPrice={quote.last_price}
        chartType={chartType}
        loading={loading}
      />
      <p className="market-watch-popover-caption">
        {details ? "Recent closing prices · 30 sessions" : emptyHistoryCaption}
        {updatedAt && ` · ${formatIndiaDateTime(updatedAt)}`}
      </p>
      {loading && <p className="market-watch-popover-status">Loading price history…</p>}
      {error && <p className="market-watch-popover-error" role="status">{error}</p>}
      <button className="market-watch-popover-link" type="button" onClick={() => onViewDetails(stock.symbol)}>
        View full stock details <ArrowIcon />
      </button>
    </aside>
  );
}
