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
   COOKIE OPTIONS (LOCALHOST SAFE)
   ============================================================ */

const accessCookieOptions = {
    httpOnly: true,
    secure: false,      // local only (Render later → true)
    sameSite: "lax",    // ⭐ THE CORRECT VALUE
    path: "/",
    maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",    // ⭐ IMPORTANT
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};
/* ============================================================
   LOGIN
   ============================================================ */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        /* ---- CHECK USER ---- */
        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        /* ---- VERIFY PASSWORD ---- */
        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        /* ---- GENERATE TOKENS ---- */
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        /* ---- SAVE REFRESH TOKEN IN DB ---- */
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        /* ---- SET COOKIES ---- */
        res.cookie("accessToken", accessToken, accessCookieOptions);
        res.cookie("refreshToken", refreshToken, refreshCookieOptions);

        return res.json({
            message: "Login successful",
            user: { id: user.id, username: user.username },
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

        if (!refreshToken) {
            return res.status(401).json({ error: "No refresh token" });
        }

        /* ---- VERIFY REFRESH TOKEN ---- */
        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        /* ---- CHECK DATABASE ---- */
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ error: "Invalid refresh token" });
        }

        /* ---- ISSUE NEW ACCESS TOKEN ---- */
        const newAccessToken = generateAccessToken(user);

        res.cookie("accessToken", newAccessToken, accessCookieOptions);

        return res.json({ message: "Session refreshed" });

    } catch (error) {
        return res.status(403).json({ error: "Refresh token expired" });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            await prisma.user.updateMany({
                where: { refreshToken },
                data: { refreshToken: null },
            });
        }

        res.clearCookie("accessToken", accessCookieOptions);
        res.clearCookie("refreshToken", refreshCookieOptions);

        res.json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ error: "Logout failed" });
    }
});

module.exports = router;