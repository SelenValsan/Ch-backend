const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");

/* ============================================================
   CREATE TRANSACTION(S)
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
            items,
        } = req.body;

        const parsedSupplierId = parseInt(supplierId);

        let transactionsToCreate = [];

        /* =========================================
           MULTIPLE ITEMS SUPPORT
        ========================================= */

        if (items && Array.isArray(items) && items.length > 0) {
            transactionsToCreate = items.map((item) => ({
                supplierId: parsedSupplierId,
                type,
                itemName: item.itemName,
                quantity: item.quantity ? parseFloat(item.quantity) : null,
                pricePerUnit: item.pricePerUnit
                    ? parseFloat(item.pricePerUnit)
                    : null,
                amount:
                    item.quantity && item.pricePerUnit
                        ? parseFloat(item.quantity) * parseFloat(item.pricePerUnit)
                        : parseFloat(item.amount || 0),
                description: description || null,
                transactionDate: transactionDate
                    ? new Date(transactionDate)
                    : new Date(),
            }));
        } else {
            /* =========================================
               SINGLE ITEM (CURRENT SYSTEM)
            ========================================= */

            transactionsToCreate.push({
                supplierId: parsedSupplierId,
                type,
                itemName,
                quantity: quantity ? parseFloat(quantity) : null,
                pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null,
                amount: parseFloat(amount),
                description,
                transactionDate: transactionDate
                    ? new Date(transactionDate)
                    : new Date(),
            });
        }

        /* =========================================
           CALCULATE BALANCE CHANGE
        ========================================= */

        const totalAmount = transactionsToCreate.reduce(
            (sum, tx) => sum + tx.amount,
            0
        );

        const balanceChange =
            type === "PURCHASE" ? totalAmount : -totalAmount;

        /* =========================================
           DB TRANSACTION
        ========================================= */

        const result = await prisma.$transaction(async (tx) => {
            const createdTransactions = [];

            for (const data of transactionsToCreate) {
                const created = await tx.transaction.create({ data });
                createdTransactions.push(created);
            }

            await tx.supplier.update({
                where: { id: parsedSupplierId },
                data: {
                    balance: {
                        increment: balanceChange,
                    },
                },
            });

            return createdTransactions;
        });

        res.json({
            message: "Transaction(s) added successfully",
            transactions: result,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create transaction" });
    }
});

/* ============================================================
   DELETE TRANSACTION
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
   GET TRANSACTIONS
   ============================================================ */
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { type, supplierId, search, sort, from, to } = req.query;

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