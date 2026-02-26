// @models/bingoModel.js
const { execAll, execGet, execRun } = require('@config/db.js');
const { BingoQueries } = require('@queries/bingoQueries.js');

async function getList(limit = 99999, offset = 0) {
  try {
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
    const row = await execGet(BingoQueries.getOne, [seq]);
    return row || null;
  } catch (error) {
    LOG.err('getOne error:', error);
    throw error;
  }
}

async function getRecent(rounds) {
  try {
    const rows = await execAll(BingoQueries.getRecent, [rounds]);
    return rows;
  } catch (error) {
    LOG.err('getRecent error:', error);
    throw error;
  }
}

async function getCount(rounds) {
  try {
    const rows = await execGet(BingoQueries.getCount, [rounds]);
    return rows;
  } catch (error) {
    LOG.err('getRecent error:', error);
    throw error;
  }
}

async function getMaxSeq() {
  try {
    const row = await execGet(BingoQueries.getMaxSeq, );
    return row || null;
  } catch (error) {
    LOG.err('getOne error:', error);
    throw error;
  }
}

const LOG = {
  err: (...args) => console.error('[model:err]', ...args),
  info: (...args) => console.log('[model:info]', ...args)
};

async function setUpsert(seq, row) {
  try {
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
    const result = await execRun(BingoQueries.setDelete, [seq]);
    return result.changes > 0;
  } catch (error) {
    LOG.err('setDelete error:', error);
    throw error;
  }
}

module.exports = {
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
