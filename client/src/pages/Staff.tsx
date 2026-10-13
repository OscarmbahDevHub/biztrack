import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, getUser } from "../api";
import Layout from "../components/Layout";

type Member = {
  _id: string;
  name: string;
  email: string;
  role: "owner" | "staff";
  createdAt: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default function Staff() {
  const isOwner = getUser()?.role === "owner";

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(isOwner);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    api<Member[]>("/users")
      .then(setMembers)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [isOwner, reloadKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), password },
      });
      setName("");
      setEmail("");
      setPassword("");
      setReloadKey((key) => key + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(member: Member) {
    if (!window.confirm(`Remove ${member.name}? They will no longer be able to log in.`)) return;
    setError("");
    try {
      await api(`/users/${member._id}`, { method: "DELETE" });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (!isOwner) {
    return (
      <Layout>
        <h2>Staff</h2>
        <p className="muted">Only the owner can manage staff accounts.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h2>Staff</h2>

      <form className="panel" onSubmit={handleAdd}>
        <h3>Add a staff member</h3>

        <div className="form-grid">
          <div>
            <label htmlFor="s-name">Name</label>
            <input
              id="s-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="s-email">Email</label>
            <input
              id="s-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="s-password">Password (6+ characters)</label>
            <input
              id="s-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {formError && <p className="error">{formError}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add staff member"}
          </button>
        </div>
      </form>

      {loading && <p className="muted">Loading staff...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    <span className={m.role === "owner" ? "badge ok" : "badge"}>{m.role}</span>
                  </td>
                  <td>{formatDate(m.createdAt)}</td>
                  <td>
                    {m.role === "staff" && (
                      <button className="small danger" onClick={() => handleRemove(m)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}