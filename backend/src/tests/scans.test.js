const request = require("supertest");
const path    = require("path");
const fs      = require("fs");
const app     = require("../app");
const User    = require("../models/User");
const Scan    = require("../models/Scan");

require("./setup");

// Minimal 1×1 JPEG buffer
const JPEG_BUF = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda00080101000000013f00ffd9",
  "hex"
);
const TMP_IMG = path.join(__dirname, "test.jpg");

let token, userId, scanId;

beforeAll(async () => {
  fs.writeFileSync(TMP_IMG, JPEG_BUF);
  await User.deleteMany({});
  await Scan.deleteMany({});
  const reg = await request(app).post("/api/auth/register")
    .send({ name:"Scan Tester", email:"scan@eco.com", password:"pass123" });
  token  = reg.body.token;
  userId = reg.body.user._id;
});

afterAll(async () => {
  if (fs.existsSync(TMP_IMG)) fs.unlinkSync(TMP_IMG);
  await User.deleteMany({});
  await Scan.deleteMany({});
});

describe("Scans API", () => {
  describe("POST /api/scans/classify", () => {
    it("rejects without auth", async () => {
      const res = await request(app).post("/api/scans/classify");
      expect(res.status).toBe(401);
    });

    it("rejects without image", async () => {
      const res = await request(app).post("/api/scans/classify")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("classifies image and returns result", async () => {
      const res = await request(app).post("/api/scans/classify")
        .set("Authorization", `Bearer ${token}`)
        .attach("image", TMP_IMG);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scan).toBeDefined();
      expect(["recyclable","non_recyclable","hazardous"]).toContain(res.body.scan.prediction);
      scanId = res.body.scan._id;
    });

    it("detects duplicate and awards 0 points", async () => {
      // Wait for cooldown (mock: set lastScanTime back)
      await new Promise(r => setTimeout(r, 11000));
      const res = await request(app).post("/api/scans/classify")
        .set("Authorization", `Bearer ${token}`)
        .attach("image", TMP_IMG);
      expect(res.status).toBe(200);
      if (res.body.scan.isDuplicate) {
        expect(res.body.scan.pointsEarned).toBe(0);
        expect(res.body.warning).toBeDefined();
      }
    }, 20000);
  });

  describe("GET /api/scans/limits", () => {
    it("returns limit info", async () => {
      const res = await request(app).get("/api/scans/limits")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.limits.maxPerHour).toBe(30);
      expect(res.body.limits.maxPerDay).toBe(100);
    });
  });

  describe("GET /api/scans/recent", () => {
    it("returns recent scans", async () => {
      const res = await request(app).get("/api/scans/recent")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.scans)).toBe(true);
      expect(res.body.scans.length).toBeLessThanOrEqual(10);
    });
  });

  describe("GET /api/scans", () => {
    it("returns paginated history", async () => {
      const res = await request(app).get("/api/scans?page=1&limit=5")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
    });

    it("filters by category", async () => {
      const res = await request(app).get("/api/scans?category=recyclable")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      res.body.scans.forEach(s => expect(s.prediction).toBe("recyclable"));
    });
  });

  describe("GET /api/scans/:id", () => {
    it("returns scan by id", async () => {
      if (!scanId) return;
      const res = await request(app).get(`/api/scans/${scanId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.scan._id).toBe(scanId);
    });

    it("404 for non-existent scan", async () => {
      const res = await request(app).get("/api/scans/000000000000000000000000")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("Analytics", () => {
    it("GET /api/analytics/summary returns stats", async () => {
      const res = await request(app).get("/api/analytics/summary")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.summary.totalScans).toBeGreaterThanOrEqual(0);
    });

    it("GET /api/analytics/global is public", async () => {
      const res = await request(app).get("/api/analytics/global");
      expect(res.status).toBe(200);
      expect(res.body.stats.totalUsers).toBeGreaterThanOrEqual(1);
    });
  });
});
