const request = require("supertest");
const app     = require("../app");
const User    = require("../models/User");
const Coupon  = require("../models/Coupon");
const Reward  = require("../models/Reward");

require("./setup");

let token, userId;

beforeAll(async () => {
  await User.deleteMany({});
  await Coupon.deleteMany({});
  await Reward.deleteMany({});
  const reg = await request(app).post("/api/auth/register")
    .send({ name:"Reward Tester", email:"reward@eco.com", password:"pass123" });
  token  = reg.body.token;
  userId = reg.body.user._id;
  await User.findByIdAndUpdate(userId, { points: 1000 });
});

afterAll(async () => {
  await User.deleteMany({});
  await Coupon.deleteMany({});
  await Reward.deleteMany({});
});

describe("Rewards API", () => {
  describe("GET /api/rewards/balance", () => {
    it("returns balance and tier", async () => {
      const res = await request(app).get("/api/rewards/balance")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.balance.tier).toBeDefined();
      expect(res.body.balance.points).toBeGreaterThanOrEqual(0);
    });
    it("rejects unauthenticated", async () => {
      const res = await request(app).get("/api/rewards/balance");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/rewards", () => {
    it("returns reward history", async () => {
      const res = await request(app).get("/api/rewards")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.rewards)).toBe(true);
    });
  });
});

describe("Coupons API", () => {
  describe("GET /api/coupons/catalogue", () => {
    it("returns 10 coupons (public)", async () => {
      const res = await request(app).get("/api/coupons/catalogue");
      expect(res.status).toBe(200);
      expect(res.body.catalogue.length).toBe(10);
      expect(res.body.catalogue[0].pointsCost).toBeDefined();
    });
  });

  describe("POST /api/coupons/redeem", () => {
    it("rejects unauthenticated", async () => {
      const res = await request(app).post("/api/coupons/redeem")
        .send({ catalogueIndex: 0 });
      expect(res.status).toBe(401);
    });

    it("rejects invalid index", async () => {
      const res = await request(app).post("/api/coupons/redeem")
        .set("Authorization", `Bearer ${token}`)
        .send({ catalogueIndex: 999 });
      expect(res.status).toBe(400);
    });

    it("redeems cheapest coupon and deducts points", async () => {
      await User.findByIdAndUpdate(userId, { points: 1000 });
      const catRes = await request(app).get("/api/coupons/catalogue");
      const cheapIdx = catRes.body.catalogue.reduce(
        (mi, c, i) => c.pointsCost < catRes.body.catalogue[mi].pointsCost ? i : mi, 0
      );
      const res = await request(app).post("/api/coupons/redeem")
        .set("Authorization", `Bearer ${token}`)
        .send({ catalogueIndex: cheapIdx });
      expect(res.status).toBe(200);
      expect(res.body.coupon.code).toMatch(/^ECO-/);
      expect(res.body.newBalance).toBeLessThan(1000);
    });

    it("rejects when insufficient points", async () => {
      await User.findByIdAndUpdate(userId, { points: 0 });
      const res = await request(app).post("/api/coupons/redeem")
        .set("Authorization", `Bearer ${token}`)
        .send({ catalogueIndex: 0 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/points/i);
    });
  });

  describe("GET /api/coupons/my", () => {
    it("returns user coupons", async () => {
      const res = await request(app).get("/api/coupons/my")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.coupons)).toBe(true);
    });
    it("filters by status=active", async () => {
      const res = await request(app).get("/api/coupons/my?status=active")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      res.body.coupons.forEach(c => expect(c.isRedeemed).toBe(false));
    });
  });

  describe("POST /api/coupons/use/:code + validate", () => {
    let couponCode;
    beforeAll(async () => {
      await User.findByIdAndUpdate(userId, { points: 1000 });
      const catRes = await request(app).get("/api/coupons/catalogue");
      const res = await request(app).post("/api/coupons/redeem")
        .set("Authorization", `Bearer ${token}`)
        .send({ catalogueIndex: 0 });
      couponCode = res.body.coupon?.code;
    });

    it("validates active coupon", async () => {
      if (!couponCode) return;
      const res = await request(app).get(`/api/coupons/validate/${couponCode}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it("marks coupon as used", async () => {
      if (!couponCode) return;
      const res = await request(app).post(`/api/coupons/use/${couponCode}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.coupon.isRedeemed).toBe(true);
    });

    it("rejects using already-redeemed coupon", async () => {
      if (!couponCode) return;
      const res = await request(app).post(`/api/coupons/use/${couponCode}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("returns 404 for invalid code", async () => {
      const res = await request(app).get("/api/coupons/validate/INVALID-CODE-XYZ");
      expect(res.status).toBe(404);
    });
  });
});

describe("Leaderboard API", () => {
  it("GET /api/leaderboard returns rankings + userRank", async () => {
    const res = await request(app).get("/api/leaderboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
    expect(res.body.userRank).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/leaderboard/weekly works", async () => {
    const res = await request(app).get("/api/leaderboard/weekly")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });
});
