import { requestJson } from "../../../lib/http.js";

export function getMarketWatch({ signal } = {}) {
  return requestJson("/api/stocks/market-watch", { signal });
}

export function getStockMarketData({ symbol, historyDays = 30, signal }) {
  return requestJson("/api/stocks/market-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, history_days: historyDays }),
    signal,
  });
}
