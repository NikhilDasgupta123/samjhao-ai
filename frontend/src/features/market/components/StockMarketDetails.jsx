import { formatIndiaDateTime } from "../../../lib/formatters.js";
import { StockDetailsTable } from "./StockDetailsTable.jsx";
import { StockPriceChart } from "./StockPriceChart.jsx";
import { StockCatalystPanel } from "./StockCatalystPanel.jsx";

export function StockMarketDetails({ data, onUnauthorized }) {
  return (
    <section className="market-details-view" aria-labelledby="stock-details-title" aria-live="polite">
      <div className="results-topline">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> NSE MARKET DATA · INDIA</div>
          <h2 id="stock-details-title">{data.quote.company_name || data.symbol} <span>({data.symbol})</span></h2>
        </div>
        <div className="analyzed-file stock-data-source">
          <span className="stock-source-dot" />
          <span>{data.quote.source || "NSE data"} · Latest available</span>
        </div>
      </div>
      <p className="market-retrieved-at">Data retrieved {formatIndiaDateTime(data.retrieved_at)}. Quote timestamp: {data.quote.data_as_of || "not supplied by NSE source"}.</p>
      <section className="portal-card market-data-card">
        <div className="portal-panel-heading">
          <div><h2>Stock details</h2><p>Latest quote fields returned by the NSE data source.</p></div>
        </div>
        <StockDetailsTable quote={data.quote} />
      </section>
      <section className="portal-card market-data-card">
        <div className="portal-panel-heading">
          <div><h2>Price trend</h2><p>Recent daily closing prices. The chart uses NSE trading dates.</p></div>
        </div>
        <StockPriceChart history={data.history} />
      </section>
      <StockCatalystPanel data={data} onUnauthorized={onUnauthorized} />
      <p className="analysis-disclaimer">Market prices and history reflect the latest data returned by the source and may not update while the market is closed.</p>
    </section>
  );
}
