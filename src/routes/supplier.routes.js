const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");

/* ============================================================
   CREATE SUPPLIER
   ============================================================ */
router.post("/", async (req, res) => {
    try {
        const { name, phone, note } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Supplier name is required" });
        }

        const supplier = await prisma.supplier.create({
            data: {
                name,
                phone,
                note,
            },
        });

        res.json({
            message: "Supplier created successfully",
            supplier,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create supplier" });
    }
});

/* ============================================================
   GET ALL SUPPLIERS (BASIC)
   ============================================================ */
router.get("/", async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            orderBy: { createdAt: "desc" },
        });

        res.json(suppliers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch suppliers" });
    }
});

/* ============================================================
   SUPPLIER SUMMARY (FAST — USES STORED BALANCE)
   ============================================================ */
router.get("/summary", async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            select: {
                id: true,
                name: true,
                phone: true,
                note: true,
                balance: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        res.json(suppliers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch supplier summary" });
    }
});

/* ============================================================
   SUPPLIER LIST (FOR DROPDOWNS)
   ============================================================ */
router.get("/list", async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        res.json(suppliers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch supplier list" });
    }
});

/* ============================================================
   SUPPLIER LEDGER (OPTIMIZED)
   ============================================================ */
router.get("/:id/ledger", async (req, res) => {
    try {
        const supplierId = parseInt(req.params.id);

        const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId },
            select: {
                id: true,
                name: true,
                phone: true,
                note: true,
                balance: true,
            },
        });

        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found" });
        }

        // chronological order (correct accounting order)
        const transactions = await prisma.transaction.findMany({
            where: { supplierId },
            orderBy: { transactionDate: "asc" },
        });

        // No recalculation anymore
        const ledger = transactions.map((tx) => ({
            id: tx.id,
            type: tx.type,
            itemName: tx.itemName,
            quantity: tx.quantity,
            pricePerUnit: tx.pricePerUnit,
            description: tx.description,
            amount: tx.amount,
            date: tx.transactionDate,
        }));

        res.json({
            supplier,
            totalTransactions: transactions.length,
            currentBalance: supplier.balance,
            ledger,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch ledger" });
    }
});

/* ============================================================
   UPDATE SUPPLIER
   ============================================================ */
router.put("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, phone, note } = req.body;

        const updated = await prisma.supplier.update({
            where: { id },
            data: { name, phone, note },
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update supplier" });
    }
});

module.exports = router;