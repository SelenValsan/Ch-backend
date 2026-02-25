const jwt = require("jsonwebtoken");
const prisma = require("../src/config/prisma");

async function authenticate(req, res, next) {
    try {
        const accessToken = req.cookies.accessToken;

        /* ================= 1️⃣ ACCESS TOKEN EXISTS ================= */
        if (accessToken) {
            try {
                const decoded = jwt.verify(
                    accessToken,
                    process.env.ACCESS_TOKEN_SECRET
                );

                req.user = decoded;
                return next();
            } catch (err) {
                // access token expired -> continue to refresh flow
            }
        }

        /* ================= 2️⃣ TRY REFRESH TOKEN ================= */
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: "Unauthorized - Login required" });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch {
            return res.status(401).json({ error: "Session expired - Login again" });
        }

        // Check DB (prevents token theft reuse)
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ error: "Invalid session" });
        }

        /* ================= 3️⃣ ISSUE NEW ACCESS TOKEN ================= */
        const newAccessToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "15m" }
        );

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 15 * 60 * 1000,
        });

        req.user = {
            id: user.id,
            username: user.username,
        };

        next();

    } catch (error) {
        return res.status(401).json({ error: "Authentication failed" });
    }
}

module.exports = authenticate;