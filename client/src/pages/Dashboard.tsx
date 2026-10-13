import { useEffect, useState } from "react";
import { api, getUser } from "../api";
import Layout from "../components/Layout";

type LowStockProduct = {
  _id: string;
  name: string;
  quantity: number;
  lowStockLevel: number;
};

type DayTotal = {
  date: string;
  revenue: number;
  sales: number;
};

type DashboardData = {
  salesToday: number;
  unpaidInvoices: number;
  lowStock: LowStockProduct[];
  revenueToday?: number;
  profitToday?: number;
  salesTotal?: number;
  revenueTotal?: number;
  profitTotal?: number;
  last7Days?: DayTotal[];
};

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function weekday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export default function Dashboard() {
  const isOwner = getUser()?.role === "owner";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, []);

  const days = data?.last7Days ?? [];
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);

  return (
    <Layout>
      <h2>Dashboard</h2>

      {loading && <p className="muted">Loading dashboard...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="stats">
            <div className="stat">
              <span className="muted">Sales today</span>
              <span className="value">{data.salesToday}</span>
            </div>
            <div className="stat">
              <span className="muted">Unpaid invoices</span>
              <span className="value">{data.unpaidInvoices}</span>
            </div>
            <div className="stat">
              <span className="muted">Low-stock items</span>
              <span className="value">{data.lowStock.length}</span>
            </div>

            {isOwner && (
              <>
                <div className="stat">
                  <span className="muted">Revenue today</span>
                  <span className="value">{money(data.revenueToday ?? 0)}</span>
                </div>
                <div className="stat">
                  <span className="muted">Profit today</span>
                  <span className="value">{money(data.profitToday ?? 0)}</span>
                </div>
                <div className="stat">
                  <span className="muted">Total revenue</span>
                  <span className="value">{money(data.revenueTotal ?? 0)}</span>
                </div>
                <div className="stat">
                  <span className="muted">Total profit</span>
                  <span className="value">{money(data.profitTotal ?? 0)}</span>
                </div>
              </>
            )}
          </div>

          {isOwner && days.length > 0 && (
            <section className="panel">
              <h3>Revenue, last 7 days</h3>
              <div className="chart">
                {days.map((d) => (
                  <div className="bar-col" key={d.date}>
                    <div className="bar-track">
                      <div
                        className="bar"
                        title={`${d.date}: ${money(d.revenue)} from ${d.sales} sale(s)`}
                        style={{
                          height: `${(d.revenue / maxRevenue) * 100}%`,
                          minHeight: d.revenue > 0 ? "3px" : "0",
                        }}
                      />
                    </div>
                    <span className="bar-value">{d.revenue > 0 ? money(d.revenue) : "–"}</span>
                    <span className="bar-label">{weekday(d.date)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h3>Low stock</h3>
            {data.lowStock.length === 0 ? (
              <p className="muted">All products are well stocked.</p>
            ) : (
              <div className="table-wrap flat">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Left</th>
                      <th className="num">Alert level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.map((p) => (
                      <tr key={p._id}>
                        <td>{p.name}</td>
                        <td className="num">
                          <span className="badge low">{p.quantity}</span>
                        </td>
                        <td className="num">{p.lowStockLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}