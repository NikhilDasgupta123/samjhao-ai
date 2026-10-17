import { formatRupees, formatHistoryDate } from "../../../lib/formatters.js";

export function StockPriceChart({ history = [] }) {
  const points = history.filter((point) => point.close != null && Number.isFinite(Number(point.close)));
  if (!points.length) {
    return <p className="market-chart-empty">No closing-price history was returned for this symbol.</p>;
  }

  const width = 900;
  const height = 310;
  const left = 72;
  const right = 22;
  const top = 20;
  const bottom = 45;
  const values = points.map((point) => Number(point.close));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = maxValue - minValue || Math.max(maxValue * 0.02, 1);
  const chartMin = minValue - spread * 0.12;
  const chartMax = maxValue + spread * 0.12;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const chartPoints = points.map((point, index) => ({
    x: points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth,
    y: top + ((chartMax - Number(point.close)) / (chartMax - chartMin)) * plotHeight,
    ...point,
  }));
  const linePath = chartPoints.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${top + plotHeight} L ${chartPoints[0].x} ${top + plotHeight} Z`;
  const gridValues = Array.from({ length: 4 }, (_, index) => chartMax - ((chartMax - chartMin) * index) / 3);
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const isUp = values[values.length - 1] >= values[0];
  const stroke = isUp ? "#21824c" : "#b34e47";

  return (
    <div className="market-chart-wrap">
      <svg className="stock-price-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="NSE daily closing prices over recent trading sessions">
        <defs>
          <linearGradient id="stock-price-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity=".16" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridValues.map((value, index) => {
          const y = top + (plotHeight * index) / 3;
          return (
            <g key={index}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="market-price-gridline" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="market-price-axis-label">{formatRupees(value, { notation: "compact", maximumFractionDigits: 1 })}</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#stock-price-fill)" />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {chartPoints.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="2.5" fill="#fff" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke">
            <title>{`${formatHistoryDate(point.date)} · ${formatRupees(point.close)}`}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => {
          const point = chartPoints[index];
          return <text key={`${point.date}-label`} x={point.x} y={height - 13} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="market-price-axis-label">{formatHistoryDate(point.date, { short: true })}</text>;
        })}
      </svg>
      <p className="market-chart-caption">Daily closing price · {points.length} recent NSE trading {points.length === 1 ? "session" : "sessions"}</p>
    </div>
  );
}
