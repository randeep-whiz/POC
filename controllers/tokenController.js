require('dotenv').config()
const jwt = require("jsonwebtoken");

exports.verifiedToken = async (req, res, next) => {
  try {
    let token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Access Denied" });

    if (token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    const jwtSecretKey = process.env.JWT_SECRET;
    const verified = jwt.verify(token, jwtSecretKey);

    if (!verified) {
      return res.status(401).json({ message: "Invalid Token" });
    }

    if (verified.user.active !== 1) {
      return res.status(401).json({ message: "You are not an active user." });
    }

    const allowedRoles = [1, 2, 3]; // Define allowed role IDs
    const userRoles = verified.user.roles.map(role => role.id);

    if (!userRoles.some(roleId => allowedRoles.includes(roleId))) {
      return res.status(403).json({ message: "Not Authorized" });
    }

    req.user = verified.user;
    //next(); 
    return res.status(200).send(verified);
  } catch (err) {
    return res.status(400).json({ message: "Invalid Token" });
  }
};
const generateTokens = (user) => {
    console.log(user)
  const jwtSecretKey = process.env.JWT_SECRET;
  const refreshSecretKey = process.env.JWT_REFRESH_SECRET; // New refresh key

  const accessToken = jwt.sign({ id: user.id, active: 1, user }, jwtSecretKey, { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: process.env.JWT_EXPIRATION_TIME });
  const refreshToken = jwt.sign({ id: user.id, user }, refreshSecretKey, { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: process.env.JWT_REFRESH_EXPIRATION });

  return { accessToken, refreshToken };
};
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });

    const refreshSecretKey = process.env.JWT_REFRESH_SECRET;
    const verified = jwt.verify(refreshToken, refreshSecretKey);
    if (!verified) return res.status(403).json({ message: "Invalid Refresh Token" });    
    // Generate new tokens
    const tokens = generateTokens(verified.user);
    res.status(200).json(tokens);
  } catch (err) {
    res.status(400).json({ message: "Refresh Token Expired or Invalid" });
  }
};
