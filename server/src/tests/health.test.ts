import request from "supertest";
import app from "../app";

describe("health check", () => {
  it("says the API is ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.app).toBe("BizTrack API");
  });
});