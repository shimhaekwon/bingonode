//<!-- 페이지 하단에 로드 -->
/* ===========================================================
 * UI-Only Lotto Viewer
 * - 모든 분석/예측은 서버에서 수행 (/api/bingo, /api/bingo/predict)
 * - 프론트는 데이터 표와 후보/세트 결과 렌더에만 집중
 * - 6×5 노출(고정), 후보 k=6~15, k=7(P≥3)/k=10(P≥4) 전달
 * - '붙여넣기'는 Real Data 표시에만 반영(서버 예측에는 반영되지 않음)
 * =========================================================== */

(function(){
  // ===== 고정값 =====
  const FIXED_SET_COUNT = 5;
  const FIXED_SET_SIZE  = 6;

  // ===== 전역 상태 =====
  // [[round, n1..n6, bonus], ...] (중복 최신 유지)
  // *주의*: 0만 들어있는 회차(미추첨 등)도 보관/노출
  let CLEANED = null;
  let ROUND_MIN = null;
  let ROUND_MAX = null;

  // UI 요소
  let el = {};

  /* ===================== 유틸/공통 ===================== */
  function appendLog(msg, cls=""){
    const box = el.progress;
    if (!box) return;
    const line = document.createElement('div');
    line.className = "line " + cls;
    line.textContent = msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }
  function clearLog(){ if (el.progress) el.progress.innerHTML = ""; }
  function debounce(fn, delay = 120) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(()=>fn.apply(null, args), delay); };
  }
  function clampInt(v, min, max, fb=min){
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fb;
    return Math.max(min, Math.min(max, n));
  }
  function clampRound(v){
    const n = parseInt(v,10);
    if (!Number.isFinite(n)) return ROUND_MAX;
    if (n < ROUND_MIN) return ROUND_MIN;
    if (n > ROUND_MAX) return ROUND_MAX;
    return n;
  }

  // ===================== Lotto 색상 매핑 유틸 =====================
  function lottoColorClass(n, mode="cell") {
    const clsBase = (mode === "chip") ? "lotto-" : "cell-";
    if (n >= 1 && n <= 10) return clsBase + "yellow";
    if (n >= 11 && n <= 20) return clsBase + "blue";
    if (n >= 21 && n <= 30) return clsBase + "red";
    if (n >= 31 && n <= 40) return clsBase + "gray";
    if (n >= 41 && n <= 45) return clsBase + "green";
    return ""; // 0, null 등
  }

  /* ===================== 서버 연동 ===================== */
  async function fetchAllBingoAsNumChosen(limit=1000) {
    // 서버 /api/bingo는 seq DESC로 리턴한다고 가정
    let offset = 0;
    const out = [];
    while (true) {
      const res = await fetch(`/api/bingo?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error('failed to fetch /api/bingo');
      const data = await res.json();
      const rows = data?.rows || [];
      if (!rows.length) break;
      for (const r of rows) {
        out.push([r.seq, r.no1, r.no2, r.no3, r.no4, r.no5, r.no6, r.no7 || 0]);
      }
      offset += rows.length;
      if (rows.length < limit) break;
    }
    return out;
  }

  async function callServerPredict(body) {
    const res = await fetch('/api/bingo/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error('predict failed');
    return await res.json(); // { options, sets, candidatePool, uiHints? }
  }

  /* ===================== 데이터 준비 ===================== */
  function prepareDataOnce(){
    if (CLEANED) return;
    if (!window.numChosen
      || !Array.isArray(window.numChosen)
      || window.numChosen.length===0){
      appendLog("서버 데이터(numChosen) 로드 실패", "err");
      throw new Error("numChosen missing");
    }
    // 중복 회차는 "마지막 등장"을 유지 (최신 우선)
    const byRound = new Map();
    let rmin = Infinity, rmax = -Infinity;
    for (const row of window.numChosen){
      const round = row[0];
      byRound.set(round, row);
      if (round < rmin) rmin = round;
      if (round > rmax) rmax = round;
    }
    const out = Array.from(byRound.values()).sort((a,b)=>b[0]-a[0]); // 최신→과거
    CLEANED = out;
    ROUND_MIN = rmin;
    ROUND_MAX = rmax;
  }

  function findApplyRow(round) {
    if (!CLEANED) return null;
    const row = CLEANED.find(r => r[0] === round);
    return row || null;
  }

  /* ===================== 표 보조 ===================== */
  function applyColumnSeparators(tableHost){
    const tableEl = tableHost?.querySelector("table"); if (!tableEl) return;
    const sepIdx = new Set([5,10,15,20,25,30,35,40]);
    const rows = tableEl.rows;
    for (let r=0;r<rows.length;r++){
      const cells = rows[r].children;
      for (let c=0;c<cells.length;c++){
        const colIndex = c+1;
        if (sepIdx.has(colIndex)) cells[c].classList.add('col-sep');
        if (colIndex===45) cells[c].classList.add('last-col');
      }
    }
  }
  function enableColumnHoverBand(tableHost){
    const tableEl = tableHost?.querySelector("table"); if (!tableEl) return;
    let hoverCol = null;
    function setHover(col){
      if (hoverCol===col) return;
      clearHover(); hoverCol=col;
      if (!Number.isInteger(col) || col<1) return;
      const rows = tableEl.rows;
      for (let r=0;r<rows.length;r++){
        const cell = rows[r].children[col-1];
        if (cell) cell.classList.add('col-hover');
      }
    }
    function clearHover(){
      const prev = tableEl.querySelectorAll('.col-hover');
      prev.forEach(n=>n.classList.remove('col-hover'));
      hoverCol=null;
    }
    tableEl.addEventListener('mousemove', (e)=>{
      const cell = e.target.closest('td,th');
      if (!cell || !tableEl.contains(cell)){ clearHover(); return; }
      const col = Array.prototype.indexOf.call(cell.parentNode.children, cell)+1;
      setHover(col);
    });
    tableEl.addEventListener('mouseleave', clearHover);
  }

  /* ===================== Data Viewer (라디오/셀 클릭) ===================== */
  function renderDataViewer(){
    const host = document.getElementById('dataViewerInner');
    if (!host || !CLEANED) return;
    host.innerHTML = "";
    const rows = CLEANED;
    let html = "<table><thead><tr><th class='col-radio'>선택</th><th>회차</th><th colspan='6'>당첨번호</th><th>보너스</th></tr></thead><tbody>";
    const cur = parseInt(el.applyRound.value || ROUND_MAX, 10);
    for (const [round,n1,n2,n3,n4,n5,n6,bonus] of rows){
      const checked = (round === cur) ? "checked" : "";
      const view = v => (v && Number.isFinite(v) && v>0) ? v : "-"; // 0은 '-'
      html += `<tr data-round="${round}">
        <td><input type="radio" name="roundPick" value="${round}" ${checked}/></td>
        <td>${round}</td>
        <td class="${lottoColorClass(n1)}">${view(n1)}</td>
        <td class="${lottoColorClass(n2)}">${view(n2)}</td>
        <td class="${lottoColorClass(n3)}">${view(n3)}</td>
        <td class="${lottoColorClass(n4)}">${view(n4)}</td>
        <td class="${lottoColorClass(n5)}">${view(n5)}</td>
        <td class="${lottoColorClass(n6)}">${view(n6)}</td>
        <td>${view(bonus)}</td>
      </tr>`;
    }
    html += "</tbody></table>";
    host.innerHTML = html;

    // 라디오 변경 → 적용회차 설정 & 즉시 렌더
    host.querySelectorAll('input[type="radio"][name="roundPick"]').forEach(radio=>{
      radio.addEventListener('change', ()=>{
        const r = parseInt(radio.value, 10);
        if (!Number.isFinite(r)) return;
        el.applyRound.value = r;
        host.querySelectorAll('tbody tr').forEach(x=>x.classList.remove('sel'));
        const tr = radio.closest('tr'); tr?.classList.add('sel');
        appendLog(`회차 ${r} 선택 → 서버 예측 재호출`, "ok");
        renderAll();
      });
    });
    // 라디오 외 '셀' 클릭 → 해당 회차 선택
    host.addEventListener('click', (e) => {
      if (e.target.matches('input[type="radio"][name="roundPick"]')) return;
      const tr = e.target.closest('tr[data-round]');
      if (!tr) return;
      host.querySelector(`input[type="radio"][name="roundPick"][value="${tr.dataset.round}"]`)?.click();
    });
  }

  /* ===================== 메인 렌더 ===================== */
  async function renderAll(){
    clearLog();
    appendLog("데이터 준비 중…");
    prepareDataOnce();

    // 입력값/가드
    const W = clampInt(el.totalRounds.value, 1, 180, 30);      // historyRounds
    const rIn = parseInt(el.applyRound.value || ROUND_MAX, 10);
    const r = Number.isFinite(rIn) ? clampRound(rIn) : ROUND_MAX;
    el.applyRound.value = r;
    const k = clampInt(el.candidateCount.value, 6, 15, 10);    // candidatePoolSize
    const nonN = clampInt(el.nonExposeCount.value, 1, 45, 10); // 표시용: 후보군 밖 N개
    const topKMode = (el.topKConstraint?.value) || 'k7p3';
    const kSetting = (topKMode === 'k10p4') ? 10 : 7;

    // 요약
    el.summary.innerHTML =
      `집계 범위: <b>선택 회차 ${r} 기준 직전 W=${W}</b> · 후보 k=<b>${k}</b> · 세트 <b>${FIXED_SET_COUNT}×${FIXED_SET_SIZE}</b>` +
      ` · <span style="color:#757575">(분석/예측은 서버 수행)</span>`;

    // 서버 예측 호출
    try {
      appendLog("서버 예측 호출 …");
      const srv = await callServerPredict({
        numberRangeMax: 45,
        setCount: FIXED_SET_COUNT,
        numbersPerSet: FIXED_SET_SIZE,
        historyRounds: W,
        nonExposedRounds: 8,        // 기본값(필요 시 UI 필드로 노출/연동 가능)
        minNonExposedCount: 0,      // 각 세트에 강제할 '미노출 수'가 있다면 UI와 연동
        candidatePoolSize: k,
        kSetting,                    // 7 or 10
        chiSquareWeighting: true,
        centralIntervalWeighting: true
      });

      appendLog("서버 응답 렌더링 …");

      // 후보군/세트
      const candSet = new Set(srv.candidatePool || []);
      const sets = (srv.sets || []).map(s => (s.numbers || []).slice().sort((a,b)=>a-b));

      // === 메인 테이블 렌더: 헤더 → 적용회차 → 후보군 → 미노출 ===
      const tableHost = el.table; tableHost.innerHTML = "";
      let html = "<table>";
      // 0) 번호 헤더
      html += "<tr>";
      for (let i=1;i<=45;i++) html += `<th>${i}</th>`;
      html += "</tr>";

      // 1) 적용회차 추출 (선택 회차 r의 당첨/보너스 그대로 표시)
      html += `<tr><td colspan="45" class="section-label">적용회차 추출 (선택 회차 ${r})</td></tr>`;
      html += "<tr>";
      const applyRow = findApplyRow(r);
      let applyNums = []; let applyBonus = null;
      if (applyRow && applyRow.length>=8){ applyNums = applyRow.slice(1,7); applyBonus = applyRow[7]; }
      for (let i=1;i<=45;i++){
        let val=0, cls="", tip="적용회차에 선택되지 않음";
        if (applyNums.includes(i)) { val=1; cls="highlight-pink";  tip=`적용회차 당첨 번호: ${i}`; }
        else if (applyBonus===i)   { val=1; cls="highlight-green"; tip=`적용회차 보너스 번호: ${i}`; }
        html += `<td class="${cls}" title="${tip}">${val}</td>`;
      }
      html += "</tr>";

      // 2) 예상 후보군
      html += `<tr><td colspan="45" class="section-label">예상 후보군</td></tr>`;
      html += "<tr>";
      for (let i=1;i<=45;i++){
        const inSet = candSet.has(i);
        html += `<td class="${inSet?"highlight-purple":""}">${inSet?1:0}</td>`;
      }
      html += "</tr>";

      // 3) 예상 미노출 (단순: 후보군에 없는 번호 중 앞에서 nonN개)
      const nonExpose = [];
      for (let i=1;i<=45;i++){
        if (!candSet.has(i)) nonExpose.push(i);
        if (nonExpose.length >= nonN) break;
      }
      const nonSet = new Set(nonExpose);
      html += `<tr><td colspan="45" class="section-label">예상 미노출</td></tr>`;
      html += "<tr>";
      for (let i=1;i<=45;i++){
        const isNX = nonSet.has(i);
        html += `<td class="${isNX?"highlight-nonexpose":""}">${isNX?1:0}</td>`;
      }
      html += "</tr>";
      html += "</table>";
      tableHost.innerHTML = html;
      applyColumnSeparators(tableHost);
      enableColumnHoverBand(tableHost);

      // === 세트 렌더 (5×6) ===
      const setsHost = el.exposureSets; setsHost.innerHTML = "";
      const title = document.createElement('div'); title.className = "set-line";
      title.innerHTML = `<b>예상 노출 세트</b> (세트 수=${FIXED_SET_COUNT}, 세트 크기=${FIXED_SET_SIZE})`;
      setsHost.appendChild(title);
      sets.forEach((arr,i)=>{
        const line = document.createElement('div'); line.className="set-line";
        line.innerHTML = `세트 ${i+1}: <span class="nums">${arr.map(n=>`<span class="chip ${lottoColorClass(n,'chip')}">${n}</span>`).join("")}</span>`;
        setsHost.appendChild(line);
      });

      // Type Rate 패널은 서버에서 통계를 제공하지 않으므로 숨김/간단 메시지
      if (el.typePanel) {
        el.typePanel.innerHTML = `
          <div class="type-card">
            <h3>서버 기반 예측</h3>
            <div class="note">이 패널의 상세 통계(χ², SR 등)는 서버 확장 시 제공 가능</div>
            <div class="note">현재는 후보군/세트만 서버에서 계산하여 표시합니다.</div>
          </div>`;
      }

      appendLog("완료!", "ok");
    } catch (e) {
      console.error(e);
      appendLog("서버 예측 실패: " + (e?.message || e), "err");
    }
  }

  /* ===================== 초기화/이벤트 ===================== */
  window.addEventListener('DOMContentLoaded', async ()=>{
    el = {
      // 상단
      previewType: document.getElementById('previewType'),
      applyRound:  document.getElementById('applyRound'),
      // 중단(조건)
      totalRounds: document.getElementById('totalRounds'),
      candidateCount: document.getElementById('candidateCount'),
      nonExposeCount: document.getElementById('nonExposeCount'),
      topKConstraint: document.getElementById('topKConstraint'),
      // 버튼
      runBtn: document.getElementById('runBtn'),
      clearLogBtn: document.getElementById('clearLogBtn'),
      pasteDataBtn: document.getElementById('pasteDataBtn'),
      // 하단
      summary: document.getElementById('summary'),
      table: document.getElementById('table'),
      exposureSets: document.getElementById('exposureSets'),
      typePanel: document.getElementById('typePanel'),
      progress: document.getElementById('progress')
    };

    try{
      appendLog("서버에서 Real Data 로드 …");
      window.numChosen = await fetchAllBingoAsNumChosen(1000);
      prepareDataOnce();
      if (!el.applyRound.value) el.applyRound.value = ROUND_MAX; // 최신 회차 기본 선택
      renderDataViewer(); // ✅ 모든 회차 표출
    }catch(err){
      console.error(err);
      appendLog("초기 데이터 로드 실패(서버). 필요 시 붙여넣기로 대체하세요.", "err");
    }

    // 실행 버튼
    el.runBtn?.addEventListener('click', ()=>{ renderAll(); });
    // (참고) 미리보기 타입 변경: 현재 서버 예측에는 영향 없음. UI만 갱신.
    el.previewType?.addEventListener('change', debounce(()=>{ renderAll(); }, 120));
    // 로그 지우기
    el.clearLogBtn?.addEventListener('click', ()=>{ clearLog(); });

    // 데이터 붙여넣기 (서버 미반영 안내)
    el.pasteDataBtn?.addEventListener('click', () => {
      const hint = '한 줄에 "회차, n1, n2, n3, n4, n5, n6, bonus" (쉼표/공백 모두 허용). 여러 줄 붙여넣기 가능.';
      const text = window.prompt(`numChosen 데이터 붙여넣기\n\n${hint}\n\n예) 1152, 1 5 9 14 23 38 19`);
      if (!text) return;
      const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const out = [];
      for (const line of lines) {
        const cols = line.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean).map(Number);
        if (cols.length >= 7) {
          const [round, n1,n2,n3,n4,n5,n6, bonus] = cols;
          if (Number.isFinite(round) && [n1,n2,n3,n4,n5,n6].every(v=>Number.isFinite(v))) {
            out.push([round,n1,n2,n3,n4,n5,n6, Number.isFinite(bonus)? bonus: 0]);
          }
        }
      }
      if (!out.length) { appendLog("붙여넣기 실패: 파싱된 행이 없습니다.", "err"); return; }

      // ⚠️ 주의: 붙여넣기는 Real Data '표시'에만 반영됩니다.
      // 서버 예측은 서버 DB 기준으로 계산되므로, 붙여넣기는 예측에 반영되지 않습니다.
      // (원하시면 bulk 업로드 API를 만들어 바로 서버 DB에 반영하도록 확장 가능합니다.)
      window.numChosen = out;
      CLEANED = null; ROUND_MIN = null; ROUND_MAX = null;
      try {
        prepareDataOnce();
        if (!el.applyRound.value) el.applyRound.value = ROUND_MAX;
        renderDataViewer();
        renderAll();
        appendLog(`붙여넣기 완료: ${out.length}행 (서버 예측에는 반영되지 않습니다)`, "warn");
      } catch (e) {
        console.error(e);
        appendLog("붙여넣기 처리 실패", "err");
      }
    });

    // 최초 1회 실행
    await renderAll();
  });

})();

/* =====================================================
 * Real Data (#dataViewer) 높이 확대/축소 핸들 + 상태 저장
 * (HTML 무수정, styles.css의 .rd-resize-handle 와 연동)
 * ===================================================== */
(function initRealDataHeightControl() {
  window.addEventListener('DOMContentLoaded', () => {
    const wrap  = document.getElementById('dataViewer');
    const inner = document.getElementById('dataViewerInner');
    if (!wrap || !inner) return;
    // 핸들 1회만 생성
    if (!wrap.querySelector('.rd-resize-handle')) {
      const handle = document.createElement('div');
      handle.className = 'rd-resize-handle';
      wrap.appendChild(handle);
    }
    const handle = wrap.querySelector('.rd-resize-handle');
    // 저장 높이 복원
    const KEY = 'ui:realdata:maxh';
    const saved = parseInt(localStorage.getItem(KEY), 10);
    if (Number.isFinite(saved) && saved >= 120) {
      inner.style.maxHeight = saved + 'px';
    }
    // 드래그 리사이즈
    let dragging = false, sy = 0, sh = 0;
    const MIN_H = 140;
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      sy = e.clientY;
      const cs = getComputedStyle(inner);
      sh = parseFloat(cs.maxHeight);
      if (!Number.isFinite(sh)) sh = inner.offsetHeight;
      document.body.style.cursor = 'row-resize';
      e.preventDefault();
    });
    const onMove = (e) => {
      if (!dragging) return;
      const nh = Math.max(MIN_H, sh + (e.clientY - sy));
      inner.style.maxHeight = nh + 'px';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      const nh = parseFloat(getComputedStyle(inner).maxHeight);
      if (Number.isFinite(nh)) {
        localStorage.setItem(KEY, String(Math.round(nh)));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
})();


document.addEventListener('numChosen:ready', () => {
  try {
    prepareDataOnce();
    if (!el.applyRound.value) el.applyRound.value = ROUND_MAX;
    renderDataViewer();
  } catch (err) {
    console.error(err);
    appendLog("초기 렌더링 실패", "err");
  }
});
