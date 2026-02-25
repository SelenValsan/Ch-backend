const jwt = require("jsonwebtoken");

/* ================= ACCESS TOKEN =================
   Short life (15 min)
   Used for every API request
*/
function generateAccessToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
    );
}

/* ================= REFRESH TOKEN =================
   Long life (7 days)
   Used to auto-login again
*/
function generateRefreshToken(user) {
    return jwt.sign(
        {
            id: user.id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" }
    );
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
};