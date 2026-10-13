import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession, getUser } from "../api";
import Layout from "../components/Layout";

type Product = {
  _id: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  lowStockLevel: number;
};

type FormState = {
  name: string;
  price: string;
  costPrice: string;
  quantity: string;
  lowStockLevel: string;
};

const emptyForm: FormState = {
  name: "",
  price: "",
  costPrice: "",
  quantity: "0",
  lowStockLevel: "5",
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
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
  }, [navigate, reloadKey]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditingId(product._id);
    setForm({
      name: product.name,
      price: String(product.price),
      costPrice: String(product.costPrice ?? 0),
      quantity: String(product.quantity),
      lowStockLevel: String(product.lowStockLevel),
    });
    setFormError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
  }

  function updateField(field: keyof FormState, value: string) {
    setForm({ ...form, [field]: value });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    const body = {
      name: form.name.trim(),
      price: Number(form.price),
      costPrice: Number(form.costPrice),
      quantity: Number(form.quantity),
      lowStockLevel: Number(form.lowStockLevel),
    };

    const numbers = [body.price, body.costPrice, body.quantity, body.lowStockLevel];
    if (!body.name) {
      setFormError("Please enter a product name");
      return;
    }
    if (numbers.some((n) => !Number.isFinite(n) || n < 0)) {
      setFormError("Prices and quantities must be numbers that are zero or more");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api(`/products/${editingId}`, { method: "PUT", body });
      } else {
        await api("/products", { method: "POST", body });
      }
      closeForm();
      setReloadKey((key) => key + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await api(`/products/${product._id}`, { method: "DELETE" });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const visible = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Layout>
      <div className="toolbar">
        <h2>Products</h2>
        <div className="toolbar-right">
          <input
            className="search"
            type="search"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isOwner && <button onClick={openAdd}>Add product</button>}
        </div>
      </div>

      {isOwner && showForm && (
        <form className="panel" onSubmit={handleSave}>
          <h3>{editingId ? "Edit product" : "Add product"}</h3>

          <div className="form-grid">
            <div>
              <label htmlFor="p-name">Name</label>
              <input
                id="p-name"
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="p-price">Price (USD)</label>
              <input
                id="p-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="p-cost">Cost price (USD)</label>
              <input
                id="p-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => updateField("costPrice", e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="p-qty">In stock</label>
              <input
                id="p-qty"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(e) => updateField("quantity", e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="p-low">Low-stock alert level</label>
              <input
                id="p-low"
                type="number"
                min="0"
                step="1"
                value={form.lowStockLevel}
                onChange={(e) => updateField("lowStockLevel", e.target.value)}
                required
              />
            </div>
          </div>

          {formError && <p className="error">{formError}</p>}

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add product"}
            </button>
            <button type="button" className="ghost" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="muted">Loading products...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Price</th>
                {isOwner && <th className="num">Cost</th>}
                <th className="num">In stock</th>
                <th>Status</th>
                {isOwner && <th>Actions</th>}
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
                    {isOwner && (
                      <td>
                        <div className="actions-cell">
                          <button className="small ghost" onClick={() => openEdit(p)}>
                            Edit
                          </button>
                          <button className="small danger" onClick={() => handleDelete(p)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 6 : 4} className="muted">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}