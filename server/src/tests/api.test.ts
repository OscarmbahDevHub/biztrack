import dns from "dns";
import dotenv from "dotenv";
import request from "supertest";
import mongoose from "mongoose";
import app from "../app";

let ownerToken = "";
let staffToken = "";
let productId = "";
let saleId = "";
let invoiceId = "";

const owner = { name: "Test Owner", email: "owner@test.com", password: "owner123" };
const staff = { name: "Test Staff", email: "staff@test.com", password: "staff123" };

async function login(email: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token as string;
}

// Empties every collection in the test database (never touches your real one)
async function clearTestDatabase() {
  if (mongoose.connection.name !== "biztrack_test") {
    throw new Error("Refusing to run: not connected to the test database");
  }
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
}

beforeAll(async () => {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  dotenv.config({ quiet: true });
  process.env.JWT_SECRET = "test-secret";

  // A separate database just for tests, never your real one
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: "biztrack_test" });
  await clearTestDatabase();

  // The first account ever registered becomes the owner
  await request(app).post("/api/auth/register").send(owner);
  ownerToken = await login(owner.email, owner.password);

  // Only the owner can add staff
  await request(app)
    .post("/api/auth/register")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send(staff);
  staffToken = await login(staff.email, staff.password);
}, 60000);

afterAll(async () => {
  await clearTestDatabase();
  await mongoose.disconnect();
});

describe("accounts and logins", () => {
  it("makes the first registered user the owner", async () => {
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("owner");
  });

  it("makes later users staff", async () => {
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${staffToken}`);
    expect(res.body.role).toBe("staff");
  });

  it("never sends the password back", async () => {
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.body.password).toBeUndefined();
  });

  it("blocks registration without a login", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Stranger", email: "stranger@test.com", password: "stranger123" });
    expect(res.status).toBe(401);
  });

  it("stops staff from creating accounts", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ name: "Sneaky", email: "sneaky@test.com", password: "sneaky123" });
    expect(res.status).toBe(403);
  });

  it("rejects a duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(staff);
    expect(res.status).toBe(409);
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: owner.email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });
});

describe("products and permissions", () => {
  it("stops staff from adding products", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ name: "Sneaky Item", price: 1, costPrice: 1, quantity: 1 });
    expect(res.status).toBe(403);
  });

  it("lets the owner add a product", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Test Product", price: 10, costPrice: 6, quantity: 5, lowStockLevel: 2 });
    expect(res.status).toBe(201);
    productId = res.body._id;
  });

  it("shows the cost price to the owner", async () => {
    const res = await request(app).get("/api/products").set("Authorization", `Bearer ${ownerToken}`);
    const product = res.body.find((p: { _id: string }) => p._id === productId);
    expect(product.costPrice).toBe(6);
  });

  it("hides the cost price from staff", async () => {
    const res = await request(app).get("/api/products").set("Authorization", `Bearer ${staffToken}`);
    const product = res.body.find((p: { _id: string }) => p._id === productId);
    expect(product).toBeDefined();
    expect(product.costPrice).toBeUndefined();
  });
});

describe("sales and stock", () => {
  it("records a sale and reduces stock", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ customerName: "Test Customer", items: [{ productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(20);
    saleId = res.body._id;

    const products = await request(app).get("/api/products").set("Authorization", `Bearer ${ownerToken}`);
    const product = products.body.find((p: { _id: string }) => p._id === productId);
    expect(product.quantity).toBe(3);
  });

  it("hides cost prices in a sale shown to staff", async () => {
    const res = await request(app).get("/api/sales").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body[0].items[0].costAtSale).toBeUndefined();
  });

  it("refuses to sell more than is in stock, and leaves the stock alone", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ items: [{ productId, quantity: 100 }] });
    expect(res.status).toBe(400);

    const products = await request(app).get("/api/products").set("Authorization", `Bearer ${ownerToken}`);
    const product = products.body.find((p: { _id: string }) => p._id === productId);
    expect(product.quantity).toBe(3);
  });

  it("keeps the old price on past sales when a price changes", async () => {
    await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ price: 99 });

    const res = await request(app).get("/api/sales").set("Authorization", `Bearer ${ownerToken}`);
    const sale = res.body.find((s: { _id: string }) => s._id === saleId);
    expect(sale.items[0].priceAtSale).toBe(10);
  });
});

describe("invoices", () => {
  it("creates an invoice from a sale", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ saleId, customerName: "Test Customer" });
    expect(res.status).toBe(201);
    expect(res.body.invoiceNumber).toBe("INV-0001");
    expect(res.body.status).toBe("unpaid");
    invoiceId = res.body._id;
  });

  it("does not allow a second invoice for the same sale", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ saleId, customerName: "Test Customer" });
    expect(res.status).toBe(409);
  });

  it("marks an invoice as paid", async () => {
    const res = await request(app)
      .patch(`/api/invoices/${invoiceId}/pay`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paid");
  });

  it("downloads the invoice as a PDF", async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceId}/pdf`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect((res.body as Buffer).toString("latin1", 0, 4)).toBe("%PDF");
  });
});

describe("dashboard", () => {
  it("shows revenue and profit to the owner", async () => {
    const res = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.revenueTotal).toBe(20);
    expect(res.body.profitTotal).toBe(8);
    expect(res.body.last7Days).toHaveLength(7);
  });

  it("hides revenue and profit from staff", async () => {
    const res = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.revenueTotal).toBeUndefined();
    expect(res.body.profitTotal).toBeUndefined();
    expect(res.body.last7Days).toBeUndefined();
  });
});