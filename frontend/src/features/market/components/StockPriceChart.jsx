import { useRef, useState } from "react";
import { formatRupees, formatHistoryDate } from "../../../lib/formatters.js";
import { CatalystSourceThumbnail } from "./CatalystSourceThumbnail.jsx";

const CHART_TYPES = [
  ["line", "Line"],
  ["area", "Area"],
  ["candles", "Candles"],
];

function catalystDateKey(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const exactDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (exactDate) return exactDate[1];

  const relativeDate = raw.match(/(\d+)\s+(day|week|month)s?\s+ago/i);
  let date = new Date(raw);
  if (relativeDate) {
    const amount = Number(relativeDate[1]);
    const unit = relativeDate[2].toLowerCase();
    const days = unit === "week" ? amount * 7 : unit === "month" ? amount * 30 : amount;
    date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  } else if (/^yesterday$/i.test(raw)) {
    date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else if (/^today$/i.test(raw)) {
    date = new Date();
  }
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${part.year}-${part.month}-${part.day}`;
}

function catalystDateDistance(sourceDate, sessionDate) {
  const sourceKey = catalystDateKey(sourceDate);
  const sessionKey = catalystDateKey(sessionDate);
  if (!sourceKey || !sessionKey) return null;
  return Math.round((Date.parse(`${sourceKey}T00:00:00Z`) - Date.parse(`${sessionKey}T00:00:00Z`)) / 86_400_000);
}

function formatCatalystDate(value) {
  const dateKey = catalystDateKey(value);
  if (!dateKey) return "Date not supplied";
  return formatHistoryDate(dateKey);
}

export function StockPriceChart({ history = [], catalysts = [], catalystFactors = [], catalystLoading = false, catalystError = "" }) {
  const [activePointIndex, setActivePointIndex] = useState(null);
  const [chartType, setChartType] = useState("line");
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const chartSvgRef = useRef(null);
  const chartDisplayRef = useRef(null);
  const points = history.filter((point) => point.close != null && Number.isFinite(Number(point.close)));
  if (!points.length) {
    return <p className="market-chart-empty">No closing-price history was returned for this symbol.</p>;
  }

  const candles = points.filter((point) => [point.open, point.high, point.low].every(
    (value) => value != null && Number.isFinite(Number(value)),
  ));
  const chartData = chartType === "candles" ? candles : points;
  const width = 900;
  const height = 310;
  const left = 72;
  const right = 22;
  const top = 20;
  const bottom = 45;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const rangeValues = chartType === "candles"
    ? chartData.flatMap((point) => [Number(point.low), Number(point.high)])
    : chartData.map((point) => Number(point.close));
  const minValue = rangeValues.length ? Math.min(...rangeValues) : 0;
  const maxValue = rangeValues.length ? Math.max(...rangeValues) : 0;
  const spread = maxValue - minValue || Math.max(Math.abs(maxValue) * 0.02, 1);
  const chartMin = minValue - spread * 0.12;
  const chartMax = maxValue + spread * 0.12;
  const chartPoints = chartData.map((point, index) => {
    const x = chartData.length === 1 ? left + plotWidth / 2 : left + (index / (chartData.length - 1)) * plotWidth;
    const yForPrice = (price) => top + ((chartMax - Number(price)) / (chartMax - chartMin)) * plotHeight;
    return {
      ...point,
      x,
      y: yForPrice(point.close),
      yOpen: chartType === "candles" ? yForPrice(point.open) : null,
      yHigh: chartType === "candles" ? yForPrice(point.high) : null,
      yLow: chartType === "candles" ? yForPrice(point.low) : null,
    };
  });
  const linePath = chartPoints.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const areaPath = chartPoints.length
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${top + plotHeight} L ${chartPoints[0].x} ${top + plotHeight} Z`
    : "";
  const gridValues = Array.from({ length: 4 }, (_, index) => chartMax - ((chartMax - chartMin) * index) / 3);
  const labelIndexes = [...new Set([0, Math.floor((chartPoints.length - 1) / 2), chartPoints.length - 1])];
  const closeValues = chartData.map((point) => Number(point.close));
  const isUp = closeValues[closeValues.length - 1] >= closeValues[0];
  const stroke = isUp ? "#21824c" : "#b34e47";
  const activePoint = activePointIndex == null ? null : chartPoints[activePointIndex];
  const matchedSources = activePoint
    ? catalysts
      .map((source) => ({ source, distance: catalystDateDistance(source.published_at, activePoint.date) }))
      .filter(({ distance }) => distance != null && distance >= -2 && distance <= 0)
      .sort((first, second) => second.distance - first.distance)
    : [];
  const undatedFallbackSources = [
    ...catalysts.filter((source) => source.kind !== "video").slice(0, 1),
    ...catalysts.filter((source) => source.kind === "video").slice(0, 1),
  ].slice(0, 2);
  const visibleSources = matchedSources.length
    ? matchedSources.slice(0, 2)
    : undatedFallbackSources.map((source) => ({
      source,
      distance: catalystDateDistance(source.published_at, activePoint?.date),
    }));
  const showingFallbackSources = !matchedSources.length && visibleSources.length > 0;
  const visibleSourceIds = new Set(visibleSources.map(({ source }) => source.id));
  const relatedFactors = catalystFactors
    .filter((factor) => factor.source_ids?.some((sourceId) => visibleSourceIds.has(sourceId)))
    .slice(0, 2);
  const catalystPopoverWidth = hoverAnchor ? Math.max(0, Math.min(360, hoverAnchor.displayWidth - 16)) : 0;
  const catalystPopoverHeight = 140 + visibleSources.length * 62 + relatedFactors.length * 40;
  const catalystPopoverLeft = hoverAnchor
    ? Math.max(8, Math.min(hoverAnchor.x - catalystPopoverWidth / 2, hoverAnchor.displayWidth - catalystPopoverWidth - 8))
    : 0;
  const catalystPopoverTop = hoverAnchor
    ? Math.max(8, Math.min(
      hoverAnchor.y >= catalystPopoverHeight + 12 ? hoverAnchor.y - catalystPopoverHeight - 12 : hoverAnchor.y + 12,
      hoverAnchor.displayHeight - catalystPopoverHeight - 8,
    ))
    : 0;
  const chartControls = (
    <div className="market-chart-type-controls" role="group" aria-label="Price chart type">
      {CHART_TYPES.map(([type, label]) => (
        <button
          key={type}
          type="button"
          className={chartType === type ? "active" : ""}
          aria-pressed={chartType === type}
          disabled={type === "candles" && !candles.length}
          title={type === "candles" && !candles.length ? "Candles need open, high and low price data." : undefined}
          onClick={() => {
            setChartType(type);
            setActivePointIndex(null);
            setHoverAnchor(null);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  function handleChartPointerMove(event) {
    const svgBounds = chartSvgRef.current?.getBoundingClientRect();
    const displayBounds = chartDisplayRef.current?.getBoundingClientRect();
    if (!svgBounds?.width || !svgBounds.height || !displayBounds) return;
    const x = ((event.clientX - svgBounds.left) / svgBounds.width) * width;
    const y = ((event.clientY - svgBounds.top) / svgBounds.height) * height;
    if (x < left || x > width - right || y < top || y > height - bottom) {
      setActivePointIndex(null);
      setHoverAnchor(null);
      return;
    }
    const index = chartPoints.length === 1
      ? 0
      : Math.max(0, Math.min(chartPoints.length - 1, Math.round(((x - left) / plotWidth) * (chartPoints.length - 1))));
    setActivePointIndex((currentIndex) => currentIndex === index ? currentIndex : index);
    setHoverAnchor((currentAnchor) => currentAnchor?.index === index ? currentAnchor : {
      index,
      x: svgBounds.left - displayBounds.left + (chartPoints[index].x / width) * svgBounds.width,
      y: svgBounds.top - displayBounds.top + (chartPoints[index].y / height) * svgBounds.height,
      displayWidth: displayBounds.width,
      displayHeight: displayBounds.height,
    });
  }

  if (!chartPoints.length) {
    return (
      <div className="market-chart-wrap">
        {chartControls}
        <p className="market-chart-empty">Candles need daily open, high, low and close data.</p>
      </div>
    );
  }

  const candleSlotWidth = plotWidth / chartPoints.length;
  const candleWidth = Math.max(3, Math.min(16, candleSlotWidth * 0.58));

  return (
    <div className="market-chart-wrap">
      {chartControls}
      <div
        className="market-chart-display"
        ref={chartDisplayRef}
        onPointerMove={handleChartPointerMove}
        onPointerLeave={() => {
          setActivePointIndex(null);
          setHoverAnchor(null);
        }}
      >
        <svg
          ref={chartSvgRef}
          className={`stock-price-chart ${chartType}`}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`NSE daily ${chartType === "candles" ? "candlestick" : chartType} prices over recent trading sessions. Hover over the chart to see price data and related coverage.`}
        >
        {chartType === "area" && (
          <defs>
            <linearGradient id="stock-price-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity=".18" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {gridValues.map((value, index) => {
          const y = top + (plotHeight * index) / 3;
          return (
            <g key={index}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="market-price-gridline" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="market-price-axis-label">{formatRupees(value, { notation: "compact", maximumFractionDigits: 1 })}</text>
            </g>
          );
        })}
        {chartType === "area" && <path d={areaPath} fill="url(#stock-price-fill)" />}
        {chartType !== "candles" && (
          <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
        {chartType === "candles" && chartPoints.map((point) => {
          const open = Number(point.open);
          const close = Number(point.close);
          const color = close >= open ? "#21824c" : "#b34e47";
          const bodyTop = Math.min(point.yOpen, point.y);
          const bodyHeight = Math.max(2, Math.abs(point.yOpen - point.y));
          return (
            <g key={point.date} style={{ color }}>
              <line x1={point.x} x2={point.x} y1={point.yHigh} y2={point.yLow} stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              <rect x={point.x - candleWidth / 2} y={bodyTop - (bodyHeight === 2 ? 1 : 0)} width={candleWidth} height={bodyHeight} rx="1" fill={color} />
            </g>
          );
        })}
        {chartType !== "candles" && chartPoints.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r={point === activePoint ? "5" : "2.5"} fill="#fff" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        ))}
        {activePoint && <line className="market-price-crosshair" x1={activePoint.x} x2={activePoint.x} y1={top} y2={top + plotHeight} />}
        {chartType === "candles" && activePoint && (
          <circle cx={activePoint.x} cy={activePoint.y} r="4" fill="#fff" stroke={Number(activePoint.close) >= Number(activePoint.open) ? "#21824c" : "#b34e47"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        )}
        {labelIndexes.map((index) => {
          const point = chartPoints[index];
          return <text key={`${point.date}-label`} x={point.x} y={height - 13} textAnchor={index === 0 ? "start" : index === chartPoints.length - 1 ? "end" : "middle"} className="market-price-axis-label">{formatHistoryDate(point.date, { short: true })}</text>;
        })}
        </svg>
        {activePoint && hoverAnchor && (
          <aside
            className="market-chart-catalyst-popover"
            style={{ left: catalystPopoverLeft, top: catalystPopoverTop, width: catalystPopoverWidth }}
            aria-label={`Price and related coverage for ${formatHistoryDate(activePoint.date)}`}
            onPointerMove={(event) => event.stopPropagation()}
          >
            <div className="market-chart-catalyst-heading">
              <div>
                <span>PRICE SESSION</span>
                <strong>{formatHistoryDate(activePoint.date)}</strong>
              </div>
              <strong className="market-chart-catalyst-price">
                {chartType === "candles" ? `O ${formatRupees(activePoint.open)} · H ${formatRupees(activePoint.high)} · L ${formatRupees(activePoint.low)} · C ${formatRupees(activePoint.close)}` : `Close · ${formatRupees(activePoint.close)}`}
              </strong>
            </div>
            {!!relatedFactors.length && (
              <div className="market-chart-catalyst-factors">
                {relatedFactors.map((factor, index) => (
                  <div key={`${factor.topic}-${index}`}>
                    <span className={`is-${factor.direction}`}>{factor.direction} · {factor.topic}</span>
                    <p>{factor.explanation}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="market-chart-catalyst-results">
              {showingFallbackSources && <p className="market-chart-catalyst-fallback">No source date matched this session; showing recent stock coverage instead.</p>}
              {visibleSources.map(({ source, distance }) => (
                <a className="market-chart-catalyst-source" href={source.url} target="_blank" rel="noopener noreferrer" key={source.id}>
                  <CatalystSourceThumbnail source={source} className={`market-chart-catalyst-thumb is-${source.kind}`} />
                  <span className="market-chart-catalyst-copy">
                    <span className="market-chart-catalyst-kind">{source.kind === "video" ? "VIDEO" : source.kind === "news" ? "NEWS / BLOG" : "WEB / BLOG"}</span>
                    <strong>{source.title}</strong>
                    <small>
                      {source.publisher || "Source"} · {formatCatalystDate(source.published_at)}
                      {distance == null ? " · not date-matched" : distance < 0 ? ` · ${Math.abs(distance)}d before` : distance > 0 ? ` · ${distance}d after` : " · session day"}
                    </small>
                  </span>
                </a>
              ))}
              {!visibleSources.length && catalystLoading && <p>Searching recent coverage…</p>}
              {!visibleSources.length && !catalystLoading && catalystError && <p>{catalystError}</p>}
              {!visibleSources.length && !catalystLoading && !catalystError && <p>No source links were returned for this stock.</p>}
            </div>
            {catalysts.length > visibleSources.length && <a className="market-chart-catalyst-all" href="#stock-catalyst-title">See all {catalysts.length} source links</a>}
            <small className="market-chart-catalyst-note">
              {showingFallbackSources
                ? "These links were not matched to this session; check their dates before connecting them to its price move."
                : "Coverage from this day or the two prior days may provide context; it does not confirm why the price moved."}
            </small>
          </aside>
        )}
      </div>
      <p className="market-chart-caption">{chartType === "candles" ? "Daily OHLC prices" : "Daily closing price"} · {chartPoints.length} recent NSE trading {chartPoints.length === 1 ? "session" : "sessions"}</p>
    </div>
  );
}
