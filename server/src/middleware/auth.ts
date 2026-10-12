import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; role: "owner" | "staff" };
}

// Checks that the request carries a valid token
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Please log in first" });
    return;
  }

  const token = header.split(" ")[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET is missing in .env");
    res.status(500).json({ message: "Server configuration error" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as { id: string; role: "owner" | "staff" };
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Lets only the owner through (use after authenticate)
export function requireOwner(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== "owner") {
    res.status(403).json({ message: "Only the owner can do this" });
    return;
  }
  next();
}