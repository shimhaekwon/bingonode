const { getDb } = '@config/db.js';
const { BingoQueries } = '@queries/bingo.queries.js';

export function createBingo(row) {
  const db = getDb();
  db.prepare(BingoQueries.insert).run(row);
}

export function getBingoBySeq(seq) {
  const db = getDb();
  const r = db.prepare(BingoQueries.getBySeq).get({ seq });
  return r || null;
}

export function listBingoPaged(limit = 50, offset = 0) {
  const db = getDb();
  const rows = db.prepare(BingoQueries.listPaged).all({ limit, offset });
  const total = db.prepare(BingoQueries.countAll).get().cnt;
  return { rows, total };
}

export function updateBingoBySeq(seq, row) {
  const db = getDb();
  const info = db.prepare(BingoQueries.updateBySeq).run({ ...row, seq });
  return info.changes > 0;
}

export function deleteBingoBySeq(seq) {
  const db = getDb();
  const info = db.prepare(BingoQueries.deleteBySeq).run({ seq });
  return info.changes > 0;
}

export function getRecentHistory(rounds) {
  const db = getDb();
  return db.prepare(BingoQueries.recentHistory).all({ rounds });
}


module.exports = {createBingo, getBingoBySeq, listBingoPaged, updateBingoBySeq, deleteBingoBySeq, getRecentHistory};