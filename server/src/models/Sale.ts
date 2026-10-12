import { Schema, model, Types } from "mongoose";

export interface ISaleItem {
  product: Types.ObjectId;
  name: string;
  quantity: number;
  priceAtSale: number;
  costAtSale: number;
}

export interface ISale {
  items: ISaleItem[];
  total: number;
  customerName?: string;
  soldBy: Types.ObjectId;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtSale: { type: Number, required: true, min: 0 },
    costAtSale: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    items: { type: [saleItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    customerName: { type: String, trim: true },
    soldBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Sale = model<ISale>("Sale", saleSchema);