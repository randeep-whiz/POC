console.log(process.env.DB)
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(
    process.env.DB, 
    process.env.USER,
    process.env.PASSWORD, {
        host: process.env.HOST,
        dialect: process.env.dialect,
        operationsAliases: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.users = require("../models/User") (sequelize, Sequelize);
db.role = require("../models/Role") (sequelize, Sequelize);
db.invoice = require("../models/Invoice") (sequelize, Sequelize);
db.ROLES = ["user", "admin", "moderator"];
const Role = db.role;
const User = db.users;
const Invoice = db.invoice;

Role.belongsToMany(User, {
    through: "user_roles"
});
User.belongsToMany(Role, {
    through: "user_roles"
});


// function initial() {
//     Role.create({
//       id: 1,
//       name: "user"
//     });
   
//     Role.create({
//       id: 2,
//       name: "moderator"
//     });
   
//     Role.create({
//       id: 3,
//       name: "admin"
//     });
// }
// db.sequelize.sync().then(() => {
//     console.log("re-sync db.");
//     initial()
// });
module.exports = db;