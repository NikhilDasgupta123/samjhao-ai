export function DashboardStat({ icon, label, value, detail, tone }) {
  return (
    <article className={`dashboard-stat ${tone}`}>
      <span className="dashboard-stat-icon" aria-hidden="true">{icon}</span>
      <span className="dashboard-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="dashboard-stat-detail">{detail}</span>
    </article>
  );
}
