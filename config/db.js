// @config/db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(DB_PATH);

// Promise 래퍼들 (완전 재작성)
function execAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function(err, rows) {  // ← function 사용 (arrow function 아님)
      if (err) {
        console.error('execAll error:', err.message);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

function execGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function(err, row) {  // ← function 사용
      if (err) {
        console.error('execGet SQL:', sql);
        console.error('execGet error:', err.message);
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

function execRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {  // ← function 사용 (this 사용)
      if (err) {
        console.error('execRun error:', err.message);
        return reject(err);
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
