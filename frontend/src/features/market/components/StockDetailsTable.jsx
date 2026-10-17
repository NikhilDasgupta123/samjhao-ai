import { formatRupees } from "../../../lib/formatters.js";

export function StockDetailsTable({ quote }) {
  const changeValue = quote?.percent_change;
  const changeTone = changeValue > 0 ? "market-positive" : changeValue < 0 ? "market-negative" : "";
  const rows = [
    ["Company", quote?.company_name || "—"],
    ["NSE symbol", quote?.symbol || "—"],
    ["Last traded price", formatRupees(quote?.last_price)],
    ["Change", quote?.change == null ? "—" : `${formatRupees(quote.change)}${changeValue == null ? "" : ` (${changeValue.toFixed(2)}%)`}`],
    ["Previous close", formatRupees(quote?.previous_close)],
    ["Open", formatRupees(quote?.open)],
    ["Day high", formatRupees(quote?.day_high)],
    ["Day low", formatRupees(quote?.day_low)],
    ["VWAP", formatRupees(quote?.vwap)],
    ["52-week high", formatRupees(quote?.week_high)],
    ["52-week low", formatRupees(quote?.week_low)],
    ["NSE quote timestamp", quote?.data_as_of || "Not provided by source"],
  ];

  return (
    <div className="market-table-wrap">
      <table className="market-data-table">
        <thead><tr><th scope="col">Stock detail</th><th scope="col">Latest available value</th></tr></thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td className={label === "Change" ? changeTone : ""}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
