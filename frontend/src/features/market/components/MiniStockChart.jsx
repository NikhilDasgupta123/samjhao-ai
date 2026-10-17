import { formatHistoryDate, formatRupees } from "../../../lib/formatters.js";

const WIDTH = 260;
const HEIGHT = 88;

export function MiniStockChart({ history = [], previousClose, currentPrice, chartType = "line", loading = false }) {
  const closes = history
    .filter((point) => point.close != null && Number.isFinite(Number(point.close)))
    .map((point) => ({ ...point, close: Number(point.close) }));
  const values = closes.length ? closes : [previousClose, currentPrice]
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map((close) => ({ close: Number(close) }));

  if (chartType === "candlestick") {
    const candles = closes.filter((point) => [point.open, point.high, point.low].every(
      (value) => value != null && Number.isFinite(Number(value)),
    ));
    if (!candles.length) {
      return (
        <p className="market-watch-popover-no-chart">
          {loading ? "Loading daily OHLC history…" : "Candlestick view needs daily open, high, low and close data."}
        </p>
      );
    }

    const minimum = Math.min(...candles.map((point) => Number(point.low)));
    const maximum = Math.max(...candles.map((point) => Number(point.high)));
    const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.01, 1);
    const chartMinimum = minimum - spread * 0.06;
    const chartMaximum = maximum + spread * 0.06;
    const top = 5;
    const priceBottom = 63;
    const volumeBottom = 85;
    const plotHeight = priceBottom - top;
    const slotWidth = WIDTH / candles.length;
    const candleWidth = Math.max(2, Math.min(7, slotWidth * 0.58));
    const maxVolume = Math.max(...candles.map((point) => Number(point.volume) || 0), 1);
    const yForPrice = (price) => top + ((chartMaximum - Number(price)) / (chartMaximum - chartMinimum)) * plotHeight;
    const up = candles[candles.length - 1].close >= Number(candles[0].open);

    return (
      <svg className="market-watch-mini-chart candlestick" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="NSE daily candlestick price and volume chart">
        <line x1="0" x2={WIDTH} y1={priceBottom} y2={priceBottom} />
        <line x1="0" x2={WIDTH} y1={(top + priceBottom) / 2} y2={(top + priceBottom) / 2} />
        {candles.map((point, index) => {
          const open = Number(point.open);
          const close = Number(point.close);
          const high = Number(point.high);
          const low = Number(point.low);
          const isUp = close >= open;
          const x = (index + 0.5) * slotWidth;
          const bodyTop = Math.min(yForPrice(open), yForPrice(close));
          const bodyHeight = Math.max(1.5, Math.abs(yForPrice(open) - yForPrice(close)));
          const volume = Number(point.volume) || 0;
          const volumeHeight = volume ? Math.max(1, (volume / maxVolume) * 13) : 0;
          const color = isUp ? "#21824c" : "#b34e47";
          return (
            <g key={point.date || index} style={{ color }}>
              <line x1={x} x2={x} y1={yForPrice(high)} y2={yForPrice(low)} stroke={color} />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx=".5" />
              {volumeHeight > 0 && <rect className="market-watch-mini-volume" x={x - candleWidth / 2} y={volumeBottom - volumeHeight} width={candleWidth} height={volumeHeight} fill={color} />}
              <title>{`${formatHistoryDate(point.date)} · O ${formatRupees(open)} · H ${formatRupees(high)} · L ${formatRupees(low)} · C ${formatRupees(close)}${volume ? ` · Volume ${volume.toLocaleString("en-IN")}` : ""}`}</title>
            </g>
          );
        })}
        <text className="market-watch-mini-chart-label" x="2" y="87">VOL</text>
        <text className="market-watch-mini-chart-label" x={WIDTH - 2} y="87" textAnchor="end">{up ? "UP" : "DOWN"}</text>
      </svg>
    );
  }

  if (!values.length) return <p className="market-watch-popover-no-chart">No price trend available.</p>;

  const padding = 5;
  const minimum = Math.min(...values.map((point) => point.close));
  const maximum = Math.max(...values.map((point) => point.close));
  const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.01, 1);
  const chartMinimum = minimum - spread * 0.12;
  const chartMaximum = maximum + spread * 0.12;
  const points = values.map((point, index) => ({
    ...point,
    x: values.length === 1 ? WIDTH / 2 : padding + (index / (values.length - 1)) * (WIDTH - padding * 2),
    y: padding + ((chartMaximum - point.close) / (chartMaximum - chartMinimum)) * (HEIGHT - padding * 2),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${HEIGHT - padding} L ${points[0].x} ${HEIGHT - padding} Z`;
  const isUp = values[values.length - 1].close >= values[0].close;
  const tone = isUp ? "positive" : "negative";
  const latest = points[points.length - 1];

  return (
    <svg className={`market-watch-mini-chart ${tone} ${chartType}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Recent stock ${chartType} price trend`}>
      <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} />
      {chartType === "area" && <path className="market-watch-mini-area" d={areaPath} />}
      <path className="market-watch-mini-line" d={path} />
      <circle cx={latest.x} cy={latest.y} r="3" />
    </svg>
  );
}
