import { requestJson } from "../../../lib/http.js";

export function listUsers() {
  return requestJson("/api/admin/users");
}

export function createUser(account) {
  return requestJson("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  });
}

export function updateUserRole(userId, role) {
  return requestJson(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}
