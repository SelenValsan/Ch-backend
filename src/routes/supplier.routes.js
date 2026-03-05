const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");

/* ============================================================
   CREATE SUPPLIER (WITH OLD BALANCE SUPPORT)
   ============================================================ */
router.post("/", async (req, res) => {
    try {
        const { name, phone, note, oldBalance } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Supplier name is required" });
        }

        const supplier = await prisma.supplier.create({
            data: {
                name,
                phone,
                note,
                balance: oldBalance ? parseFloat(oldBalance) : 0,
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
   GET ALL SUPPLIERS
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
   SUPPLIER SUMMARY
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
   SUPPLIER LIST (FOR DROPDOWN)
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
   SUPPLIER LEDGER
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

        const transactions = await prisma.transaction.findMany({
            where: { supplierId },
            orderBy: { transactionDate: "asc" },
            select: {
                id: true,
                type: true,
                itemName: true,
                quantity: true,
                pricePerUnit: true,
                description: true,
                amount: true,
                transactionDate: true,
            },
        });

        res.json({
            supplier,
            openingBalance: supplier.balance,
            transactions,
            totalTransactions: transactions.length,
            currentBalance: supplier.balance,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch supplier ledger" });
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

/* ============================================================
   DELETE SUPPLIER
   ============================================================ */
router.delete("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        await prisma.supplier.delete({
            where: { id },
        });

        res.json({
            message: "Supplier deleted successfully",
        });

    } catch (error) {
        console.error(error);

        if (error.code === "P2003") {
            return res.status(400).json({
                error: "Cannot delete supplier. Transactions exist for this supplier.",
            });
        }

        res.status(500).json({ error: "Failed to delete supplier" });
    }
});

module.exports = router;