
// try {
//   // 기존: window.numChosen에 의존
//   // 변경: 서버에서 불러와 주입
//   window.numChosen = await fetchAllBingoAsNumChosen(1000);
//   prepareDataOnce();
//   if (!el.applyRound.value) el.applyRound.value = ROUND_MAX;
//   renderDataViewer();
// } catch (err) {
//   console.error(err);
//   appendLog("초기 데이터 로드 실패(서버). 필요 시 붙여넣기로 대체하세요.", "err");
// }
(async () => {
  try {
    window.numChosen = await fetchAllBingoAsNumChosen(1000);
    document.dispatchEvent(new CustomEvent('numChosen:ready'));
  } catch (err) {
    console.error(err);
    document.dispatchEvent(new CustomEvent('numChosen:error', { detail: err }));
  }
})();