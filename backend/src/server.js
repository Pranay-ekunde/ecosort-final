require("dotenv").config();
const app       = require("./app");
const connectDB = require("./utils/db");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`EcoSort backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}).catch((err) => {
  console.error("Failed to connect to database:", err.message);
  process.exit(1);
});
