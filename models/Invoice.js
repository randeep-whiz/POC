const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

module.exports = (sequelize, DataTypes) => {
    const Invoice = sequelize.define('Invoice', {
        invoice_number: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        vendor: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // Add any other fields you need
    },{
      sequelize,
      paranoid: true,
    
      // If you want to give a custom name to the deletedAt column
      deletedAt: 'destroyTime'
    });    
    return Invoice;
};

