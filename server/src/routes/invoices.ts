import { Router, Response } from "express";
import mongoose from "mongoose";
import { Invoice } from "../models/Invoice";
import { Sale } from "../models/Sale";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Staff must not see cost prices inside the sale
function cleanInvoice(invoice: any, role?: string) {
  const obj = typeof invoice.toObject === "function" ? invoice.toObject() : invoice;
  if (role !== "owner" && obj.sale && Array.isArray(obj.sale.items)) {
    obj.sale.items = obj.sale.items.map((item: any) => {
      const { costAtSale, ...rest } = item;
      return rest;
    });
  }
  return obj;
}

// Owner can open any invoice; staff only the ones they created
function canAccess(invoice: any, req: AuthRequest): boolean {
  return req.user?.role === "owner" || String(invoice.createdBy) === req.user?.id;
}

// Create an invoice from a sale
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, customerName } = req.body;

    if (!mongoose.isValidObjectId(saleId)) {
      res.status(400).json({ message: "A valid saleId is required" });
      return;
    }

    const sale = await Sale.findById(saleId);
    if (!sale) {
      res.status(404).json({ message: "Sale not found" });
      return;
    }

    if (req.user?.role !== "owner" && String(sale.soldBy) !== req.user?.id) {
      res.status(403).json({ message: "You can only invoice your own sales" });
      return;
    }

    const existing = await Invoice.findOne({ sale: sale._id });
    if (existing) {
      res.status(409).json({ message: `This sale already has invoice ${existing.invoiceNumber}` });
      return;
    }

    const name = String(customerName || sale.customerName || "").trim();
    if (!name) {
      res.status(400).json({ message: "Customer name is required" });
      return;
    }

    let invoice: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await Invoice.countDocuments();
      const invoiceNumber = `INV-${String(count + 1 + attempt).padStart(4, "0")}`;
      try {
        invoice = await Invoice.create({
          invoiceNumber,
          sale: sale._id,
          customerName: name,
          createdBy: new mongoose.Types.ObjectId(req.user!.id),
        });
        break;
      } catch (err: any) {
        if (err.code !== 11000) throw err;
      }
    }

    if (!invoice) {
      res.status(500).json({ message: "Could not generate an invoice number. Try again." });
      return;
    }

    await invoice.populate("sale");
    res.status(201).json(cleanInvoice(invoice, req.user?.role));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// List invoices: owner sees all, staff see their own
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const filter = req.user?.role === "owner" ? {} : { createdBy: req.user?.id };
    const invoices = await Invoice.find(filter).populate("sale").sort({ createdAt: -1 });
    res.json(invoices.map((invoice) => cleanInvoice(invoice, req.user?.role)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Get one invoice
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    const invoice = await Invoice.findById(id).populate("sale");
    if (!invoice || !canAccess(invoice, req)) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    res.json(cleanInvoice(invoice, req.user?.role));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Mark an invoice as paid
router.patch("/:id/pay", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    const invoice = await Invoice.findById(id);
    if (!invoice || !canAccess(invoice, req)) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (invoice.status === "paid") {
      res.status(400).json({ message: "This invoice is already paid" });
      return;
    }

    invoice.status = "paid";
    invoice.paidAt = new Date();
    await invoice.save();
    await invoice.populate("sale");

    res.json(cleanInvoice(invoice, req.user?.role));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;