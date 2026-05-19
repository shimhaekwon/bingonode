// routes/myapi/calc.js
const express = require('express');
const router = express.Router();

const apiController = require('@controllers/bingoController.js');

router.post('/getOne', apiController.getOne);
router.post('/getList', apiController.getList);
router.post('/getRecent', apiController.getRecent);
router.post('/sync', apiController.postSync);
// DISABLED: getPredict 컨트롤러가 미구현 서비스(generatePredictions)에 의존 →
// 호출 시 ReferenceError. 예측 엔진 구현 전까지 라우트 비활성화. (2026-05-19)
// router.post('/getPredict', apiController.getPredict);

module.exports = router;