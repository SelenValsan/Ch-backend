const jwt = require("jsonwebtoken");
const prisma = require("../src/config/prisma");

const isProduction = process.env.NODE_ENV === "production";

async function authenticate(req, res, next) {
    try {
        const accessToken = req.cookies.accessToken;

        /* ================= ACCESS TOKEN ================= */
        if (accessToken) {
            try {
                const decoded = jwt.verify(
                    accessToken,
                    process.env.ACCESS_TOKEN_SECRET
                );

                req.user = decoded;
                return next();

            } catch (err) {
                // expired -> continue to refresh flow
            }
        }

        /* ================= REFRESH TOKEN ================= */
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: "Unauthorized - Login required" });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        }

        catch {
            return res.status(401).json({ error: "Session expired - Login again" });
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ error: "Invalid session" });
        }

        /* ISSUE NEW ACCESS TOKEN */
        const newAccessToken = jwt.sign(
            { id: user.id, username: user.username },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "15m" }
        );

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
            maxAge: 15 * 60 * 1000,
        });

        req.user = { id: user.id, username: user.username };
        next();

    } catch (error) {
        console.error(error);
        return res.status(401).json({ error: "Authentication failed" });
    }
}

module.exports = authenticate;