import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, downloadFile } from "../api";
import Layout from "../components/Layout";

type Product = {
  _id: string;
  name: string;
  price: number;
  quantity: number;
};

type Sale = {
  _id: string;
  total: number;
  customerName?: string;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
};

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function NewSale() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  useEffect(() => {
    api<Product[]>("/products")
      .then(setProducts)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  function changeQuantity(product: Product, change: number) {
    const current = cart[product._id] ?? 0;
    const next = Math.max(0, Math.min(product.quantity, current + change));
    const updated = { ...cart };
    if (next === 0) {
      delete updated[product._id];
    } else {
      updated[product._id] = next;
    }
    setCart(updated);
  }

  const cartItems = products
    .filter((p) => cart[p._id])
    .map((p) => ({ product: p, quantity: cart[p._id] }));

  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const visible = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setError("");
    setSaving(true);
    setLastSale(null);
    setInvoice(null);

    try {
      const sale = await api<Sale>("/sales", {
        method: "POST",
        body: {
          customerName: customerName.trim() || undefined,
          items: cartItems.map((item) => ({
            productId: item.product._id,
            quantity: item.quantity,
          })),
        },
      });
      setLastSale(sale);
      setInvoiceName(sale.customerName ?? "");
      setCart({});
      setCustomerName("");
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function createInvoice() {
    if (!lastSale) return;
    setError("");
    setInvoiceBusy(true);
    try {
      const created = await api<Invoice>("/invoices", {
        method: "POST",
        body: { saleId: lastSale._id, customerName: invoiceName.trim() },
      });
      setInvoice(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function downloadPdf() {
    if (!invoice) return;
    setError("");
    setInvoiceBusy(true);
    try {
      await downloadFile(`/invoices/${invoice._id}/pdf`, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInvoiceBusy(false);
    }
  }

  return (
    <Layout>
      <h2>New sale</h2>

      {error && <p className="error">{error}</p>}

      {lastSale && (
        <div className="receipt">
          <h3>Sale recorded: {money(lastSale.total)}</h3>

          {!invoice && (
            <div className="receipt-row">
              <div>
                <label htmlFor="invoice-name">Customer name for the invoice</label>
                <input
                  id="invoice-name"
                  type="text"
                  value={invoiceName}
                  onChange={(e) => setInvoiceName(e.target.value)}
                />
              </div>
              <button onClick={createInvoice} disabled={invoiceBusy || !invoiceName.trim()}>
                {invoiceBusy ? "Creating..." : "Create invoice"}
              </button>
            </div>
          )}

          {invoice && (
            <div className="receipt-row">
              <p>
                Invoice <strong>{invoice.invoiceNumber}</strong> created.
              </p>
              <button onClick={downloadPdf} disabled={invoiceBusy}>
                {invoiceBusy ? "Downloading..." : "Download PDF"}
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p className="muted">Loading products...</p>}

      {!loading && (
        <div className="sale-grid">
          <section>
            <input
              className="search"
              type="search"
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="product-list">
              {visible.map((p) => {
                const qty = cart[p._id] ?? 0;
                return (
                  <div className="product-row" key={p._id}>
                    <div>
                      <strong>{p.name}</strong>
                      <div className="muted">
                        {money(p.price)} · {p.quantity} in stock
                      </div>
                    </div>
                    <div className="qty">
                      <button
                        type="button"
                        onClick={() => changeQuantity(p, -1)}
                        disabled={qty === 0}
                      >
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(p, 1)}
                        disabled={qty >= p.quantity}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && <p className="muted">No products found.</p>}
            </div>
          </section>

          <form className="cart" onSubmit={handleSubmit}>
            <h3>Cart</h3>

            {cartItems.length === 0 && <p className="muted">Add products to start a sale.</p>}

            {cartItems.map((item) => (
              <div className="cart-line" key={item.product._id}>
                <span>
                  {item.quantity} × {item.product.name}
                </span>
                <span>{money(item.product.price * item.quantity)}</span>
              </div>
            ))}

            <div className="cart-total">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>

            <label htmlFor="customer">Customer name (optional)</label>
            <input
              id="customer"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />

            <button className="wide" type="submit" disabled={saving || cartItems.length === 0}>
              {saving ? "Recording..." : "Record sale"}
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
}