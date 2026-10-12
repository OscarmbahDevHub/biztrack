import { Router, Response } from "express";
import mongoose from "mongoose";
import { Product } from "../models/Product";
import { Sale } from "../models/Sale";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

type Reserved = { productId: string; quantity: number };

// Put stock back if a sale fails halfway
async function restoreStock(reserved: Reserved[]) {
  for (const r of reserved) {
    await Product.findByIdAndUpdate(r.productId, { $inc: { quantity: r.quantity } });
  }
}

// Staff must not see cost prices or profit
function cleanSale(sale: any, role?: string) {
  const obj = typeof sale.toObject === "function" ? sale.toObject() : sale;
  if (role !== "owner") {
    obj.items = obj.items.map((item: any) => {
      const { costAtSale, ...rest } = item;
      return rest;
    });
  }
  return obj;
}

// Record a sale (owner and staff)
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const reserved: Reserved[] = [];

  try {
    const { items, customerName } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "A sale needs at least one item" });
      return;
    }

    const saleItems = [];
    let total = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(quantity) || quantity < 1) {
        await restoreStock(reserved);
        res.status(400).json({ message: "Each item needs a valid productId and a whole-number quantity" });
        return;
      }

      // Take the stock only if there is enough
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true }
      );

      if (!product) {
        await restoreStock(reserved);
        res.status(400).json({ message: "A product was not found or does not have enough stock" });
        return;
      }

      reserved.push({ productId: String(product._id), quantity });

      saleItems.push({
        product: product._id,
        name: product.name,
        quantity,
        priceAtSale: product.price,
        costAtSale: product.costPrice,
      });

      total += product.price * quantity;
    }

    const sale = await Sale.create({
      items: saleItems,
      total,
      customerName,
      soldBy: new mongoose.Types.ObjectId(req.user!.id),
    });

    res.status(201).json(cleanSale(sale, req.user?.role));
  } catch (error) {
    console.error(error);
    await restoreStock(reserved);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// List sales: owner sees all, staff see only their own
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const filter = req.user?.role === "owner" ? {} : { soldBy: req.user?.id };
    const sales = await Sale.find(filter).sort({ createdAt: -1 });
    res.json(sales.map((sale) => cleanSale(sale, req.user?.role)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;