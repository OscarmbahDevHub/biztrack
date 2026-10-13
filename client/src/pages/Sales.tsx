import { useEffect, useState } from "react";
import { api, downloadFile, getUser } from "../api";
import Layout from "../components/Layout";

type SaleItem = {
  name: string;
  quantity: number;
  priceAtSale: number;
  costAtSale?: number;
};

type Sale = {
  _id: string;
  items: SaleItem[];
  total: number;
  customerName?: string;
  createdAt: string;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  status: "unpaid" | "paid";
  sale: { _id: string };
};

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function profitOf(sale: Sale): number {
  return sale.items.reduce(
    (sum, item) => sum + (item.priceAtSale - (item.costAtSale ?? 0)) * item.quantity,
    0
  );
}

export default function Sales() {
  const isOwner = getUser()?.role === "owner";

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([api<Sale[]>("/sales"), api<Invoice[]>("/invoices")])
      .then(([salesData, invoicesData]) => {
        setSales(salesData);
        setInvoices(invoicesData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  // Find the invoice (if any) for each sale
  const invoiceBySale = new Map<string, Invoice>();
  for (const invoice of invoices) {
    invoiceBySale.set(invoice.sale._id, invoice);
  }

  async function run(id: string, action: () => Promise<unknown>) {
    setError("");
    setBusyId(id);
    try {
      await action();
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  function createInvoice(sale: Sale) {
    const name = sale.customerName || window.prompt("Customer name for the invoice:");
    if (!name || !name.trim()) return;
    run(sale._id, () =>
      api("/invoices", { method: "POST", body: { saleId: sale._id, customerName: name.trim() } })
    );
  }

  function markPaid(invoice: Invoice) {
    run(invoice._id, () => api(`/invoices/${invoice._id}/pay`, { method: "PATCH" }));
  }

  function downloadPdf(invoice: Invoice) {
    run(invoice._id, () =>
      downloadFile(`/invoices/${invoice._id}/pdf`, `${invoice.invoiceNumber}.pdf`)
    );
  }

  return (
    <Layout>
      <h2>Sales</h2>

      {loading && <p className="muted">Loading sales...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="num">Total</th>
                {isOwner && <th className="num">Profit</th>}
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const invoice = invoiceBySale.get(sale._id);
                const busy = busyId === sale._id || busyId === invoice?._id;
                return (
                  <tr key={sale._id}>
                    <td>{formatDate(sale.createdAt)}</td>
                    <td>{sale.customerName || <span className="muted">—</span>}</td>
                    <td className="items-cell">
                      {sale.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
                    </td>
                    <td className="num">{money(sale.total)}</td>
                    {isOwner && <td className="num">{money(profitOf(sale))}</td>}
                    <td>
                      {invoice ? (
                        <div className="actions-cell">
                          <strong>{invoice.invoiceNumber}</strong>
                          <span className={invoice.status === "paid" ? "badge ok" : "badge warn"}>
                            {invoice.status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                          <button className="small ghost" disabled={busy} onClick={() => downloadPdf(invoice)}>
                            PDF
                          </button>
                          {invoice.status === "unpaid" && (
                            <button className="small" disabled={busy} onClick={() => markPaid(invoice)}>
                              Mark paid
                            </button>
                          )}
                        </div>
                      ) : (
                        <button className="small" disabled={busy} onClick={() => createInvoice(sale)}>
                          Create invoice
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 6 : 5} className="muted">
                    No sales yet.
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