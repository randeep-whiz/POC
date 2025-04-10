const { Op } = require("sequelize"); // Ensure Op is imported
const db = require("../models");
const ROLES = db.ROLES;
const User = db.users;

const checkDuplicateUsernameOrEmailUpdate = async (req, res, next) => {
  try {
    let id = req.body.id
    // Username
    let user = await User.findOne({
      where: {
        username: req.body.username,
        id: { [Op.ne]: id }
      }
    });
    if (user) {
      return res.status(400).send({
        message: "Failed! Username is already in use by another user!"
      });
    }
    // Email
    user = await User.findOne({
      where: {
        email: req.body.email,
        id: { [Op.ne]: id }
      }
    });
    if (user) {
      return res.status(400).send({
        message: "Failed! Email is already in use by another user!"
      });
    }
    next();
  } catch (error) {
    return res.status(500).send({
      message: "Unable to validate Username!"
    });
  }
};
module.exports = {checkDuplicateUsernameOrEmailUpdate};