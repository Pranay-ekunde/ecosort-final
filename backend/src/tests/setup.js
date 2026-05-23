require("dotenv").config();
const mongoose = require("mongoose");

beforeAll(async () => {
  jest.setTimeout(30000);
  const uri = process.env.MONGODB_URI_TEST ||
              "mongodb://127.0.0.1:27017/ecosort_test";
  await mongoose.connect(uri);
});

afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase();
  } catch (e) {}
});
