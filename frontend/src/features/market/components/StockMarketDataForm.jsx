import { ArrowIcon } from "../../../components/icons.jsx";

export function StockMarketDataForm({ symbol, setSymbol, onSubmit, isLoading }) {
  return (
    <section className="portal-card stock-query-card">
      <div className="portal-panel-heading">
        <div>
          <h2>Latest NSE stock details</h2>
          <p>View the latest available market snapshot and recent closing-price trend.</p>
        </div>
        <span className="stock-query-badge"><i /> NSE · India</span>
      </div>
      <form className="stock-query-form" onSubmit={onSubmit}>
        <label>
          Stock symbol
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="RELIANCE"
            pattern="[A-Za-z0-9][A-Za-z0-9.&-]{0,29}([.]NS)?"
            maxLength={33}
            required
          />
        </label>
        <button className="analyze-button stock-query-submit" type="submit" disabled={isLoading}>
          {isLoading ? "Loading market data…" : "Get stock details"} {!isLoading && <ArrowIcon />}
        </button>
      </form>
      <p className="stock-query-note">NSE timestamps use India Standard Time. Outside market hours, the latest available quote may be from the previous session.</p>
    </section>
  );
}
