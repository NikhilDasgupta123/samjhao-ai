export function MiniStockChart({ history = [], previousClose, currentPrice }) {
  const closes = history
    .filter((point) => point.close != null && Number.isFinite(Number(point.close)))
    .map((point) => Number(point.close));
  const values = closes.length ? closes : [previousClose, currentPrice]
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map(Number);
  if (!values.length) return <p className="market-watch-popover-no-chart">No price trend available.</p>;

  const width = 260;
  const height = 64;
  const padding = 5;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.01, 1);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * (width - padding * 2),
    y: padding + ((maximum + spread * 0.12 - value) / (spread * 1.24)) * (height - padding * 2),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const isUp = values[values.length - 1] >= values[0];
  const latest = points[points.length - 1];

  return (
    <svg className={`market-watch-mini-chart ${isUp ? "positive" : "negative"}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent stock price trend">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} />
      <path d={path} />
      <circle cx={latest.x} cy={latest.y} r="3" />
    </svg>
  );
}
