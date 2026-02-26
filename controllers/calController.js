const util = require('@utils/util.js');
const apiController = {
  getResult: async(req, res) => {
    try {
      util.methodLog('calController.getResult');
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
    }
    catch (error) {
      LOG.err(error);
      res.status(500).json({ error: error.message });
    }
  }
  ,
  getRandom: async(req, res) => {    
    try {
      util.methodLog('calController.getRandom');  
      const min = Number(req.query.min ?? 0);
      const max = Number(req.query.max ?? 100);
      const asFloat = String(req.query.float ?? 'false').toLowerCase() === 'true';

      // 안전장치
      const lo = Number.isFinite(min) ? min : 0;
      const hi = Number.isFinite(max) ? max : 100;
      const aMin = Math.min(lo, hi);
      const aMax = Math.max(lo, hi);

      const rand = () => Math.random() * (aMax - aMin) + aMin;

      if (asFloat) {
        const num1 = Number(rand().toFixed(2));
        const num2 = Number(rand().toFixed(2));
        return res.json({ num1, num2 });
      } else {
        const num1 = Math.floor(rand());
        const num2 = Math.floor(rand());
        return res.json({ num1, num2 });
      }

    }
    catch (error) {
      LOG.err(error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = apiController;