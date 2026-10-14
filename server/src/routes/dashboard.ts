import { Router, Response } from "express";
import mongoose from "mongoose";
import { Sale } from "../models/Sale";
import { Product } from "../models/Product";
import { Invoice } from "../models/Invoice";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Profit of one sale = sum of (price - cost) x quantity for each item
const profitPerSale = {
  $sum: {
    $map: {
      input: "$items",
      as: "item",
      in: {
        $multiply: [
          { $subtract: ["$$item.priceAtSale", "$$item.costAtSale"] },
          "$$item.quantity",
        ],
      },
    },
  },
};

async function summarize(match: Record<string, unknown>) {
  const [result] = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        sales: { $sum: 1 },
        revenue: { $sum: "$total" },
        profit: { $sum: profitPerSale },
      },
    },
  ]);
  return {
    sales: result?.sales ?? 0,
    revenue: result?.revenue ?? 0,
    profit: result?.profit ?? 0,
  };
}

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isOwner = req.user?.role === "owner";
    const userId = new mongoose.Types.ObjectId(req.user!.id);

    // "Today" starts at midnight UTC
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    // Staff only see their own sales and invoices
    const saleFilter = isOwner ? {} : { soldBy: userId };
    const today = await summarize({ ...saleFilter, createdAt: { $gte: startOfToday } });

    // Products at or below their low-stock level
    const lowStock = await Product.find({ $expr: { $lte: ["$quantity", "$lowStockLevel"] } })
      .select("name quantity lowStockLevel")
      .sort({ quantity: 1 });

    const unpaidFilter = isOwner
      ? { status: "unpaid" as const }
      : { status: "unpaid" as const, createdBy: userId };
    const unpaidInvoices = await Invoice.countDocuments(unpaidFilter);
    
    const data: Record<string, unknown> = {
      salesToday: today.sales,
      lowStock,
      unpaidInvoices,
    };

    // Money numbers are for the owner only
    if (isOwner) {
      const allTime = await summarize({});
      data.revenueToday = today.revenue;
      data.profitToday = today.profit;
      data.salesTotal = allTime.sales;
      data.revenueTotal = allTime.revenue;
      data.profitTotal = allTime.profit;

      // Revenue for the last 7 days (for a chart later)
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 6);

      const daily = await Sale.aggregate([
        { $match: { createdAt: { $gte: startOfWeek } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
            sales: { $sum: 1 },
          },
        },
      ]);

      const byDay = new Map<string, { revenue: number; sales: number }>();
      for (const d of daily) byDay.set(d._id, { revenue: d.revenue, sales: d.sales });

      const last7Days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setUTCDate(startOfWeek.getUTCDate() + i);
        const key = day.toISOString().slice(0, 10);
        last7Days.push({
          date: key,
          revenue: byDay.get(key)?.revenue ?? 0,
          sales: byDay.get(key)?.sales ?? 0,
        });
      }
      data.last7Days = last7Days;
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;