const express = require('express');
const path = require('path');
const router = express.Router();

// GET /myapi/callCal -> calc.html 반환
router.get('/callCalc', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'myviews', 'calc.html'));
});

module.exports = router;
