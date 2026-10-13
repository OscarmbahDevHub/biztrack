import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Product } from "./models/Product";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

const products = [
  { name: "Wireless Earbuds", price: 29.99, costPrice: 18.5, quantity: 45, lowStockLevel: 10 },
  { name: "Phone Charger", price: 12.99, costPrice: 6.8, quantity: 80, lowStockLevel: 15 },
  { name: "USB-C Cable", price: 7.99, costPrice: 3.2, quantity: 120, lowStockLevel: 20 },
  { name: "Power Bank 10000mAh", price: 24.99, costPrice: 15, quantity: 30, lowStockLevel: 8 },
  { name: "Bluetooth Speaker", price: 34.99, costPrice: 21, quantity: 18, lowStockLevel: 6 },
  { name: "Laptop Backpack", price: 39.99, costPrice: 22.5, quantity: 25, lowStockLevel: 5 },
  { name: "Notebook A5", price: 3.49, costPrice: 1.4, quantity: 200, lowStockLevel: 40 },
  { name: "Ballpoint Pens (Box of 10)", price: 4.99, costPrice: 2.1, quantity: 90, lowStockLevel: 20 },
  { name: "LED Desk Lamp", price: 19.99, costPrice: 11, quantity: 4, lowStockLevel: 5 },
  { name: "Water Bottle 1L", price: 11.99, costPrice: 5.5, quantity: 60, lowStockLevel: 12 },
  { name: "Instant Noodles (Pack of 5)", price: 4.49, costPrice: 2.8, quantity: 70, lowStockLevel: 15 },
  { name: "Bottled Water (12 Pack)", price: 6.99, costPrice: 4.2, quantity: 3, lowStockLevel: 10 },
  { name: "Hand Sanitizer 250ml", price: 5.49, costPrice: 2.6, quantity: 55, lowStockLevel: 12 },
  { name: "Phone Case", price: 9.99, costPrice: 3.5, quantity: 2, lowStockLevel: 10 },
  { name: "Mouse Pad", price: 8.99, costPrice: 3.9, quantity: 35, lowStockLevel: 8 },
  { name: "Wireless Mouse", price: 17.99, costPrice: 9.8, quantity: 22, lowStockLevel: 6 },
  { name: "Keyboard", price: 27.99, costPrice: 16.4, quantity: 14, lowStockLevel: 5 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  let added = 0;
  for (const product of products) {
    const { name, ...rest } = product;
    // Only adds the product if it doesn't exist yet
    const result = await Product.updateOne({ name }, { $setOnInsert: rest }, { upsert: true });
    if (result.upsertedCount) added++;
  }

  console.log(`Added ${added} new products (${products.length - added} already existed)`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});