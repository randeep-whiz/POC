const jwt = require("jsonwebtoken");
const db = require("../models");
const User = db.users;

const verifyToken = (req, res, next) => {
  let token = req.header('Authorization');
    
  // Tokens are generally passed in header of request
  // Due to security reasons.  
  if (token.startsWith('Bearer ')) {
      // Remove Bearer from string
      token = token.slice(7, token.length).trimLeft();
  }
  if (!token) {
    return res.status(403).send({
      message: "No token provided!",
    });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized!",
      });
    }
    req.userId = decoded.id;
    next();
  });
};
const isAdmin = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(400).json({ message: "User ID is missing in request!" });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const roles = await user.getRoles(); // Ensure `User` model supports this method
    if (!roles || roles.length === 0) {
      return res.status(403).json({ message: "User has no roles assigned!" });
    }

    for (let role of roles) {
      if (role.name === "admin") {
        return next();
      }
    }

    return res.status(403).json({ message: "Require Admin Role!" });
  } catch (error) {
    console.error("Error in isAdmin middleware:", error); // Debugging log
    return res.status(500).json({ message: "Unable to validate user role!" });
  }
};
const isModerator = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    const roles = await user.getRoles();
    for (let i = 0; i < roles.length; i++) {
      if (roles[i].name === "moderator") {
        return next();
      }
    }
    return res.status(403).send({
      message: "Require Moderator Role!",
    });
  } catch (error) {
    return res.status(500).send({
      message: "Unable to validate Moderator role!",
    });
  }
};
const isModeratorOrAdmin = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(400).json({ message: "User ID is missing in request!" });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const roles = await user.getRoles();
    console.log("User Roles:", roles.map(role => role.name)); // Debugging log

    if (roles.some(role => role.name === "moderator" || role.name === "admin")) {      
      return next(); // User is either moderator or admin
    }

    return res.status(403).json({ message: "Require Moderator or Admin Role!" });
  } catch (error) {
    console.error("Error in isModeratorOrAdmin middleware:", error);
    return res.status(500).json({ message: "Unable to validate Moderator or Admin role!" });
  }
};

const authJwt = {
  verifyToken,
  isAdmin,
  isModerator,
  isModeratorOrAdmin,
};
module.exports = authJwt;