import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession } from "../api";
import type { User } from "../api";

const DEMO_ACCOUNTS = [
  {
    label: "Owner",
    note: "full access, profit and reports",
    email: "demo.owner@biztrack.com",
    password: "DemoOwner123",
  },
  {
    label: "Staff",
    note: "sales only, no costs or profit",
    email: "demo.staff@biztrack.com",
    password: "DemoStaff123",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      saveSession(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>BizTrack</h1>
        <p className="muted">Log in to manage your shop.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        <div className="demo-box">
          <strong>Try the demo</strong>
          <p className="muted">
            Pick a role to fill in the login, then press Log in. The server
            may take up to a minute to wake up on the first try.
          </p>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.label}
              type="button"
              className="demo-btn"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                setError("");
              }}
            >
              <span>{account.label}</span>
              <small>{account.note}</small>
              <small>
                {account.email} / {account.password}
              </small>
            </button>
          ))}
        </div>
      </form>
    </main>
  );
}