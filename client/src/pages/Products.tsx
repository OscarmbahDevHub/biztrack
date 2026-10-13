import { useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../api";

export default function Products() {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>BizTrack</h1>
        <div className="topbar-right">
          <span className="muted">
            {user?.name} ({user?.role})
          </span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <p>Products will appear here soon.</p>
    </main>
  );
}