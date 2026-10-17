import { useEffect, useState } from "react";
import { formatLocalDateTime } from "../../../lib/formatters.js";
import { createUser, listUsers, updateUserRole } from "../api/adminService.js";

export function AdminUsersPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [newUser, setNewUser] = useState({ full_name: "", username: "", email: "", password: "" });

  async function loadUsers() {
    setIsLoading(true);
    setError("");
    try {
      const payload = await listUsers();
      setUsers(payload);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not connect to the backend." : requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  function suggestPassword() {
    if (!globalThis.crypto?.getRandomValues) {
      setError("Secure password suggestions require HTTPS or localhost.");
      return;
    }

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
    const maxAcceptedByte = Math.floor(256 / alphabet.length) * alphabet.length;
    const password = [];
    while (password.length < 18) {
      const randomBytes = new Uint8Array(24);
      globalThis.crypto.getRandomValues(randomBytes);
      for (const byte of randomBytes) {
        if (byte < maxAcceptedByte) password.push(alphabet[byte % alphabet.length]);
        if (password.length === 18) break;
      }
    }

    setNewUser((currentUser) => ({ ...currentUser, password: password.join("") }));
    setShowInitialPassword(true);
    setError("");
  }

  async function addUser(event) {
    event.preventDefault();
    setIsCreatingUser(true);
    setError("");
    setNotice("");
    try {
      const payload = await createUser({
        email: newUser.email.trim(),
        username: newUser.username.trim(),
        password: newUser.password,
        ...(newUser.full_name.trim() ? { full_name: newUser.full_name.trim() } : {}),
      });
      setUsers((currentUsers) => [payload, ...currentUsers]);
      setNewUser({ full_name: "", username: "", email: "", password: "" });
      setShowInitialPassword(false);
      setIsAddUserOpen(false);
      setNotice(`@${payload.username} was added. Share the initial password securely.`);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not connect to the backend." : requestError.message);
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function changeRole(user, role) {
    setUpdatingUserId(user.id);
    setError("");
    try {
      const payload = await updateUserRole(user.id, role);
      setUsers((currentUsers) => currentUsers.map((item) => item.id === user.id ? payload : item));
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not connect to the backend." : requestError.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <section className="portal-card admin-users-card">
      <div className="portal-panel-heading">
        <div><h2>User accounts</h2><p>Manage access to the workspace</p></div>
        <div className="admin-users-actions">
          <button className="admin-add-user-button" type="button" onClick={() => {
            if (isAddUserOpen) {
              setNewUser({ full_name: "", username: "", email: "", password: "" });
              setShowInitialPassword(false);
            }
            setIsAddUserOpen((open) => !open);
            setError("");
            setNotice("");
          }} disabled={isLoading || isCreatingUser}>
            {isAddUserOpen ? "Cancel" : "＋ Add user"}
          </button>
          <button className="activity-open" type="button" onClick={() => void loadUsers()} disabled={isLoading || isCreatingUser || updatingUserId !== null}>Refresh</button>
        </div>
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}
      {notice && <p className="admin-users-success" role="status">{notice}</p>}
      {isAddUserOpen && (
        <form className="admin-add-user-form" onSubmit={addUser}>
          <div className="admin-add-user-fields">
            <label>
              Name <span>Optional</span>
              <input autoComplete="name" maxLength={120} value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} placeholder="Full name" />
            </label>
            <label>
              Username
              <input autoComplete="off" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" required value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} placeholder="e.g. nikhil_dev" />
            </label>
            <label>
              Email
              <input type="email" autoComplete="off" required value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="user@company.com" />
            </label>
            <label>
              Initial password
              <div className="admin-password-field">
                <input type={showInitialPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="At least 8 characters" />
                <button className="admin-suggest-password" type="button" onClick={suggestPassword}>Suggest password</button>
              </div>
            </label>
          </div>
          <div className="admin-add-user-form-footer">
            <span>The new account gets the User role. You can promote it from the table.</span>
            <button className="admin-add-user-submit" type="submit" disabled={isCreatingUser}>
              {isCreatingUser ? "Adding user…" : "Create user"}
            </button>
          </div>
        </form>
      )}
      {isLoading ? <p className="admin-users-note">Loading accounts…</p> : users.length ? (
        <div className="table-responsive admin-users-table-wrap">
          <table className="table table-striped table-hover align-middle admin-users-table">
            <caption className="visually-hidden">Users with their account roles and join dates</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Joined · local time</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="admin-table-name">{user.full_name || "—"}</td>
                  <td>{user.email}</td>
                  <td><span className="admin-table-username">@{user.username}</span></td>
                  <td><span className={`role-badge role-${user.role}`}>{user.role}</span></td>
                  <td><time dateTime={user.created_at}>{formatLocalDateTime(user.created_at)}</time></td>
                  <td>
                    {user.id !== currentUser.id ? (
                      <button className="activity-open" type="button" disabled={updatingUserId === user.id} onClick={() => void changeRole(user, user.role === "admin" ? "user" : "admin")}>
                        {updatingUserId === user.id ? "Saving…" : user.role === "admin" ? "Make user" : "Make admin"}
                      </button>
                    ) : <span className="admin-self-label">You</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="admin-users-note">No accounts found.</p>}
    </section>
  );
}
