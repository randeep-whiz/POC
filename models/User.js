const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("User", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          firstName: {
            type: Sequelize.STRING,
            allowNull: true
          },
          lastName: {
            type: Sequelize.STRING,
            allowNull: true
          },
          username: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
          },
          email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
          },
          password: {
            type: Sequelize.STRING,
            allowNull: false
          },
          active: {
            type: Sequelize.INTEGER,
            allowNull: false
          }
    },{
      sequelize,
      paranoid: true,
    
      // If you want to give a custom name to the deletedAt column
      deletedAt: 'destroyTime'
    });
    User.addScope('active', {
      where: { active:1 },
    });
    return User;
};

