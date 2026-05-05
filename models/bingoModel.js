// @models/bingoModel.js
const { execAll, execGet, execRun } = require('@config/db.js');
const { BingoQueries } = require('@queries/bingoQueries.js');
const logger = require('../utils/logger.js');

const LOG = {
  err: (...args) => logger.error('[model:err]', ...args),
  info: (...args) => logger.info('[model:info]', ...args)
};

// 스키마 정의 — stock_data가 stockController.js에서 인라인으로 만드는 것과 동일 패턴
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS tb_bingo (
    seq        INTEGER PRIMARY KEY,
    no1        INTEGER NOT NULL,
    no2        INTEGER NOT NULL,
    no3        INTEGER NOT NULL,
    no4        INTEGER NOT NULL,
    no5        INTEGER NOT NULL,
    no6        INTEGER NOT NULL,
    no7        INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// 모듈 로드 시 1회 실행. 이후 모든 query 함수가 await으로 의존.
let _readyPromise = null;
function ensureReady() {
  if (!_readyPromise) {
    _readyPromise = execRun(SCHEMA_SQL).then(() => {
      LOG.info('tb_bingo schema ensured');
    }).catch((err) => {
      _readyPromise = null; // 다음 호출에서 재시도 허용
      LOG.err('schema init failed:', err && err.message);
      throw err;
    });
  }
  return _readyPromise;
}
// 부팅 직후 시작 (반환값은 무시)
ensureReady().catch(() => { /* logged above */ });

async function getList(limit = 99999, offset = 0) {
  try {
    await ensureReady();
    const rows = await execAll(BingoQueries.getList, [limit, offset]);
    const totalResult = await execGet(BingoQueries.getCount, []);
    const total = totalResult ? totalResult.cnt : 0;
    return { rows, total };
  } catch (error) {
    LOG.err('getList error:', error);
    throw error;
  }
}

async function getOne(seq) {
  try {
    await ensureReady();
    const row = await execGet(BingoQueries.getOne, [seq]);
    return row || null;
  } catch (error) {
    LOG.err('getOne error:', error);
    throw error;
  }
}

async function getRecent(rounds) {
  try {
    await ensureReady();
    const rows = await execAll(BingoQueries.getRecent, [rounds]);
    return rows;
  } catch (error) {
    LOG.err('getRecent error:', error);
    throw error;
  }
}

async function getCount(rounds) {
  try {
    await ensureReady();
    const rows = await execGet(BingoQueries.getCount, [rounds]);
    return rows;
  } catch (error) {
    LOG.err('getCount error:', error);
    throw error;
  }
}

async function getMaxSeq() {
  try {
    await ensureReady();
    const row = await execGet(BingoQueries.getMaxSeq, );
    return row || null;
  } catch (error) {
    LOG.err('getMaxSeq error:', error);
    throw error;
  }
};

async function setUpsert(seq, row) {
  try {
    await ensureReady();
    const params = [seq, row.no1, row.no2, row.no3, row.no4, row.no5, row.no6, row.no7];
    await execRun(BingoQueries.setUpsert, params);
    return true;
  } catch (error) {
    LOG.err('setUpsert error:', error);
    throw error;
  }
}

async function setUpdate(seq, row) {
  try {
    await ensureReady();
    const params = [row.no1, row.no2, row.no3, row.no4, row.no5, row.no6, row.no7 || null, seq];
    const result = await execRun(BingoQueries.setUpdate, params);
    return result.changes > 0;
  } catch (error) {
    LOG.err('setUpdate error:', error);
    throw error;
  }
}

async function setDelete(seq) {
  try {
    await ensureReady();
    const result = await execRun(BingoQueries.setDelete, [seq]);
    return result.changes > 0;
  } catch (error) {
    LOG.err('setDelete error:', error);
    throw error;
  }
}

module.exports = {
  ensureReady,
  getList,
  getOne,
  getCount,
  getRecent,
  getMaxSeq,
  setUpsert,
  setUpdate,
  setDelete,
};



// getRecent// @models/bingoModel.js

// const { getDb } = require('@config/db.js');
// const { BingoQueries } = require('@queries/bingoQueries.js');

// function setCreate(row) {
//   const db = getDb();
//   db.prepare(BingoQueries.insert).run(row);
// }

// function getOne(seq) {
//   const db = getDb();
//   const r = db.prepare(BingoQueries.getBySeq).get({ seq });
//   return r || null;
// }

// function getList(limit = 50, offset = 0) {
//   const db = getDb();
//   const rows = db.prepare(BingoQueries.listPaged).all({ limit, offset });
//   const total = db.prepare(BingoQueries.countAll).get().cnt;
//   return { rows, total };
// }

// function setUpdate(seq, row) {
//   const db = getDb();
//   const info = db.prepare(BingoQueries.updateBySeq).run({ ...row, seq });
//   return info.changes > 0;
// }

// function setRemove(seq) {
//   const db = getDb();
//   const info = db.prepare(BingoQueries.deleteBySeq).run({ seq });
//   return info.changes > 0;
// }

// function getRecent(rounds) {
//   const db = getDb();
//   return db.prepare(BingoQueries.recentHistory).all({ rounds });
// }

// module.exports = {
//   setCreate,
//   getOne,
//   getList,
//   setUpdate,
//   setRemove,
//   getRecent,
// };
