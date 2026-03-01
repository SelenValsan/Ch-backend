const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
    generateAccessToken,
    generateRefreshToken,
} = require("../../utils/jwt");

/* ============================================================
   COOKIE CONFIG — AUTO SWITCH LOCAL <-> PRODUCTION
   ============================================================ */

const isProduction = process.env.NODE_ENV === "production";

const accessCookieOptions = {
    httpOnly: true,
    secure: isProduction,                     // HTTPS only in prod
    sameSite: isProduction ? "none" : "lax",  // cross-site only in prod
    path: "/",
    maxAge: 15 * 60 * 1000, // 15 minutes
};

const refreshCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/* ============================================================
   LOGIN
   ============================================================ */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // store refresh token in DB
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        // SET COOKIES
        res.cookie("accessToken", accessToken, accessCookieOptions);
        res.cookie("refreshToken", refreshToken, refreshCookieOptions);

        return res.json({
            message: "Login successful",
            user: {
                id: user.id,
                username: user.username,
            },
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Login failed" });
    }
});

/* ============================================================
   REFRESH ACCESS TOKEN
   ============================================================ */
router.post("/refresh", async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ error: "Invalid refresh token" });
        }

        const newAccessToken = generateAccessToken(user);

        res.cookie("accessToken", newAccessToken, accessCookieOptions);

        return res.json({ message: "Session refreshed" });

    } catch (error) {
        return res.status(403).json({ error: "Refresh token expired" });
    }
});

/* ============================================================
   LOGOUT
   ============================================================ */
router.post("/logout", async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            await prisma.user.updateMany({
                where: { refreshToken },
                data: { refreshToken: null },
            });
        }

        res.clearCookie("accessToken", {
            path: "/",
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        res.clearCookie("refreshToken", {
            path: "/",
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        res.json({ message: "Logged out successfully" });

    } catch (error) {
        res.status(500).json({ error: "Logout failed" });
    }
});

module.exports = router;