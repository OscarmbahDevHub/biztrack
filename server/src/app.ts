import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import saleRoutes from "./routes/sales";
import invoiceRoutes from "./routes/invoices";
import dashboardRoutes from "./routes/dashboard";
import userRoutes from "./routes/users";
import { authenticate, AuthRequest } from "./middleware/auth";
import { User } from "./models/User";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "BizTrack API",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

// Protected route: only works with a valid token
app.get("/api/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default app;