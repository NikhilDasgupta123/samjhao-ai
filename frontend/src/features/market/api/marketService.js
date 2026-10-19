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

export function getStockCatalysts({ symbol, companyName, refresh = false, signal }) {
  return requestJson("/api/stocks/catalysts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, company_name: companyName, refresh }),
    signal,
  });
}

export function getDailyMarketDigest({ refresh = false, signal } = {}) {
  return requestJson("/api/market/digest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    signal,
  });
}
