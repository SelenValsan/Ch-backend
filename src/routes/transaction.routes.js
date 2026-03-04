const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");

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

        const balanceChange =
            type === "PURCHASE" ? parsedAmount : -parsedAmount;

        const result = await prisma.$transaction(async (tx) => {

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
   DELETE TRANSACTION + FIX SUPPLIER BALANCE
   ============================================================ */
router.delete("/:id", async (req, res) => {
    try {
        const transactionId = parseInt(req.params.id);

        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
        });

        if (!transaction) {
            return res.status(404).json({
                error: "Transaction not found",
            });
        }

        const balanceCorrection =
            transaction.type === "PURCHASE"
                ? -transaction.amount
                : transaction.amount;

        await prisma.$transaction(async (tx) => {

            await tx.transaction.delete({
                where: { id: transactionId },
            });

            await tx.supplier.update({
                where: { id: transaction.supplierId },
                data: {
                    balance: {
                        increment: balanceCorrection,
                    },
                },
            });
        });

        res.json({
            message: "Transaction deleted successfully",
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Failed to delete transaction",
        });
    }
});

/* ============================================================
   GET TRANSACTIONS (FULL FILTER + PAGINATION)
   ============================================================ */
router.get("/", async (req, res) => {
    try {

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

        let where = {};

        if (type && type !== "ALL") {
            where.type = type;
        }

        if (supplierId) {
            where.supplierId = parseInt(supplierId);
        }

        if (search) {
            where.itemName = {
                contains: search,
                mode: "insensitive",
            };
        }

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

        let orderBy = {
            transactionDate: "desc",
        };

        if (sort === "asc" || sort === "desc") {
            orderBy = {
                amount: sort,
            };
        }

        const total = await prisma.transaction.count({ where });

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