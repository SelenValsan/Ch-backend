const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authenticate = require("../../middleware/authMiddleware");

/* ============================================================
   DASHBOARD (OPTIMIZED — NO TRANSACTION LOOPS)
   ============================================================ */
router.get("/", authenticate, async (req, res) => {
        try {

        /* ---------- COUNTS (FAST) ---------- */
        const [supplierCount, transactionCount] = await Promise.all([
            prisma.supplier.count(),
            prisma.transaction.count(),
        ]);

        /* ---------- TOTAL BALANCE (SUPER FAST) ---------- */
        const balanceAgg = await prisma.supplier.aggregate({
            _sum: { balance: true },
        });

        const totalBalance = balanceAgg._sum.balance || 0;

        /* ---------- TOP SUPPLIERS YOU OWE ---------- */
        const topSuppliers = await prisma.supplier.findMany({
            where: {
                balance: { gt: 0 }, // you owe them
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
            transactionCount,
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