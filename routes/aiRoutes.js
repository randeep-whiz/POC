const express = require('express')
const router = express.Router()
const aiController = require('../controllers/aiController')

router
    .get(
        "/gemini",
        aiController.gemini
    )
router
    .get(
        "/listModels",
        aiController.listModels
    )

    
module.exports = router