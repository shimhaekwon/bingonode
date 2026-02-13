// routes/myapi/calc.js
const express = require('express');
const router = express.Router();

const apiController = require('@controllers/calController');

router.post('/calc', apiController.getResult);
router.post('/random', apiController.getRandom);

module.exports = router;