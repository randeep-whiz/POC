require('dotenv').config()
const db = require("../models"); // models path depend on your structure
const User = db.users;
const Role = db.role;
const Op = db.Sequelize.Op;
const asyncHandler = require('express-async-handler')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');

// GET Method
const getAllUsers = asyncHandler(async (req, res) => {
    await User.findAll()
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving users."
      });
    });
})
// POST Method
const createNewUser = asyncHandler(async (req, res) => {
    const {username,password,roles,email,firstname,lastname,active} = req.body
    const hashedPassword = await bcrypt.hashSync(password, 8);
    const userObject = {username,password:hashedPassword,roles,email,firstname,lastname,active}
    const user = await User.create(userObject)

    if (req.body.roles && Role) {
        const rolesArray = Array.isArray(req.body.roles) ? req.body.roles : [req.body.roles];
        const rolesFound = await Role.findAll({
            where: {
                name: { [Op.or]: rolesArray },
            },
        });

        if (rolesFound.length !== rolesArray.length) {
            const foundRoles = rolesFound.map(role => role.name);
            const missingRoles = rolesArray.filter(role => !foundRoles.includes(role));

            return res.status(400).json({
                message: `Failed! Role does not exist = ${missingRoles.join(", ")}`,
            });
        }

        await user.setRoles(rolesFound);
    } else {
        await user.setRoles([1]);  // Default role
    }

    if(user){
        res.status(201).json({message:`New users ${username} created`})
    } else {
        res.status(400).json({message:`Invalid User data`})
    }

})

// Patch Method
const updateUser = asyncHandler(async (req, res) => {
    const {id,username,email} = req.body
    if(!id || !username || !email){
        return res.status(400).json({message:'All field are required.'})
    }
    const user = await User.findOne({ where: {id: id } })
    if(!user){
        return res.status(400).json({message:'User not found'})
    }
    User.update(req.body, {
        where: { id: id }
    })
    .then(num => {
      if (num == 1) {
        res.send({
          message: `User ${username} was updated successfully.`
        });
      } else {
        res.send({
          message: `Cannot update User with id=${id}. Maybe User was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating Tutorial with id=" + id
      });
    });
})
// Delete Method
const deleteUser = asyncHandler(async (req, res) => {
    const {id} = req.body
    
    if(!id){
        return res.status(400).json({message:'User ID Required'})
    }
    const user = await User.findOne({id:id})
    if(!user){
        return res.status(400).json({message:'User not found'})
    }
    await User.destroy({
        where: { id: id }
      }).then(num => {
      if (num == 1) {
        res.send({
          message: `User with ID ${id} has been deleted`
        });
      } else {
        res.send({
          message: `Cannot delete User with id=${id}. Maybe User was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating User with id=" + id
      });
    });
})

// const uniqueUser = asyncHandler(async (req, res) => {
//     let user = await User.findOne({
//       where: {
//         username: req.body.username
//       }
//     });
//     if (user) {
//       return res.status(200).json({statusCode:1});
//     } else {
//       return res.status(200).send({statusCode:0});
//     }
// })
// const uniqueEmail = asyncHandler(async (req, res) => {
//     // Email
//     let email = await User.findOne({
//       where: {
//         email: req.body.email
//       }
//     });
//     if (email) {
//       return res.status(200).send({statusCode:1});
//     } else {
//       return res.status(200).send({statusCode:0});
//     }
// })

//module.exports = { getAllUsers, createNewUser, updateUser, deleteUser, uniqueEmail,uniqueUser}
module.exports = { getAllUsers, createNewUser, updateUser, deleteUser}