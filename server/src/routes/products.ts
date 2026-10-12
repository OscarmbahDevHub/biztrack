import { Router, Response } from "express";
import mongoose from "mongoose";
import { Product } from "../models/Product";
import { authenticate, requireOwner, AuthRequest } from "../middleware/auth";

const router = Router();

// Staff must not see cost price
function hiddenFields(req: AuthRequest): string {
  return req.user?.role === "owner" ? "" : "-costPrice";
}

// List all products (owner and staff)
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find().select(hiddenFields(req)).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Get one product (owner and staff)
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    const product = await Product.findById(id).select(hiddenFields(req));
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Add a product (owner only)
router.post("/", authenticate, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const { name, price, costPrice, quantity, lowStockLevel } = req.body;

    if (!name || price === undefined || costPrice === undefined) {
      res.status(400).json({ message: "Name, price, and cost price are required" });
      return;
    }

    const product = await Product.create({ name, price, costPrice, quantity, lowStockLevel });
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Could not create product. Check your values." });
  }
});

// Edit a product (owner only)
router.put("/:id", authenticate, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    for (const field of ["name", "price", "costPrice", "quantity", "lowStockLevel"]) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Could not update product. Check your values." });
  }
});

// Delete a product (owner only)
router.delete("/:id", authenticate, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;