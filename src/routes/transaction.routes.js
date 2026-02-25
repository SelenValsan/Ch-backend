const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma"); // adjust if your prisma path is different


/* ============================================================
   CREATE TRANSACTION + UPDATE SUPPLIER BALANCE (LEDGER SAFE)
   ============================================================ */
router.post("/", async (req, res) => {
    try {
        const {
            supplierId,
            type,
            amount,
            itemName,
            quantity,
            pricePerUnit,
            description,
            transactionDate,
        } = req.body;

        const parsedSupplierId = parseInt(supplierId);
        const parsedAmount = parseFloat(amount);

        // determine balance effect
        const balanceChange =
            type === "PURCHASE" ? parsedAmount : -parsedAmount;

        /* ---------------- DB TRANSACTION ---------------- */
        const result = await prisma.$transaction(async (tx) => {

            // 1️⃣ create transaction
            const transaction = await tx.transaction.create({
                data: {
                    supplierId: parsedSupplierId,
                    type,
                    amount: parsedAmount,
                    itemName,
                    quantity: quantity ? parseFloat(quantity) : null,
                    pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null,
                    description,
                    transactionDate: transactionDate
                        ? new Date(transactionDate)
                        : new Date(),
                },
            });

            // 2️⃣ update supplier running balance
            await tx.supplier.update({
                where: { id: parsedSupplierId },
                data: {
                    balance: {
                        increment: balanceChange,
                    },
                },
            });

            return transaction;
        });

        res.json({
            message: "Transaction added successfully",
            transaction: result,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create transaction" });
    }
});

/* ============================================================
   GET TRANSACTIONS (FULL FILTER + PAGINATION)
   ============================================================ */
router.get("/", async (req, res) => {
    try {
        /* ---------- QUERY PARAMS ---------- */
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const {
            type,
            supplierId,
            search,
            sort,
            from,
            to,
        } = req.query;

        /* ---------- WHERE CLAUSE ---------- */
        let where = {};

        // TYPE FILTER
        if (type && type !== "ALL") {
            where.type = type;
        }

        // SUPPLIER FILTER
        if (supplierId) {
            where.supplierId = parseInt(supplierId);
        }

        // ITEM SEARCH
        if (search) {
            where.itemName = {
                contains: search,
                mode: "insensitive",
            };
        }

        // DATE RANGE
        if (from || to) {
            where.transactionDate = {};

            if (from) {
                where.transactionDate.gte = new Date(from);
            }

            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                where.transactionDate.lte = toDate;
            }
        }

        /* ---------- SORTING ---------- */
        let orderBy = {
            transactionDate: "desc", // default latest first
        };

        if (sort === "asc" || sort === "desc") {
            orderBy = {
                amount: sort,
            };
        }

        /* ---------- TOTAL COUNT ---------- */
        const total = await prisma.transaction.count({ where });

        /* ---------- FETCH DATA ---------- */
        const transactions = await prisma.transaction.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
        });

        /* ---------- RESPONSE ---------- */
        res.json({
            data: transactions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

module.exports = router;