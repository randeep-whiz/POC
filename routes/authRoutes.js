const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

const { verifySignUp } = require("../middleware");

router
    .post(
        "/signup",
        [
        verifySignUp.checkDuplicateUsernameOrEmail,
        verifySignUp.checkRolesExisted
        ],
        authController.signup
    )
router.post("/signin", authController.signin);
router.post("/signout", authController.signout);
module.exports = router



    