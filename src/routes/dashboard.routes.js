const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authenticate = require("../../middleware/authMiddleware");

/* ============================================================
   DASHBOARD
   ============================================================ */
router.get("/", authenticate, async (req, res) => {
    try {

        /* ---------- COUNTS ---------- */
        const supplierCount = await prisma.supplier.count();

        /* ---------- TOTAL BALANCE ---------- */
        const balanceAgg = await prisma.supplier.aggregate({
            _sum: { balance: true },
        });

        const totalBalance = balanceAgg._sum.balance || 0;

        /* ---------- TODAY PURCHASE TOTAL ---------- */

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const todayAgg = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                type: "PURCHASE",
                transactionDate: {
                    gte: startOfToday,
                    lte: endOfToday,
                },
            },
        });

        const todayPurchaseTotal = todayAgg._sum.amount || 0;

        /* ---------- TOP SUPPLIERS YOU OWE ---------- */
        const topSuppliers = await prisma.supplier.findMany({
            where: {
                balance: { gt: 0 },
            },
            orderBy: {
                balance: "desc",
            },
            take: 3,
            select: {
                id: true,
                name: true,
                phone: true,
                balance: true,
            },
        });

        /* ---------- LATEST 5 TRANSACTIONS ---------- */
        const latestTransactions = await prisma.transaction.findMany({
            take: 5,
            orderBy: { transactionDate: "desc" },
            select: {
                id: true,
                type: true,
                amount: true,
                itemName: true,
                quantity: true,
                description: true,
                transactionDate: true,
                supplier: {
                    select: { name: true },
                },
            },
        });

        res.json({
            supplierCount,
            todayPurchaseTotal,
            totalBalance,
            topSuppliers,
            latestTransactions,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load dashboard" });
    }
});

module.exports = router;