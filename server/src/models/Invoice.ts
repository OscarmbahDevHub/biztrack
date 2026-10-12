import { Schema, model, Types } from "mongoose";

export interface IInvoice {
  invoiceNumber: string;
  sale: Types.ObjectId;
  customerName: string;
  status: "unpaid" | "paid";
  paidAt?: Date;
  createdBy: Types.ObjectId;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    sale: { type: Schema.Types.ObjectId, ref: "Sale", required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    paidAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Invoice = model<IInvoice>("Invoice", invoiceSchema);