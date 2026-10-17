import { ArrowIcon } from "../../../components/icons.jsx";

export function MarketPreview({ authReady, currentUser, onEnter }) {
  return (
    <section className="market-preview" aria-label="Indian stock market dashboard preview">
      <div className="market-preview-topline">
        <span><i /> NSE STOCKS</span>
        <span>MARKET DATA</span>
      </div>
      <div className="market-preview-title">
        <div>
          <span className="market-preview-kicker">LATEST NSE STOCK DATA</span>
          <strong>Quote and price trend</strong>
        </div>
        <span className="market-preview-spark" aria-hidden="true">↗</span>
      </div>
      <div className="market-preview-chart" aria-hidden="true">
        <div className="market-chart-grid"><i /><i /><i /></div>
        <svg viewBox="0 0 420 150" preserveAspectRatio="none">
          <defs>
            <linearGradient id="market-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#65e6a3" stopOpacity=".25" />
              <stop offset="100%" stopColor="#65e6a3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="market-chart-area" d="M0 118 L42 103 L78 109 L117 76 L153 88 L194 52 L229 66 L267 38 L302 56 L343 23 L378 35 L420 12 L420 150 L0 150 Z" />
          <path className="market-chart-line" d="M0 118 L42 103 L78 109 L117 76 L153 88 L194 52 L229 66 L267 38 L302 56 L343 23 L378 35 L420 12" />
          {[42, 117, 194, 267, 343, 420].map((x, index) => {
            const y = [103, 76, 52, 38, 23, 12][index];
            return <circle key={x} cx={x} cy={y} r="3.5" className="market-chart-point" />;
          })}
        </svg>
        <div className="market-chart-axis"><span>NSE DATA</span><span>PRICE TREND</span><span>IST</span></div>
      </div>
      <div className="market-preview-footer">
        <span><i className="preview-dot preview-dot-green" /> Latest quote</span>
        <span><i className="preview-dot preview-dot-lime" /> Daily trend</span>
      </div>
      <button className="analyze-button market-preview-button" type="button" disabled={!authReady} onClick={onEnter}>
        {authReady ? (currentUser ? "Open market dashboard" : "Get started") : "Loading…"} <ArrowIcon />
      </button>
      <p className="market-preview-note">Illustrative preview · NSE data via jugaad-data MCP</p>
    </section>
  );
}
