import { formatActivityTime, formatRupees } from "../../../lib/formatters.js";

export function ActivityFeed({
  stocks,
  onReview,
  onViewStocks,
  compact = false,
  emptyTitle = "No stocks viewed yet",
  emptyMessage = "Look up an NSE symbol to see its latest available market data here.",
  showViewStocks = true,
}) {
  return (
    <section className={`portal-card activity-card ${compact ? "activity-card-compact" : ""}`}>
      <div className="portal-panel-heading">
        <div>
          <h2>Recently viewed</h2>
          <p>Stock details checked from NSE data</p>
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
                <p>
                  {stock.result.quote.company_name || stock.symbol}
                  {stock.result.quote.last_price == null ? "" : ` · ${formatRupees(stock.result.quote.last_price)}`}
                  {stock.result.quote.percent_change == null ? "" : ` · ${stock.result.quote.percent_change > 0 ? "+" : ""}${stock.result.quote.percent_change.toFixed(2)}%`}
                </p>
                <time dateTime={stock.processedAt}>{formatActivityTime(stock.processedAt)}</time>
              </div>
              <button className="activity-open" type="button" onClick={() => onReview(stock)}>View</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="portal-empty-state">
          <span className="empty-stock-icon" aria-hidden="true">↗</span>
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
          {showViewStocks && <button className="text-action" type="button" onClick={onViewStocks}>View a stock <span aria-hidden="true">→</span></button>}
        </div>
      )}
    </section>
  );
}
