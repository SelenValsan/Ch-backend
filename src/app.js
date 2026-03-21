const express = require("express");
const cors = require("cors");
require("dotenv").config();

const cookieParser = require("cookie-parser");
const authenticate = require("../middleware/authMiddleware");

const supplierRoutes = require("./routes/supplier.routes");
const transactionRoutes = require("./routes/transaction.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const authRoutes = require("./routes/auth.routes");

const prisma = require("./config/prisma");

const app = express();

/* ======================================================
   TRUST PROXY (REQUIRED FOR RENDER / HTTPS COOKIES)
   ====================================================== */

app.set("trust proxy", 1);

/* ======================================================
   CORS CONFIG
   ====================================================== */

const allowedOrigins = [
    "http://localhost:3000",
    "https://ch-vegetables.vercel.app",
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);

/* ======================================================
   BODY + COOKIE PARSER
   ====================================================== */

app.use(express.json());
app.use(cookieParser());

/* ======================================================
   PUBLIC ROUTES
   ====================================================== */

/* Health check for uptime robot */
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok1",
        server: "running",
        time: new Date(),
    });
});

/* Root route (public) */
app.get("/", (req, res) => {
    res.send("Khata Backend Running 🚀");
});

/* Auth routes (login / refresh / logout) */
app.use("/auth", authRoutes);

/* ======================================================
   🔐 PROTECTED ROUTES
   ====================================================== */

app.use(authenticate);

app.use("/suppliers", supplierRoutes);
app.use("/transactions", transactionRoutes);
app.use("/dashboard", dashboardRoutes);

/* ======================================================
   DB TEST (PROTECTED)
   ====================================================== */

app.get("/test-db", async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany();

        res.json({
            message: "Database connected successfully!",
            data: suppliers,
        });
    } catch (error) {
        res.status(500).json({ error: "Database connection failed" });
    }
});

/* ======================================================
   SERVER START
   ====================================================== */

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});