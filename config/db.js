// @config/db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const LOG = {
  err: (...args) => console.error('[db:err]', ...args),
  info: (...args) => console.log('[db:info]', ...args)
};

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(DB_PATH);

// Promise 래퍼들 (완전 재작성)
function execAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function(err, rows) {  // ← function 사용 (arrow function 아님)
      if (err) {
        LOG.err('execGet SQL:', sql);
        LOG.err('execAll error:', err.message);
        return reject(err);
      }else {        
        console.log('execGet SQL:', sql);
      }
      resolve(rows || []);
    });
  });
}

function execGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function(err, row) {  // ← function 사용
      if (err) {
        LOG.err('execGet SQL:', sql);
        LOG.err('execGet error:', err.message);
        return reject(err);
      }else {        
        console.log('execGet SQL:', sql);
      }
      resolve(row || null);
    });
  });
}

function execRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {  // ← function 사용 (this 사용)
      if (err) {
        LOG.err('execGet SQL:', sql);
        LOG.err('execRun error:', err.message);
        return reject(err);
      }else {        
        console.log('execGet SQL:', sql);
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

module.exports = {
  execAll,
  execGet,
  execRun,
};
