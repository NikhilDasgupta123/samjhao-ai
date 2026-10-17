export function ActivityChart({ stocks }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    return {
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: stocks.filter((stock) => {
        const processedDate = new Date(stock.processedAt);
        return processedDate.toDateString() === date.toDateString();
      }).length,
    };
  });
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  const points = days.map((day, index) => ({
    x: 14 + index * 48,
    y: 98 - (day.count / maxCount) * 68,
    ...day,
  }));
  const linePath = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} 114 L ${points[0].x} 114 Z`;

  return (
    <section className="portal-card insights-card" aria-labelledby="activity-chart-title">
      <div className="portal-panel-heading">
        <div>
          <h2 id="activity-chart-title">Lookup activity</h2>
          <p>Stock data checks · Last 7 days</p>
        </div>
        <span className="chart-total">{stocks.length}</span>
      </div>
      <svg className="activity-chart" viewBox="0 0 316 126" role="img" aria-label="Stock data lookups over the last seven days">
        <defs>
          <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3e8b80" stopOpacity=".2" />
            <stop offset="100%" stopColor="#3e8b80" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[26, 62, 98].map((y) => <line key={y} x1="10" x2="306" y1={y} y2={y} className="chart-gridline" />)}
        <path d={areaPath} fill="url(#activity-fill)" />
        <path d={linePath} className={`chart-line ${stocks.length ? "" : "chart-line-empty"}`} />
        {stocks.length > 0 && points.map((point) => (
          <circle key={point.date.toISOString()} cx={point.x} cy={point.y} r="3.5" className="chart-point" />
        ))}
      </svg>
      <div className="chart-day-labels">
        {points.map((point) => <span key={point.date.toISOString()}>{point.label}</span>)}
      </div>
      {!stocks.length && <p className="chart-empty-note">Your stock lookups will appear here.</p>}
    </section>
  );
}
