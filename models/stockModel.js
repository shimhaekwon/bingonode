// @models/stockModel.js
// stock_data 테이블 CRUD. data/stock.db 사용 (bingo와 분리).
// deprecated controllers/stockController.js의 SQLite 로직을 active 패턴으로 복원.
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../utils/logger.js');

const LOG = {
  err:  (...args) => logger.error('[stockModel:err]', ...args),
  info: (...args) => logger.info('[stockModel:info]', ...args),
};

const DB_PATH = process.env.STOCK_DB_PATH || path.join(__dirname, '..', 'data', 'stock.db');
const db = new sqlite3.Database(DB_PATH);

function execAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) { LOG.err('execAll:', err.message, 'SQL:', sql); return reject(err); }
      resolve(rows || []);
    });
  });
}
function execGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) { LOG.err('execGet:', err.message, 'SQL:', sql); return reject(err); }
      resolve(row || null);
    });
  });
}
function execRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) { LOG.err('execRun:', err.message, 'SQL:', sql); return reject(err); }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// 스키마 — deprecated controller가 사용하던 형식 그대로
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS stock_data (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker     TEXT NOT NULL,
    date       TEXT NOT NULL,
    open       REAL,
    high       REAL,
    low        REAL,
    close      REAL,
    volume     INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, date)
  )
`;

let _readyPromise = null;
function ensureReady() {
  if (!_readyPromise) {
    _readyPromise = execRun(SCHEMA_SQL).then(() => {
      LOG.info('stock_data schema ensured');
    }).catch((err) => {
      _readyPromise = null;
      LOG.err('schema init failed:', err && err.message);
      throw err;
    });
  }
  return _readyPromise;
}
ensureReady().catch(() => { /* logged above */ });

/**
 * 특정 ticker의 최근 N일 데이터 (oldest-first 반환).
 */
async function getRange(ticker, days = 365) {
  await ensureReady();
  const rows = await execAll(
    `SELECT date, open, high, low, close, volume
     FROM stock_data
     WHERE ticker = ?
     ORDER BY date DESC
     LIMIT ?`,
    [ticker, days]
  );
  return rows.reverse(); // 오래된 것 먼저
}

/**
 * ticker의 마지막(가장 최신) 날짜. 없으면 null.
 */
async function getMaxDate(ticker) {
  await ensureReady();
  const row = await execGet(
    `SELECT MAX(date) AS max_date FROM stock_data WHERE ticker = ?`,
    [ticker]
  );
  return row && row.max_date ? row.max_date : null;
}

/**
 * 일괄 upsert. INSERT OR REPLACE로 보정 이벤트(분할/배당)도 반영.
 * 전체를 단일 트랜잭션으로 묶어 fsync 비용을 N → 1로 절감.
 * 실패 시 ROLLBACK으로 부분 반영 방지.
 * @returns {{written: number}} - INSERT 또는 REPLACE된 행 수 (sqlite는 둘을 구분 안 함)
 */
async function upsertMany(ticker, rows) {
  await ensureReady();
  if (!Array.isArray(rows) || rows.length === 0) return { written: 0 };

  let written = 0;
  await execRun('BEGIN TRANSACTION');
  try {
    for (const r of rows) {
      if (!r || !r.date) continue;
      const result = await execRun(
        `INSERT OR REPLACE INTO stock_data (ticker, date, open, high, low, close, volume)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ticker, r.date, r.open, r.high, r.low, r.close, r.volume]
      );
      if (result.changes > 0) written++;
    }
    await execRun('COMMIT');
  } catch (err) {
    LOG.err('upsertMany rollback:', err && err.message);
    await execRun('ROLLBACK').catch(() => {});
    throw err;
  }
  return { written };
}

/**
 * 특정 ticker의 보유 행 수.
 */
async function getCount(ticker) {
  await ensureReady();
  const row = await execGet(
    `SELECT COUNT(*) AS cnt FROM stock_data WHERE ticker = ?`,
    [ticker]
  );
  return row ? row.cnt : 0;
}

module.exports = {
  ensureReady,
  getRange,
  getMaxDate,
  upsertMany,
  getCount,
};
