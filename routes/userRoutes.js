const express = require('express')
const router = express.Router()
const userController = require('../controllers/userController')

const { verifySignUp, verifyUser, authJwt } = require("../middleware");

router
    .get(
        "/get-users",
        [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
        userController.getAllUsers
    )

router
    .post(
        "/create",
        [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
        [
            verifySignUp.checkDuplicateUsernameOrEmail,
            verifySignUp.checkRolesExisted
        ],
        userController.createNewUser
    )

router
    .put(
        "/update",
        [authJwt.verifyToken, authJwt.isAdmin],
        [
            verifyUser.checkDuplicateUsernameOrEmailUpdate
        ],
        userController.updateUser
    )

router
    .delete(
        "/delete",
        [authJwt.verifyToken, authJwt.isAdmin],
        userController.deleteUser
    )

module.exports = router