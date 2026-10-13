import { Router, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { authenticate, requireOwner, AuthRequest } from "../middleware/auth";

const router = Router();

// List all users (owner only). Passwords are never sent.
router.get("/", authenticate, requireOwner, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: 1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Remove a staff account (owner only)
router.delete("/:id", authenticate, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.role === "owner") {
      res.status(400).json({ message: "The owner account cannot be removed" });
      return;
    }

    await user.deleteOne();
    res.json({ message: "Staff account removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;