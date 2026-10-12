import { Schema, model } from "mongoose";

export interface IProduct {
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  lowStockLevel: number;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockLevel: { type: Number, min: 0, default: 5 },
  },
  { timestamps: true }
);

export const Product = model<IProduct>("Product", productSchema);