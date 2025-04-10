require('dotenv').config()
const db = require("../models"); // models path depend on your structure
const User = db.users;
const Role = db.role;
const Op = db.Sequelize.Op;
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken");

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

exports.signup = async (req, res) => {
  try {
    const { username, email, password, roles, active } = req.body;

    const hashedPassword = bcrypt.hashSync(password, 8);
    const user = await User.create({ username, email, password: hashedPassword, active });

    if (roles) {
      const foundRoles = await Role.findAll({ where: { name: roles } });
      await user.setRoles(foundRoles);
    } else {
      await user.setRoles([1]); // Default Role
    }
    res.status(201).json({
      message: "User registered successfully!"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.signin = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { email: req.body.email },
      include: [Role],
    });

    if (!user) return res.status(404).json({ message: "User Not Found." });

    const passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) return res.status(401).json({ message: "Invalid Password!" });
    
    const accessToken = jwt.sign(
      { id: user.id, active: user.active, user },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: process.env.JWT_EXPIRATION_TIME }
    );

    const refreshToken = jwt.sign(
      { id: user.id, active: user.active, user },
      process.env.JWT_REFRESH_SECRET,
      { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: process.env.JWT_REFRESH_EXPIRATION }
    );
    
    const roles = await user.getRoles();
    const authorities = roles.map(role => "ROLE_" + role.name.toUpperCase());

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: authorities,
      accessToken,
      refreshToken,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.signout = async (req, res) => {
  try {
    req.session = null;
    return res.status(200).send({
      message: "You've been signed out!"
    });
  } catch (err) {
    this.next(err);
  }
};