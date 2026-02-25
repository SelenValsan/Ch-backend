const express = require("express");
const cors = require("cors");
require("dotenv").config();

const cookieParser = require("cookie-parser");
const authenticate = require("../middleware/authMiddleware"); // ⭐ IMPORTANT

const supplierRoutes = require("./routes/supplier.routes");
const transactionRoutes = require("./routes/transaction.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const authRoutes = require("./routes/auth.routes");

const prisma = require("./config/prisma");

const app = express();

/* ======================================================
   CORS CONFIG (CRITICAL FOR COOKIES)
   ====================================================== */
app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true,
    })
);

/* BODY PARSER */
app.use(express.json());

/* COOKIE PARSER */
app.use(cookieParser());

/* ======================================================
   PUBLIC ROUTES (NO LOGIN REQUIRED)
   ====================================================== */
app.use("/auth", authRoutes);

/* ======================================================
   🔐 GLOBAL AUTHENTICATION WALL
   Everything below this requires login
   ====================================================== */
app.use(authenticate);

/* ======================================================
   PRIVATE ROUTES (PROTECTED)
   ====================================================== */
app.use("/suppliers", supplierRoutes);
app.use("/transactions", transactionRoutes);
app.use("/dashboard", dashboardRoutes);

/* ROOT */
app.get("/", (req, res) => {
    res.send("Khata Backend Running 🚀");
});

/* DB TEST (also protected now) */
app.get("/test-db", async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany();
        res.json({
            message: "Database connected successfully!",
            data: suppliers,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Database connection failed" });
    }
});

const PORT = process.env.PORT || 5050;

/* IMPORTANT for cookies behind Render proxy */
app.set("trust proxy", 1);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});