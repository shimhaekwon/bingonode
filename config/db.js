// root/config/database.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mybatisMapper = require('mybatis-mapper');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(DB_PATH);

// 공통 실행기: SELECT( rows ), INSERT/UPDATE/DELETE( run )
function execAll(sql, params = []) {
  return new Promise((resolve) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[DB][all] error:', err);
        resolve({ success: false, message: 'db-error', data: null, error: err.message });
      } else {
        resolve({ success: true, message: 'success', data: rows, error: null });
      }
    });
  });
}

function execRun(sql, params = []) {
  return new Promise((resolve) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('[DB][run] error:', err);
        resolve({ success: false, message: 'db-error', data: null, error: err.message });
      } else {
        resolve({ success: true, message: 'success', data: { changes: this.changes, lastID: this.lastID }, error: null });
      }
    });
  });
}

// mybatis-mapper 로드 + SQL 생성 + 실행
const generateQuery = async (mapperPath, namespace, sqlId, parameters = {}) => {
  try {
    const xmlFilePath = path.resolve(__dirname, mapperPath);
    mybatisMapper.createMapper([xmlFilePath]);  // 필요한 시점에 매퍼 로드
    const format = { language: 'sql', indent: '  ' };
    const sql = mybatisMapper.getStatement(namespace, sqlId, parameters, format);

    // 간단 규칙: SELECT면 all, 아니면 run
    const isSelect = /^\s*select/i.test(sql);
    return isSelect ? execAll(sql, []) : execRun(sql, []);
  } catch (error) {
    console.error('[DB][generateQuery] error:', error);
    return { success: false, message: 'database-generateQuery-error', data: parameters, error: error.message };
  }
};

module.exports = { generateQuery };