import { useState } from "react";
import { ArrowIcon } from "../../../components/icons.jsx";
import { logIn, signUp } from "../api/authService.js";

export function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    const isSignUp = mode === "signup";

    try {
      const account = {
        password,
        ...(isSignUp ? {
          email: identifier.trim(),
          username: username.trim(),
          ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
        } : { identifier: identifier.trim() }),
      };
      const payload = isSignUp ? await signUp(account) : await logIn(account);
      onAuthenticated(payload);
    } catch (requestError) {
      setFormError(requestError instanceof TypeError
        ? "Could not connect to the backend. Start the backend and try again."
        : requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="eyebrow"><span className="eyebrow-line" /> INDIA STOCK MARKET WORKSPACE</div>
        <h1 id="auth-title">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-description">
          {mode === "signup" ? "Create an account to view Indian stock prices and trends." : "Sign in to continue to your India market dashboard."}
        </p>
        {formError && <div className="error-message" role="alert">{formError}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Username
              <input autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. nikhil_dev" />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Name <span>Optional</span>
              <input autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            {mode === "signup" ? "Email" : "Email or username"}
            <input
              type={mode === "signup" ? "email" : "text"}
              autoComplete={mode === "signup" ? "email" : "username"}
              maxLength={320}
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={mode === "signup" ? "you@company.com" : "you@company.com or username"}
            />
          </label>
          <label>
            Password
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
          </label>
          <button className="analyze-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            {!isSubmitting && <ArrowIcon />}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to MarketBrief AI?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setIdentifier(""); setFormError(""); }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
