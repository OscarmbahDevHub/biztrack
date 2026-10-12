import { Router, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { Invoice } from "../models/Invoice";
import { Sale } from "../models/Sale";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

function money(amount: number): string {
  return (
    "$" +
    amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

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

// Download an invoice as a PDF (for the customer: never shows cost prices)
router.get("/:id/pdf", authenticate, async (req: AuthRequest, res: Response) => {
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

    const sale: any = invoice.sale;
    const created = ((invoice as any).createdAt as Date) || new Date();

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    doc.pipe(res);

    // Header
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#0E2238").text("BizTrack");
    doc.font("Helvetica").fontSize(11).fillColor("#555555").text("Invoice");
    doc.moveDown(1.5);

    // Invoice details
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(12).text(invoice.invoiceNumber);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Date: ${created.toLocaleDateString("en-GB")}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);
    doc.moveDown();
    doc.font("Helvetica-Bold").text("Billed to");
    doc.font("Helvetica").text(invoice.customerName);
    doc.moveDown(1.5);

    // Table header
    let y = doc.y;
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Item", 50, y, { width: 240 });
    doc.text("Qty", 290, y, { width: 50, align: "right" });
    doc.text("Price", 350, y, { width: 90, align: "right" });
    doc.text("Amount", 450, y, { width: 95, align: "right" });
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#999999").stroke();
    y += 8;

    // Table rows
    doc.font("Helvetica").fontSize(11);
    for (const item of sale.items) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.text(item.name, 50, y, { width: 240 });
      doc.text(String(item.quantity), 290, y, { width: 50, align: "right" });
      doc.text(money(item.priceAtSale), 350, y, { width: 90, align: "right" });
      doc.text(money(item.priceAtSale * item.quantity), 450, y, { width: 95, align: "right" });
      y += 22;
    }

    // Total
    y += 4;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#999999").stroke();
    y += 10;
    doc.font("Helvetica-Bold").fontSize(13);
    doc.text("Total", 290, y, { width: 150, align: "right" });
    doc.text(money(sale.total), 450, y, { width: 95, align: "right" });

    // Footer
    doc.font("Helvetica").fontSize(10).fillColor("#555555");
    doc.text("Thank you for your business.", 50, y + 60, { width: 495, align: "center" });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Something went wrong" });
    }
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