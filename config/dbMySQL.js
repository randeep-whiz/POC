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


const connectDBSQL = async () => {
    try{
        await sequelize.authenticate();
        console.log('Mysql Connection has been established successfully.');
    } catch(err) {
        console.log(err)
    }
}

module.exports = connectDBSQL