const express = require('express');
const betWorxController = require('../controllers/betWorxController');

const router = express.Router();

// Define the routes
router.get('/nhl', betWorxController.nhl);
router.get('/nba', betWorxController.nba);
router.get('/mlb', betWorxController.mlb);
router.get('/draftKings', betWorxController.draftKings);
router.get('/fantasyData', betWorxController.fantasyData);

module.exports = router;