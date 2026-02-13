// routes/myapi/calc.js
const express = require('express');
const router = express.Router();

const apiController = require('@controllers/bingoController.js');

router.post('/getOne', apiController.getOne);
router.post('/getList', apiController.getList);
router.post('/sync', apiController.postSync);
router.post('/getPredict', apiController.getPredict);

module.exports = router;