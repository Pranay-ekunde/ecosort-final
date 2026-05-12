const request = require("supertest");
const app     = require("../app");
const User    = require("../models/User");

require("./setup");

describe("Auth API", () => {
  beforeEach(() => User.deleteMany({}));

  describe("POST /api/auth/register", () => {
    it("registers and returns token + 50 welcome points", async () => {
      const res = await request(app).post("/api/auth/register")
        .send({ name:"Test User", email:"test@eco.com", password:"pass123" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.points).toBe(50);
    });

    it("rejects duplicate email", async () => {
      await request(app).post("/api/auth/register")
        .send({ name:"A", email:"dup@eco.com", password:"pass123" });
      const res = await request(app).post("/api/auth/register")
        .send({ name:"B", email:"dup@eco.com", password:"pass123" });
      expect(res.status).toBe(400);
    });

    it("rejects missing fields", async () => {
      const res = await request(app).post("/api/auth/register")
        .send({ email:"x@y.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    let token;
    beforeEach(async () => {
      await request(app).post("/api/auth/register")
        .send({ name:"Login User", email:"login@eco.com", password:"pass123" });
    });

    it("logs in with correct credentials", async () => {
      const res = await request(app).post("/api/auth/login")
        .send({ email:"login@eco.com", password:"pass123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      token = res.body.token;
    });

    it("rejects wrong password", async () => {
      const res = await request(app).post("/api/auth/login")
        .send({ email:"login@eco.com", password:"wrong" });
      expect(res.status).toBe(401);
    });

    it("rejects non-existent email", async () => {
      const res = await request(app).post("/api/auth/login")
        .send({ email:"nobody@eco.com", password:"pass123" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    let token;
    beforeEach(async () => {
      const res = await request(app).post("/api/auth/register")
        .send({ name:"Me User", email:"me@eco.com", password:"pass123" });
      token = res.body.token;
    });

    it("returns user with valid token", async () => {
      const res = await request(app).get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("me@eco.com");
      expect(res.body.user.password).toBeUndefined();
    });

    it("rejects no token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("rejects invalid token", async () => {
      const res = await request(app).get("/api/auth/me")
        .set("Authorization", "Bearer badtoken123");
      expect(res.status).toBe(401);
    });
  });
});
