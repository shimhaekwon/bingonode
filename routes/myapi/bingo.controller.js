// routes/myapi/bingo.controller.cjs  (또는 .js 이지만 CJS로 로드되어야 함)

// ---------- Zod (CommonJS 방식) ----------
const zmod = require('zod');
const z = zmod.z || zmod;

// ---------- Models / Services (module-alias 사용) ----------
const {
  createBingo,
  deleteBingoBySeq,
  getBingoBySeq,
  listBingoPaged,
  updateBingoBySeq,
  getRecentHistory
} = require('@models/bingo.model.js');

const { generatePredictions } = require('@services/bingo.service.js');

// ---------- Validation Schema ----------
const insertSchema = z.object({
  seq: z.number().int().nonnegative(),
  no1: z.number().int().min(1),
  no2: z.number().int().min(1),
  no3: z.number().int().min(1),
  no4: z.number().int().min(1),
  no5: z.number().int().min(1),
  no6: z.number().int().min(1),
  no7: z.number().int().min(1).nullable().optional()
});

// ---------- Controller ----------
const BingoController = {
  getOne: (req, res) => {
    const seq = Number(req.params.seq);
    const row = getBingoBySeq(seq);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  },

  list: (req, res) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 50), 200));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    const { rows, total } = listBingoPaged(limit, offset);
    res.json({ rows, total, limit, offset });
  },

  create: (req, res) => {
    const parsed = insertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid payload',
        errors: parsed.error.flatten()
      });
    }
    createBingo(parsed.data);
    res.status(201).json({ ok: true });
  },

  update: (req, res) => {
    const seq = Number(req.params.seq);
    const parsed = insertSchema.omit({ seq: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid payload',
        errors: parsed.error.flatten()
      });
    }
    const ok = updateBingoBySeq(seq, parsed.data);
    if (!ok) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  },

  remove: (req, res) => {
    const seq = Number(req.params.seq);
    const ok = deleteBingoBySeq(seq);
    if (!ok) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  },

  predict: (req, res) => {
    const result = generatePredictions(req.body ?? {});
    res.json({
      ...result,
      uiHints: {
        table: { columnLines: true, hoverHighlight: true },
        exposure: {
          sets: result.options.setCount,
          perSet: result.options.numbersPerSet
        }
      }
    });
  }
};

module.exports = BingoController;