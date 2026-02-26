
// try {
//   // 기존: window.numChosen에 의존
//   // 변경: 서버에서 불러와 주입
//   window.numChosen = await fetchAllBingoAsNumChosen(1000);
//   prepareDataOnce();
//   if (!el.applyRound.value) el.applyRound.value = ROUND_MAX;
//   renderDataViewer();
// } catch (err) {
//   LOG.err(err);
//   appendLog("초기 데이터 로드 실패(서버). 필요 시 붙여넣기로 대체하세요.", "err");
// }
  /* ===================== 서버 연동 (모두 POST) ===================== */
  async function fetchAllBingoAsNumChosen(limit = 99999) {
    // 서버 /api/bingo/getList는 seq DESC로 리턴한다고 가정
    let offset = 0;
    const out = [];
    while (true) {
      const res = await fetch("/api/bingo/getList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, offset })
      });
      if (!res.ok) {
        throw new Error("failed to fetch /api/bingo/getList");
      }
      const data = await res.json();
      const rows = data?.rows ?? [];
      if (!rows.length) {
        break;
      }
      for (const r of rows) {
        out.push([r.seq, r.no1, r.no2, r.no3, r.no4, r.no5, r.no6, r.no7 ?? 0]);
      }
      offset += rows.length;
      if (rows.length < limit) {
        break;
      }
    }
    return out;
  }

(async () => {
  try {
    window.numChosen = await fetchAllBingoAsNumChosen(9999);
    document.dispatchEvent(new CustomEvent('numChosen:ready'));
  } catch (err) {
    LOG.err(err);
    document.dispatchEvent(new CustomEvent('numChosen:error', { detail: err }));
  }
})();