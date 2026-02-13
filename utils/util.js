// ./utils/util.js
const util = {
  /**
   * 간단 메서드 로거
   * @param {string} tag - 현재 메서드/컨텍스트 이름
   * @param {import('express').Request} [req] - (선택) Express 요청 객체
   */
  methodLog(tag, req = undefined) {
    try {
      // 공통 태그 출력
      console.log('Current Method :', tag);

      // req가 없으면 안전하게 종료
      if (!req) {
        console.log('REQ BODY: unknown (req is undefined)');
        return;
      }

      // body, query, params를 안전하게 로깅
      const hasBody = req.body !== undefined && req.body !== null;
      const hasQuery = req.query && Object.keys(req.query).length > 0;
      const hasParams = req.params && Object.keys(req.params).length > 0;

      if (hasBody) {
        console.log('REQ BODY:', req.body);
      } else {
        console.log('REQ BODY: (empty or undefined)');
      }

      if (hasQuery) {
        console.log('REQ QUERY:', req.query);
      }

      if (hasParams) {
        console.log('REQ PARAMS:', req.params);
      }
    } catch (err) {
      // 로깅 중 오류가 서비스 흐름을 막지 않도록
      console.warn('[methodLog] logging error:', err?.message);
    }
  },
};

module.exports = util;