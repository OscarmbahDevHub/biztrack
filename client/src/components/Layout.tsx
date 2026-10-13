import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../api";

export default function Layout({ children }: { children: ReactNode }) {
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
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/sales/new">New sale</NavLink>
          <NavLink to="/sales" end>
            Sales
          </NavLink>
          {user?.role === "owner" && <NavLink to="/staff">Staff</NavLink>}
        </nav>
        <div className="topbar-right">
          <span className="muted">
            {user?.name} ({user?.role})
          </span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      {children}
    </main>
  );
}