import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

dotenv.config();

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    console.log(
      "DEBUG variable names:",
      Object.keys(process.env).filter((k) => !k.startsWith("npm_")).join(", ")
    );
    console.log("DEBUG MONGODB_URI set:", Boolean(process.env.MONGODB_URI));

    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();