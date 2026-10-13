import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession, getUser } from "../api";

type Product = {
  _id: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  lowStockLevel: number;
};

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function Products() {
  const navigate = useNavigate();
  const user = getUser();
  const isOwner = user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Product[]>("/products")
      .then(setProducts)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Something went wrong";
        if (message === "Please log in first" || message === "Invalid or expired token") {
          clearSession();
          navigate("/login");
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function logout() {
    clearSession();
    navigate("/login");
  }

  const visible = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

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

      <div className="toolbar">
        <h2>Products</h2>
        <input
          className="search"
          type="search"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p className="muted">Loading products...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Price</th>
                {isOwner && <th className="num">Cost</th>}
                <th className="num">In stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const low = p.quantity <= p.lowStockLevel;
                return (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td className="num">{money(p.price)}</td>
                    {isOwner && <td className="num">{money(p.costPrice ?? 0)}</td>}
                    <td className="num">{p.quantity}</td>
                    <td>
                      <span className={low ? "badge low" : "badge ok"}>
                        {low ? "Low stock" : "In stock"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 5 : 4} className="muted">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}