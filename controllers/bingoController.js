// routes/myapi/bingo.controller.cjs (또는 .js 이지만 CJS로 로드되어야 함)
// ------- Zod (CommonJS 방식) -------
const zmod = require('zod');
const z = zmod.z || zmod;

// ------- Models / Services (module-alias 사용) -------
// const {
//   setCreateModel,
//   getOneModel,
//   getListModel,
//   setUpdateModel,
//   setUpsertModel,
//   getRecentModel
// } = require('@models/bingoModel.js');

const bingoModel = require('@models/bingoModel.js');
const bingoService = require('@services/bingoService.js');

// (calController 스타일 로깅 유틸—없으면 주석 처리하세요)
const util = require('@utils/util.js');

// ------- Validation Schemas -------
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

const seqOnlySchema = z.object({
  seq: z.number().int().nonnegative()
});

const listSchema = z.object({
  limit: z.number().int().min(1).max(99999).default(50),
  offset: z.number().int().min(0).default(0)
});

const updateSchema = insertSchema.omit({ seq: true });

// ------- Controller (모든 핸들러는 POST + body만 사용) -------
const bingoController = {

  postSync: async (req, res) => {
    try {
      const result = await bingoService.syncLatest();
      // 202 Accepted (비동기 작업 개시/진행) or 200 OK (즉시 완료) 중 택1
      // 여기서는 항상 202로 응답(프론트는 비동기 진행으로 이해)
      return res.status(202).json({ ok: true, ...result });
    } catch (err) {
      console.error('[bingoController] sync error:', err);
      return res.status(500).json({ ok: false, message: 'sync failed' });
    }
  },

  // POST /api/bingo/getList  { limit?:number, offset?:number }
  getList: async (req, res) => {
    try {
      util?.methodLog?.('bingoController.getList',req);
      const parsed = listSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        console.log('ZOD ERROR:', parsed.error.format());  // ← 상세 에러 출력
        return res.status(400).json({
          message: 'Invalid payload',
          errors: parsed.error.flatten(),
          details: parsed.error.format()  // ← 클라이언트에도 상세 정보
        });
      }
      const { limit, offset } = parsed.data;
      const { rows, total } = await bingoModel.getList(limit, offset);
      return res.json({ rows, total, limit, offset });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },

  // POST /api/bingo/getOne  { seq:number }  
  // getOne 예시
  getOne: async (req, res) => {
    try {
      util?.methodLog?.('bingoController.getOne');
      const parsed = seqOnlySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid payload',
          errors: parsed.error.flatten()
        });
      }
      const row = await bingoModel.getOne(parsed.data.seq);  // ← await 추가
      if (!row) return res.status(404).json({ message: 'Not found' });
      return res.json(row);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },

  // POST /api/bingo/getRecent  { limit?:number, offset?:number }
  getRecent: async (req, res) => {
    try {
      util?.methodLog?.('bingoController.getRecent',req);
      const parsed = listSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        console.log('ZOD ERROR:', parsed.error.format());  // ← 상세 에러 출력
        return res.status(400).json({
          message: 'Invalid payload',
          errors: parsed.error.flatten(),
          details: parsed.error.format()  // ← 클라이언트에도 상세 정보
        });
      }
      const { limit, offset } = parsed.data;
      const { rows, total } = await bingoModel.getRecent(limit, offset);
      return res.json({ rows, total, limit, offset });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },

  // POST /api/bingo/update  { seq:number, data:{ no1..no7? } }
  setUpsert: async (req, res) => {
    try {
      util?.methodLog?.('bingoController.setUpsert');
      // body: { seq, ...fields }
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: 'Invalid payload' });
      }
      const head = seqOnlySchema.safeParse({ seq: req.body.seq });
      const tail = updateSchema.safeParse({ ...req.body, seq: undefined });

      if (!head.success || !tail.success) {
        return res.status(400).json({
          message: 'Invalid payload',
          errors: {
            seq: head.success ? undefined : head.error.flatten(),
            data: tail.success ? undefined : tail.error.flatten()
          }
        });
      }
      const ok = await bingoModel.setUpsert(head.data.seq, tail.data);
      if (!ok) return res.status(404).json({ message: 'Not found' });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },

  getPredict: async (req, res) => {
    try {
      util?.methodLog?.('bingoController.getPredict');

      const raw = req.body ?? {};
      const historyRounds = Number.isFinite(raw.historyRounds) ? raw.historyRounds : 30;
      const excludeCurrent = raw.excludeCurrentFromWindow ?? true;

      // 1) 최신 회차 조회
      // getRecent(limit, offset) 가 "최신 → 오래된" 순으로 반환한다고 가정
      const { rows: latestRows } = await getRecent(1, 0);
      if (!latestRows || latestRows.length === 0) {
        return res.status(500).json({ message: 'No history rows available' });
      }
      const latestSeq = latestRows[0].seq; // 도메인 필드명: seq
      let targetRound = raw.targetRound ?? latestSeq;

      // 2) targetRound 유효성 점검 (선택) - 존재하지 않으면 최신으로 보정
      try {
        const chk = await getOne(targetRound);
        if (!chk) targetRound = latestSeq;
      } catch (_) {
        targetRound = latestSeq;
      }

      // 3) offset/limit 계산
      // 최신이 seq=latestSeq, 최신 다음이 offset=1 이라고 가정
      // excludeCurrent=true 이면 기준회차 바로 이전부터 N개, false면 기준회차 포함 N개
      let baseOffset = Math.max(0, (latestSeq - targetRound)); // 음수 방지
      const offset = Math.max(0, baseOffset + (excludeCurrent ? 1 : 0));
      const limit = Math.max(
        historyRounds,
        (raw.nonExposedRounds ?? 0) + 1 // 최근 미노출 계산 여유치
      );

      const { rows: historySlice } = await getRecent(limit, offset);

      // 4) 서비스 옵션 구성
      const options = {
        ...raw,
        // 회차 필드명이 'seq' 이므로 명시 (서비스 기본은 'round')
        roundField: 'seq',
        // 컨트롤러가 정확한 윈도우를 만들어 주므로 재슬라이싱 방지
        useWindowedHistory: false,
        historyIsNewestFirst: true,
        targetRound,
        history: historySlice
      };

      const result = await generatePredictions(options);

      return res.json({
        ...result,
        uiHints: {
          table: { columnLines: true, hoverHighlight: true },
          exposure: {
            sets: result.options.setCount,
            perSet: result.options.numbersPerSet,
            total: result.options.setCount * result.options.numbersPerSet
          },
          windowInfo: result.windowInfo // 디버깅/검증 편의
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },  

};

module.exports = bingoController;