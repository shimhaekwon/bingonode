const express = require('express');
const router = express.Router();

// /calc API: 숫자1, 숫자2, 연산자(+,-,*,/) 처리
router.post('/', (req, res) => {
  const { num1, num2, op } = req.body;

  let result;
  const a = parseFloat(num1);
  const b = parseFloat(num2);

  switch (op) {
    case '+':
      result = a + b;
      break;
    case '-':
      result = a - b;
      break;
    case '*':
      result = a * b;
      break;
    case '/':
      result = b !== 0 ? a / b : 'Error: Division by zero';
      break;
    default:
      result = 'Invalid operator';
  }

  res.json({ result });
});

module.exports = router;