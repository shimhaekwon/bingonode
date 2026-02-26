// ./utils/util.js
const LOG = {
  dbg: (...args) => console.log(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  err: (...args) => console.error(...args)
};

const util = {
  /**
   * 간단 메서드 로거
   * @param {string} tag - 현재 메서드/컨텍스트 이름
   * @param {import('express').Request} [req] - (선택) Express 요청 객체
   */
  methodLog(tag, req = undefined) {
    try {

        const stack = new Error().stack.split("\n");

        // stack[0] = "Error"
        // stack[1] = 현재 logWithCaller 함수
        // stack[2] = logWithCaller를 호출한 위치
        const callerInfo = stack[2].trim();

        LOG.dbg(`Current Method:[${callerInfo}], request.body:[${req&&req.body?JSON.stringify(req.body):"req is undefined"}]`);

    //   // 공통 태그 출력
    //   LOG.dbg('Current Method :', tag);

      // req가 없으면 안전하게 종료
      if (!req) {
        console.error('REQ BODY: unknown (req is undefined)');
        return;
      }

      // body, query, params를 안전하게 로깅
      const hasBody = req.body !== undefined && req.body !== null;
      const hasQuery = req.query && Object.keys(req.query).length > 0;
      const hasParams = req.params && Object.keys(req.params).length > 0;

      if (hasBody) {
        LOG.dbg('REQ BODY:', req.body);
      } else {
        LOG.dbg('REQ BODY: (empty or undefined)');
      }

      if (hasQuery) {
        LOG.dbg('REQ QUERY:', req.query);
      }

      if (hasParams) {
        LOG.dbg('REQ PARAMS:', req.params);
      }
    } catch (err) {
      // 로깅 중 오류가 서비스 흐름을 막지 않도록
      console.warn('[methodLog] logging error:', err?.message);
    }
  },
};

module.exports = util;