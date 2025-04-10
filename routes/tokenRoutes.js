const express = require('express')
const router = express.Router()
const tokenController = require('../controllers/tokenController')

router.get("/verifiedToken", tokenController.verifiedToken);
router.post("/refreshToken", tokenController.refreshToken);
module.exports = router



    