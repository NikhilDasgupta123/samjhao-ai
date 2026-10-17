import { requestJson } from "../../../lib/http.js";

export function getCurrentUser() {
  return requestJson("/api/auth/me");
}

export function logIn(credentials) {
  return requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

export function signUp(account) {
  return requestJson("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  });
}

export function logOut() {
  return requestJson("/api/auth/logout", { method: "POST" });
}
