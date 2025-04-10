const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

module.exports = (sequelize, Sequelize) => {
    const Invoice = sequelize.define("Invoice", {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          invoice_number: {
            type: Sequelize.STRING,
            allowNull: true
          },
          amount: {
            type: Sequelize.FLOAT,
            allowNull: true
          },
          vendor: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
          },
    },{
      sequelize,
      paranoid: true,
    
      // If you want to give a custom name to the deletedAt column
      deletedAt: 'destroyTime'
    });    
    return Invoice;
};

