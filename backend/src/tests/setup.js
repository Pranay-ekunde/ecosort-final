require("dotenv").config();
const mongoose = require("mongoose");

beforeAll(async () => {
  const uri = process.env.MONGODB_URI_TEST ||
              process.env.MONGODB_URI ||
              "mongodb://localhost:27017/ecosort_test";
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
