/* ===========================================================
 * Front-only Lotto Analyzer (Top/Bottom Layout, Radio Round Pick)
 * - 모든 연산 브라우저에서 처리
 * - 분석/예상 계산: 11개 타입(고정) 동시 사용
 * - 미리보기 타입(드롭다운)은 확인용 패널에만 사용
 * - 적용회차: 상단 좌측 '실제 데이터' 표의 라디오/셀 클릭으로 지정
 * - 후보 k: 6~15
 * - 세트 수=5(고정), 세트 크기=6(고정)
 * - 패턴 필터 + Top-K 포함 제약 적용
 * - 서버 전용 모드(data.js 미사용)
 * =========================================================== */
(function () {
  'use strict';

  // ===== 상수 =====
  const FIXED_SET_COUNT = 5;
  const FIXED_SET_SIZE  = 6;
  const EVT_READY       = 'numChosen:ready';
  const EVT_ERROR       = 'numChosen:error';

  // ===== 전역 상태 =====
  // [[round, n1..n6, bonus], ...] (중복 최신 유지)
  // *주의*: 0만 들어있는 회차(아직 미추첨 등)도 그대로 유지/노출
  let CLEANED   = null;
  let ROUND_MIN = null;
  let ROUND_MAX = null;

  // UI 요소
  let el = {};

  // 하이퍼파라미터
  const HP = {
    beta1  : 0.6, // 기본 결손 가중
    beta2  : 0.3, // 기본 최신성 가중
    lambda : 0.3, // 그룹 내부 분배 시 최신성 가중
    tau    : 1.0  // softmax 온도
  };

  /* ===================== 유틸/공통 ===================== */
  function appendLog(msg, cls = '') {
    const box = el.progress;
    if (!box) {
      return;
    }
    const line = document.createElement('div');
    line.className = 'line ' + cls;
    line.textContent = msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function clearLog() {
    if (el.progress) {
      el.progress.innerHTML = '';
    }
  }

  function debounce(fn, delay = 120) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => {
        fn.apply(null, args);
      }, delay);
    };
  }

  function clampInt(v, min, max, fb = min) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) {
      return fb;
    }
    return Math.max(min, Math.min(max, n));
  }

  function clampRound(v) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) {
      return ROUND_MAX;
    }
    if (n < ROUND_MIN) {
      return ROUND_MIN;
    }
    if (n > ROUND_MAX) {
      return ROUND_MAX;
    }
    return n;
  }

  // ===================== Lotto 색상 매핑 유틸 =====================
  function lottoColorClass(n, mode = 'cell') {
    // mode="cell" → 배경만 칠함(표 셀), mode="chip" → 칩 배경
    const clsBase = (mode === 'chip') ? 'lotto-' : 'cell-';
    if (n >= 1 && n <= 10) { return clsBase + 'yellow'; }
    if (n >= 11 && n <= 20) { return clsBase + 'blue'; }
    if (n >= 21 && n <= 30) { return clsBase + 'red'; }
    if (n >= 31 && n <= 40) { return clsBase + 'gray'; }
    if (n >= 41 && n <= 45) { return clsBase + 'green'; }
    return ''; // 0, null 등
  }

  /* ===================== 서버 연동 (모두 POST) ===================== */
  async function fetchAllBingoAsNumChosen(limit = 99999) {
    let offset = 0;
    const out = [];
    const MAX_ITERATIONS = 1000; // 안전장치
    let iterations = 0;

    while (iterations++ < MAX_ITERATIONS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 1000); // 10초 타임아웃

      try {
        const res = await fetch('/api/bingo/getList', {
          method  : 'POST',
          headers : { 'Content-Type': 'application/json' },
          body    : JSON.stringify({ limit, offset }),
          signal  : controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const rows = data?.rows ?? [];

        if (!rows.length) {
          break;
        }

        for (const r of rows) {
          out.push([r.seq, r.no1, r.no2, r.no3, r.no4, r.no5, r.no6, (r.no7 ?? 0)]);
        }

        offset += rows.length;

        if (rows.length < limit) {
          break;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn('fetchAllBingoAsNumChosen: 최대 반복 횟수 도달');
    }

    return out;
  }

  /* ===================== 데이터 준비 ===================== */
  function prepareDataOnce() {
    if (CLEANED) {
      return;
    }
    if (!window.numChosen || !Array.isArray(window.numChosen) || window.numChosen.length === 0) {
      appendLog('서버 데이터(numChosen)가 준비되지 않았습니다.', 'err');
      throw new Error('numChosen missing');
    }

    // 중복 회차는 "마지막으로 등장한 항목"을 유지하도록 Map으로 집계
    const byRound = new Map();
    let rmin = Infinity;
    let rmax = -Infinity;

    for (const row of window.numChosen) {
      const round = row[0];
      // *** 0만 있는 회차도 그대로 보관/노출합니다. 필터링 없음. ***
      byRound.set(round, row);
      if (round < rmin) { rmin = round; }
      if (round > rmax) { rmax = round; }
    }

    // 회차 내림차순(최신→과거) 정렬: Real Data 테이블 상단이 최신
    const out = Array.from(byRound.values()).sort((a, b) => {
      return b[0] - a[0];
    });
    CLEANED   = out;
    ROUND_MIN = rmin;
    ROUND_MAX = rmax;
  }

  /* ===================== 타입 생성 ===================== */
  function makeRangeGroups(N) {
    const base   = Math.floor(45 / N);
    const extra  = 45 % N;
    const groups = [];
    let cur      = 1;

    for (let i = 0; i < N; i++) {
      const size = base + (i < extra ? 1 : 0);
      const g    = [];
      for (let k = 0; k < size; k++) {
        g.push(cur++);
      }
      groups.push(g);
    }
    return groups;
  }

  function makeModGroups(N) {
    const groups = Array.from({ length: N }, () => {
      return [];
    });
    for (let n = 1; n <= 45; n++) {
      groups[(n - 1) % N].push(n);
    }
    return groups;
  }

  function makeEndDigit10() {
    const groups = Array.from({ length: 10 }, () => {
      return [];
    });
    for (let n = 1; n <= 45; n++) {
      groups[n % 10].push(n);
    }
    return groups;
  }

  function makeSingle45() {
    return Array.from({ length: 45 }, (_, i) => {
      return [i + 1];
    });
  }

  function buildAllAnalysisTypes() {
    return [
      { name: 'single45'  , groups: makeSingle45()         },
      { name: 'range3'    , groups: makeRangeGroups(3)     },
      { name: 'range5'    , groups: makeRangeGroups(5)     },
      { name: 'range6'    , groups: makeRangeGroups(6)     },
      { name: 'range9'    , groups: makeRangeGroups(9)     },
      { name: 'range10'   , groups: makeRangeGroups(10)    },
      { name: 'range15'   , groups: makeRangeGroups(15)    },
      { name: 'mod3'      , groups: makeModGroups(3)       },
      { name: 'mod9'      , groups: makeModGroups(9)       },
      { name: 'mod15'     , groups: makeModGroups(15)      },
      { name: 'endDigit10', groups: makeEndDigit10()       }
    ];
  }

  function buildPreviewType(name) {
    switch (name) {
      case 'single45':    { return [{ name, groups: makeSingle45()      }]; }
      case 'range3':      { return [{ name, groups: makeRangeGroups(3)  }]; }
      case 'range5':      { return [{ name, groups: makeRangeGroups(5)  }]; }
      case 'range6':      { return [{ name, groups: makeRangeGroups(6)  }]; }
      case 'range9':      { return [{ name, groups: makeRangeGroups(9)  }]; }
      case 'range10':     { return [{ name, groups: makeRangeGroups(10) }]; }
      case 'range15':     { return [{ name, groups: makeRangeGroups(15) }]; }
      case 'mod3':        { return [{ name, groups: makeModGroups(3)    }]; }
      case 'mod9':        { return [{ name, groups: makeModGroups(9)    }]; }
      case 'mod15':       { return [{ name, groups: makeModGroups(15)   }]; }
      case 'endDigit10':  { return [{ name, groups: makeEndDigit10()    }]; }
      default:            { return [{ name: 'range3', groups: makeRangeGroups(3) }]; }
    }
  }

  /* ===================== 개별 통계(선택 회차 "직전 W회") ===================== */
  // ✅ 선택 회차 rEnd "자체"는 절대 포함하지 않습니다. (항상 이전 데이터만 분석)
  function computeIndividualStats(W, rEnd) {
    // 효과 범위: [start, end] = [(rEnd-1)-W+1, (rEnd-1)]
    const effectiveEnd = rEnd - 1;
    const start        = effectiveEnd - W + 1;
    const k            = Array(46).fill(0);
    const lastSeen     = Array(46).fill(null);

    for (const row of CLEANED) {
      const [round, n1, n2, n3, n4, n5, n6, bonus] = row;
      if (round < start || round > effectiveEnd) {
        continue;
      }
      const arr = [n1, n2, n3, n4, n5, n6];
      for (const n of arr) {
        if (n >= 1 && n <= 45) {
          k[n] += 1;
          if (lastSeen[n] === null || lastSeen[n] < round) {
            lastSeen[n] = round;
          }
        }
      }
      if (Number.isFinite(bonus) && bonus >= 1 && bonus <= 45) {
        k[bonus] += 0.5;
        if (lastSeen[bonus] === null || lastSeen[bonus] < round) {
          lastSeen[bonus] = round;
        }
      }
    }

    const recency = Array(46).fill(0);
    for (let n = 1; n <= 45; n++) {
      recency[n] = (lastSeen[n] === null) ? W : (effectiveEnd - lastSeen[n]);
    }
    return { k, recency, range: { start, end: effectiveEnd } };
  }

  /* ===================== 관측치 O(t,g) (선택 회차 "직전 W회") ===================== */
  function computeObserved(W, rEnd, types) {
    const effectiveEnd = rEnd - 1;
    const start        = effectiveEnd - W + 1;
    const O            = {};
    const mapIndex     = {};

    for (const t of types) {
      const idx = Array(46).fill(-1);
      t.groups.forEach((grp, gi) => {
        for (const n of grp) {
          idx[n] = gi;
        }
      });
      mapIndex[t.name] = idx;
      O[t.name]        = Array(t.groups.length).fill(0);
    }

    for (const row of CLEANED) {
      const [round, n1, n2, n3, n4, n5, n6] = row;
      if (round < start || round > effectiveEnd) {
        continue;
      }
      const arr = [n1, n2, n3, n4, n5, n6];
      for (const t of types) {
        const idx = mapIndex[t.name];
        for (const n of arr) {
          const gi = idx[n];
          if (gi >= 0) {
            O[t.name][gi] += 1;
          }
        }
      }
    }
    return O;
  }

  /* ===================== 유형 통계/가중치 ===================== */
  function computeTypeStats(W, types, O) {
    const info = [];

    for (const t of types) {
      const E  = t.groups.map((g) => {
        return W * 6 * (g.length / 45);
      });
      const SR = O[t.name].map((o, i) => {
        return (o - E[i]) / Math.sqrt(E[i] + 1e-9);
      });
      const s  = SR.map((x) => {
        return -x;
      });

      let chi2 = 0;
      for (let i = 0; i < E.length; i++) {
        chi2 += Math.pow(O[t.name][i] - E[i], 2) / (E[i] + 1e-9);
      }

      info.push({ name: t.name, groups: t.groups, O: O[t.name], E, SR, s, chi2 });
    }

    const sumChi = info.reduce((a, b) => {
      return a + b.chi2;
    }, 0) || 1e-9;

    info.forEach((x) => {
      x.alpha = x.chi2 / sumChi;
    });

    return info;
  }

  function zNormalize(arr) {
    const n    = arr.length || 1;
    const mean = arr.reduce((a, b) => {
      return a + b;
    }, 0) / n;
    const varc = arr.reduce((a, b) => {
      return a + (b - mean) * (b - mean);
    }, 0) / n;
    const std  = Math.sqrt(varc) || 1;
    return arr.map((v) => {
      return (v - mean) / std;
    });
  }

  /* ===================== 번호 점수 S(n) ===================== */
  function scoreNumbers(W, rEnd, typeInfo, k, recency) {
    const mu       = W * 6 / 45;
    const deficit  = Array.from({ length: 46 }, (_, n) => {
      return (n === 0 ? 0 : (mu - (k[n] || 0)));
    });
    const deficitZ = zNormalize(deficit.slice(1)); deficitZ.unshift(0);
    const recZ     = zNormalize(recency.slice(1)); recZ.unshift(0);

    const S = Array(46).fill(0);

    for (const ti of typeInfo) {
      const alpha = ti.alpha;
      for (let gi = 0; gi < ti.groups.length; gi++) {
        const grp     = ti.groups[gi];
        const weights = grp.map((n) => {
          return deficitZ[n] + HP.lambda * recZ[n];
        });
        const Z       = weights.reduce((a, b) => {
          return a + b;
        }, 0) || 1e-9;
        const s_g     = ti.s[gi];

        for (let idx = 0; idx < grp.length; idx++) {
          const n     = grp[idx];
          const share = weights[idx] / Z;
          S[n]       += alpha * s_g * share;
        }
      }
    }

    for (let n = 1; n <= 45; n++) {
      S[n] += HP.beta1 * deficitZ[n] + HP.beta2 * recZ[n];
    }
    return S;
  }

  /* ===================== 확률/후보/세트 ===================== */
  function softmaxFromScores(S) {
    const arr = [];
    for (let n = 1; n <= 45; n++) {
      arr.push(S[n]);
    }
    const maxV = Math.max(...arr);
    const exps = arr.map((v) => {
      return Math.exp((v - maxV) / HP.tau);
    });
    const Z = exps.reduce((a, b) => {
      return a + b;
    }, 0) || 1;

    const P = Array(46).fill(0);
    for (let n = 1; n <= 45; n++) {
      P[n] = exps[n - 1] / Z;
    }
    return P;
  }

  function topKFromScores(S, k) {
    const arr = [];
    for (let n = 1; n <= 45; n++) {
      arr.push([n, S[n]]);
    }
    arr.sort((a, b) => {
      return (b[1] - a[1]) || (a[0] - b[0]);
    });
    const picked = arr.slice(0, k).map((x) => {
      return x[0];
    }).sort((a, b) => {
      return a - b;
    });
    return new Set(picked);
  }

  function sampleNoReplace(weightsMap, drawCount) {
    const nums    = [];
    const weights = [];

    for (let n = 1; n <= 45; n++) {
      const w = weightsMap[n] || 0;
      if (w <= 0) {
        continue;
      }
      nums.push(n);
      weights.push(w);
    }

    const picked = [];
    let total    = weights.reduce((a, b) => {
      return a + b;
    }, 0);

    for (let t = 0; t < drawCount && nums.length > 0; t++) {
      let r = Math.random() * total;
      let i = 0;

      while (i < weights.length && r > weights[i]) {
        r -= weights[i];
        i += 1;
      }
      if (i >= weights.length) {
        i = weights.length - 1;
      }

      picked.push(nums[i]);
      total -= weights[i];
      nums.splice(i, 1);
      weights.splice(i, 1);
    }

    picked.sort((a, b) => {
      return a - b;
    });
    return picked;
  }

  /* ===================== 보조 렌더 ===================== */
  function getHeat(min, max, v) {
    if (max === min) {
      return 'rgb(230,230,255)';
    }
    const t    = (v - min) / (max - min);
    const red  = Math.round(255 * t);
    const blue = Math.round(255 * (1 - t));
    return `rgb(${red},220,${blue})`;
  }

  function applyColumnSeparators(tableHost) {
    const tableEl = tableHost?.querySelector('table');
    if (!tableEl) {
      return;
    }
    const sepIdx = new Set([5, 10, 15, 20, 25, 30, 35, 40]);
    const rows   = tableEl.rows;

    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].children;
      for (let c = 0; c < cells.length; c++) {
        const colIndex = c + 1;
        if (sepIdx.has(colIndex)) {
          cells[c].classList.add('col-sep');
        }
        if (colIndex === 45) {
          cells[c].classList.add('last-col');
        }
      }
    }
  }

  function enableColumnHoverBand(tableHost) {
    const tableEl = tableHost?.querySelector('table');
    if (!tableEl) {
      return;
    }
    let hoverCol = null;

    function setHover(col) {
      if (hoverCol === col) {
        return;
      }
      clearHover();
      hoverCol = col;

      if (!Number.isInteger(col) || col < 1) {
        return;
      }
      const rows = tableEl.rows;
      for (let r = 0; r < rows.length; r++) {
        const cell = rows[r].children[col - 1];
        if (cell) {
          cell.classList.add('col-hover');
        }
      }
    }

    function clearHover() {
      const prev = tableEl.querySelectorAll('.col-hover');
      prev.forEach((n) => {
        n.classList.remove('col-hover');
      });
      hoverCol = null;
    }

    tableEl.addEventListener('mousemove', (e) => {
      const cell = e.target.closest('td,th');
      if (!cell || !tableEl.contains(cell)) {
        clearHover();
        return;
      }
      const col = Array.prototype.indexOf.call(cell.parentNode.children, cell) + 1;
      setHover(col);
    });

    tableEl.addEventListener('mouseleave', () => {
      clearHover();
    });
  }

  function findApplyRow(round) {
    if (!CLEANED) {
      return null;
    }
    const row = CLEANED.find((r) => {
      return r[0] === round;
    });
    return row || null;
  }

  /* ===================== Data Viewer (라디오/셀 클릭) ===================== */
  function renderDataViewer() {
    const host = document.getElementById('dataViewerInner');
    if (!host || !CLEANED) {
      return;
    }

    host.innerHTML = '';

    // 모든 회차 표시 (자르지 않음). 최신→과거 정렬은 CLEANED에서 보장.
    const rows = CLEANED;

    let html = '<table><thead><tr><th class="col-radio">선택</th><th>회차</th><th colspan="6">당첨번호</th><th>보너스</th></tr></thead><tbody>';
    const cur = parseInt(el.applyRound.value || ROUND_MAX, 10);

    for (const [round, n1, n2, n3, n4, n5, n6, bonus] of rows) {
      const checked = (round === cur) ? 'checked' : '';
      const view    = (v) => {
        return (v && Number.isFinite(v) && v > 0) ? v : '-';
      }; // 0은 보기상 '-'

      html += `
        <tr data-round="${round}">
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

    html += '</tbody></table>';
    host.innerHTML = html;

    // 라디오 변경 → 적용회차 설정 & 즉시 렌더
    host.querySelectorAll('input[type="radio"][name="roundPick"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const r = parseInt(radio.value, 10);
        if (!Number.isFinite(r)) {
          return;
        }
        el.applyRound.value = r;
        host.querySelectorAll('tbody tr').forEach((x) => {
          x.classList.remove('sel');
        });
        const tr = radio.closest('tr');
        if (tr) {
          tr.classList.add('sel');
        }
        appendLog(`회차 ${r} 선택 → 분석 갱신(선택 회차 제외, 직전 W회)`, 'ok');
        renderAll();
      });
    });

    // 라디오 외 '셀' 클릭 → 해당 회차 선택
    host.addEventListener('click', (e) => {
      if (e.target.matches('input[type="radio"][name="roundPick"]')) {
        return;
      }
      const tr = e.target.closest('tr[data-round]');
      if (!tr) {
        return;
      }
      const radio = host.querySelector(`input[type="radio"][name="roundPick"][value="${tr.dataset.round}"]`);
      if (radio) {
        radio.click();
      }
    });
  }

  /* ===================== Type Rate 패널 (툴팁/요약표시) ===================== */
  function renderTypePanel(typeInfo) {
    const host = el.typePanel;
    if (!host) {
      return;
    }
    host.innerHTML = '';

    for (const t of typeInfo) {
      // 카드
      const card = document.createElement('div');
      card.className = 'type-card';

      // 제목
      const h3 = document.createElement('h3');
      h3.textContent = `Type: ${t.name} · χ²=${t.chi2.toFixed(2)} · α=${t.alpha.toFixed(3)}`;
      card.appendChild(h3);

      // 표
      const tbl   = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th title="#: 그룹 번호 (1부터). 선택한 타입의 구간/나머지/끝수 등으로 묶인 Group Index">#</th>
          <th title="Observed: 관측 횟수">O</th>
          <th title="Expected: 기대 횟수 (비율 기반)">E</th>
          <th title="Standardized Residual: (O-E)/sqrt(E)">SR</th>
          <th title="s = -SR (가중 방향)">s=-SR</th>
        </tr>`;
      tbl.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (let gi = 0; gi < t.groups.length; gi++) {
        const nums      = t.groups[gi]; // 포함 숫자 목록
        const fullList  = nums.join(', ');
        const shortList = (nums.length > 12) ? (nums.slice(0, 12).join(', ') + ' …') : fullList;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td title="포함 번호: ${fullList}">
            ${gi + 1}
            <div style="font-size:11px;color:#757575;white-space:normal;line-height:1.25;margin-top:2px">${shortList}</div>
          </td>
          <td>${t.O[gi]}</td>
          <td>${t.E[gi].toFixed(2)}</td>
          <td>${t.SR[gi].toFixed(2)}</td>
          <td>${t.s[gi].toFixed(2)}</td>`;
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      card.appendChild(tbl);
      host.appendChild(card);
    }
  }

  /* ===================== Top-K/패턴 필터 ===================== */
  function topKSetFromScores(S, K) {
    const arr = [];
    for (let n = 1; n <= 45; n++) {
      arr.push([n, S[n]]);
    }
    arr.sort((a, b) => {
      return (b[1] - a[1]) || (a[0] - b[0]);
    });
    return new Set(arr.slice(0, K).map((x) => {
      return x[0];
    }));
  }

  function maxConsecutiveLen(nums) {
    const a = nums.slice().sort((x, y) => {
      return x - y;
    });
    let run  = 1;
    let best = 1;

    for (let i = 1; i < a.length; i++) {
      if (a[i] === a[i - 1] + 1) {
        run += 1;
        if (run > best) {
          best = run;
        }
      } else {
        run = 1;
      }
    }
    return best;
  }

  function endsCount(nums) {
    const c = Array(10).fill(0);
    for (const n of nums) {
      c[n % 10] += 1;
    }
    return Math.max(...c);
  }

  function passesPatternFilters(arr, filters, ctx) {
    const sum = arr.reduce((p, c) => {
      return p + c;
    }, 0);
    if (sum < filters.sumMin || sum > filters.sumMax) {
      return false;
    }

    const run = maxConsecutiveLen(arr);
    if (run > filters.maxRun) {
      return false;
    }

    const sameEnd = endsCount(arr);
    if (sameEnd > filters.maxSameEnd) {
      return false;
    }

    const odd = arr.filter((n) => {
      return (n % 2) === 1;
    }).length;
    if (odd < filters.oddMin || odd > filters.oddMax) {
      return false;
    }

    if (ctx.prev && Number.isFinite(filters.rollMin) && Number.isFinite(filters.rollMax)) {
      const prev = new Set(ctx.prev);
      const roll = arr.filter((n) => {
        return prev.has(n);
      }).length;
      if (roll < filters.rollMin || roll > filters.rollMax) {
        return false;
      }
    }

    if (filters.topKMode === 'k7p3') {
      const cnt = arr.filter((n) => {
        return ctx.top7.has(n);
      }).length;
      if (cnt < 3) {
        return false;
      }
    } else if (filters.topKMode === 'k10p4') {
      const cnt = arr.filter((n) => {
        return ctx.top10.has(n);
      }).length;
      if (cnt < 4) {
        return false;
      }
    }
    return true;
  }

  function buildExposureSets(P, setsCount, setSize, dedup, filters, ctx) {
    const sets = [];
    const used = new Set();

    for (let s = 0; s < setsCount; s++) {
      let one      = null;
      let attempts = 0;

      while (attempts < 500) {
        attempts += 1;

        const local = Array(46).fill(0);
        for (let n = 1; n <= 45; n++) {
          local[n] = (dedup && used.has(n)) ? 1e-12 : (P[n] || 0);
        }
        const cand = sampleNoReplace(local, setSize);

        if (passesPatternFilters(cand, filters, ctx)) {
          one = cand;
          break;
        }

        // 점진적 완화 (난이도 높을 때)
        if (attempts === 250) {
          // Top-K 완화
          if (filters.topKMode !== 'none') {
            filters.topKMode = 'none';
          }
        } else if (attempts === 350) {
          // 이월 완화
          filters.rollMin = 0;
          filters.rollMax = 6;
        } else if (attempts === 450) {
          // 연속 완화
          filters.maxRun = Math.min(6, filters.maxRun + 1);
        }
      }

      if (!one) {
        const local = Array(46).fill(0);
        for (let n = 1; n <= 45; n++) {
          local[n] = (dedup && used.has(n)) ? 1e-12 : (P[n] || 0);
        }
        one = sampleNoReplace(local, setSize);
      }

      sets.push(one);
      if (dedup) {
        one.forEach((n) => {
          used.add(n);
        });
      }
    }
    return sets;
  }

  /* ===================== 메인 렌더 ===================== */
  function renderAll() {
    clearLog();
    appendLog('데이터 준비 중…');

    prepareDataOnce();

    // 입력값/가드
    const W    = clampInt(el.totalRounds.value, 1, 180, 30);
    const rIn  = parseInt(el.applyRound.value || ROUND_MAX, 10);
    const r    = Number.isFinite(rIn) ? clampRound(rIn) : ROUND_MAX;
    el.applyRound.value = r;

    const k     = clampInt(el.candidateCount.value, 6, 15, 12);
    const nonN  = clampInt(el.nonExposeCount.value, 6, 20, 10);
    const dedup = true;

    // 분석 범위는 [(r-1)-W+1 ~ (r-1)] → 시작이 데이터 최소보다 작으면 경고
    const effEnd   = r - 1;
    const effStart = effEnd - W + 1;
    if (effStart < ROUND_MIN) {
      appendLog(`집계 범위(${effStart}~${effEnd})가 데이터 시작(${ROUND_MIN})보다 앞섭니다. 차수를 줄이거나 적용회차를 올려주세요.`, 'warn');
      return;
    }

    // 요약
    el.summary.innerHTML =
      `집계 범위: <b>${effStart}~${effEnd}</b> · 차수 W=<b>${W}</b> · 후보 k=<b>${k}</b> · 세트 <b>${FIXED_SET_COUNT}×${FIXED_SET_SIZE}</b> · 미노출 <b>${nonN}</b>
       · <span style="color:#757575">(선택 회차 ${r} 제외)</span>`;

    // 타입/통계
    appendLog('분석용 타입(11종) 구성…');
    const analysisTypes = buildAllAnalysisTypes();
    const previewName   = el.previewType?.value || 'range3';
    const previewTypes  = buildPreviewType(previewName);

    appendLog('번호별 기초 통계 계산(k, recency) …');
    const { k: K, recency } = computeIndividualStats(W, r);

    appendLog('분석용 관측치/유형통계 계산 …');
    const O_analysis    = computeObserved(W, r, analysisTypes);
    const info_analysis = computeTypeStats(W, analysisTypes, O_analysis);

    appendLog('미리보기 관측치/유형통계 계산(확인용) …');
    const O_preview    = computeObserved(W, r, previewTypes);
    const info_preview = computeTypeStats(W, previewTypes, O_preview);

    appendLog('번호 점수 합성 S(n) 계산 …');
    const S = scoreNumbers(W, r, info_analysis, K, recency);

    appendLog('후보군 상위 k 추출 …');
    const cand = topKFromScores(S, k);

    appendLog('softmax 확률 p(n) 계산 …');
    const P = softmaxFromScores(S);

    appendLog('예상 노출 세트(5×6) 생성 …');
    // Top-K/이월 제약 준비
    const top7     = topKSetFromScores(S, 7);
    const top10    = topKSetFromScores(S, 10);
    const prevRow  = findApplyRow(r - 1);
    const prevNums = (prevRow && prevRow.length >= 7) ? prevRow.slice(1, 7) : null;

    const filters = {
      sumMin     : clampInt(el.sumMin.value, 60, 270, 100),
      sumMax     : clampInt(el.sumMax.value, 60, 270, 180),
      maxRun     : clampInt(el.maxRun.value, 1, 6, 3),
      maxSameEnd : clampInt(el.maxSameEnd.value, 1, 6, 3),
      oddMin     : clampInt(el.oddMin.value, 0, 6, 2),
      oddMax     : clampInt(el.oddMax.value, 0, 6, 4),
      rollMin    : clampInt(el.rollMin.value, 0, 6, 0),
      rollMax    : clampInt(el.rollMax.value, 0, 6, 2),
      topKMode   : (el.topKConstraint?.value) || 'k7p3'
    };

    const ctx  = { top7, top10, prev: prevNums };
    const sets = buildExposureSets(P, FIXED_SET_COUNT, FIXED_SET_SIZE, dedup, { ...filters }, ctx);

    appendLog('미노출 후보 N개 산출 …');
    const low = [];
    for (let n = 1; n <= 45; n++) {
      low.push([n, P[n]]);
    }
    low.sort((a, b) => {
      return (a[1] - b[1]) || (a[0] - b[0]);
    });

    const nonExpose = [];
    for (const [n] of low) {
      if (!cand.has(n)) {
        nonExpose.push(n);
      }
      if (nonExpose.length >= nonN) {
        break;
      }
    }

    // Type Rate 패널 (실패해도 아래 렌더 계속)
    try {
      renderTypePanel(info_preview);
    } catch (e) {
      console.error(e);
      appendLog('Type Rate 패널 렌더 실패 (분석/예상은 계속 진행)', 'warn');
    }

    // === 메인 테이블 렌더: 헤더 → 빈도수 → 적용회차 → 후보군 → 미노출 ===
    const tableHost = el.table;
    tableHost.innerHTML = '';
    let html = '<table>';

    // 0) 번호 헤더
    html += '<tr>';
    for (let i = 1; i <= 45; i++) {
      html += `<th>${i}</th>`;
    }
    html += '</tr>';

    // 1) 빈도수
    const minK = Math.min(...K.slice(1));
    const maxK = Math.max(...K.slice(1));

    html += `<tr><td colspan="45" class="section-label">빈도수 (최근 W=${W}, 보너스 0.5)</td></tr>`;
    html += '<tr>';
    for (let i = 1; i <= 45; i++) {
      const color = getHeat(minK, maxK, K[i]);
      const tip   = `번호 ${i}: 최근 ${W}회 빈도 ${K[i]}`;
      html += `<td style="background:${color};color:#111" title="${tip}">${K[i]}</td>`;
    }
    html += '</tr>';

    // 2) 적용회차 추출 (선택 회차 r의 당첨/보너스 그대로 표시)
    html += `<tr><td colspan="45" class="section-label">적용회차 추출 (선택 회차 ${r})</td></tr>`;
    html += '<tr>';
    const applyRow = findApplyRow(r);
    let applyNums  = [];
    let applyBonus = null;

    if (applyRow && applyRow.length >= 8) {
      applyNums  = applyRow.slice(1, 7);
      applyBonus = applyRow[7];
    }

    for (let i = 1; i <= 45; i++) {
      let val = 0;
      let cls = '';
      let tip = '적용회차에 선택되지 않음';

      if (applyNums.includes(i)) {
        val = 1;
        cls = 'highlight-pink';
        tip = `적용회차 당첨 번호: ${i}`;
      } else if (applyBonus === i) {
        val = 1;
        cls = 'highlight-green';
        tip = `적용회차 보너스 번호: ${i}`;
      }
      html += `<td class="${cls}" title="${tip}">${val}</td>`;
    }
    html += '</tr>';

    // 3) 예상 후보군
    html += `<tr><td colspan="45" class="section-label">예상 후보군</td></tr>`;
    html += '<tr>';
    for (let i = 1; i <= 45; i++) {
      const inSet = cand.has(i);
      html += `<td class="${inSet ? 'highlight-purple' : ''}">${inSet ? 1 : 0}</td>`;
    }
    html += '</tr>';

    // 4) 예상 미노출
    const nonSet = new Set(nonExpose);
    html += `<tr><td colspan="45" class="section-label">예상 미노출</td></tr>`;
    html += '<tr>';
    for (let i = 1; i <= 45; i++) {
      const isNX = nonSet.has(i);
      const tip  = `p(${i})=${(P[i] * 100).toFixed(2)}%`;
      html += `<td class="${isNX ? 'highlight-nonexpose' : ''}" title="${tip}">${isNX ? 1 : 0}</td>`;
    }
    html += '</tr>';

    html += '</table>';
    tableHost.innerHTML = html;

    applyColumnSeparators(tableHost);
    enableColumnHoverBand(tableHost);

    // === 세트 렌더 (5×6) ===
    const setsHost = el.exposureSets;
    setsHost.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'set-line';
    title.innerHTML = `<b>예상 노출 세트</b> (세트 수=${FIXED_SET_COUNT}, 세트 크기=${FIXED_SET_SIZE}, 중복 방지)`;
    setsHost.appendChild(title);

    sets.forEach((arr, i) => {
      const line = document.createElement('div');
      line.className = 'set-line';
      line.innerHTML = `세트 ${i + 1}: <span class="nums">${arr.map((n) => {
        return `<span class="chip">${n}</span>`;
      }).join('')}</span>`;
      setsHost.appendChild(line);
    });

    appendLog('완료!', 'ok');
  }

  /* ===================== 초기화/이벤트 ===================== */
  window.addEventListener('DOMContentLoaded', async () => {
    el = {
      // 상단
      previewType    : document.getElementById('previewType'),
      applyRound     : document.getElementById('applyRound'),
      // 중단(조건)
      totalRounds    : document.getElementById('totalRounds'),
      candidateCount : document.getElementById('candidateCount'),
      nonExposeCount : document.getElementById('nonExposeCount'),
      topKConstraint : document.getElementById('topKConstraint'),
      // 패턴 필터
      sumMin         : document.getElementById('sumMin'),
      sumMax         : document.getElementById('sumMax'),
      maxRun         : document.getElementById('maxRun'),
      maxSameEnd     : document.getElementById('maxSameEnd'),
      oddMin         : document.getElementById('oddMin'),
      oddMax         : document.getElementById('oddMax'),
      rollMin        : document.getElementById('rollMin'),
      rollMax        : document.getElementById('rollMax'),
      // 버튼
      runBtn         : document.getElementById('runBtn'),
      clearLogBtn    : document.getElementById('clearLogBtn'),
      pasteDataBtn   : document.getElementById('pasteDataBtn'),
      // 하단
      summary        : document.getElementById('summary'),
      table          : document.getElementById('table'),
      exposureSets   : document.getElementById('exposureSets'),
      typePanel      : document.getElementById('typePanel'),
      progress       : document.getElementById('progress')
    };

    try {
      // 이미 준비된 전역이 없다면 서버에서 로드(or 이벤트 대기)
      if (!window.numChosen) {
        appendLog('서버 데이터 로딩 중...');

        // 1) READY/ERROR 이벤트를 잠시 대기
        const waitReadyOrFetch = new Promise((resolve) => {
          let done = false;

          const onReady = () => {
            if (done) { return; }
            done = true;
            document.removeEventListener(EVT_READY, onReady);
            document.removeEventListener(EVT_ERROR, onError);
            resolve(true);
          };

          const onError = () => {
            if (done) { return; }
            done = true;
            document.removeEventListener(EVT_READY, onReady);
            document.removeEventListener(EVT_ERROR, onError);
            resolve(false);
          };

          document.addEventListener(EVT_READY, onReady, { once: true });
          document.addEventListener(EVT_ERROR, onError, { once: true });

          // 2) 1초 내에 이벤트가 없으면 직접 fetch
          setTimeout(async () => {
            if (done) { return; }
            try {
              window.numChosen = await fetchAllBingoAsNumChosen(9999);
              done = true;
              document.removeEventListener(EVT_READY, onReady);
              document.removeEventListener(EVT_ERROR, onError);
              resolve(true);
            } catch (fetchErr) {
              console.error(fetchErr);
              done = true;
              document.removeEventListener(EVT_READY, onReady);
              document.removeEventListener(EVT_ERROR, onError);
              resolve(false);
            }
          }, 1000);
        });

        const ok = await waitReadyOrFetch;
        if (!ok) {
          appendLog('서버 데이터 로드 실패: 재시도하거나 붙여넣기 기능을 사용하세요.', 'err');
          // 데이터 없이는 렌더 불가 → 버튼 바인딩만 유지
        } else {
          appendLog(`데이터 준비 완료: ${window.numChosen?.length ?? 0}건`);
        }
      }

      // 데이터가 준비된 경우에만 UI/렌더 수행
      if (window.numChosen && Array.isArray(window.numChosen) && window.numChosen.length > 0) {
        prepareDataOnce();
        if (!el.applyRound.value) {
          el.applyRound.value = ROUND_MAX; // 최신 회차 기본 선택
        }
        renderDataViewer(); // ✅ 모든 회차 표출
        renderAll();        // ✅ 최초 1회 실행
      }
    } catch (err) {
      console.error(err);
      appendLog('초기 데이터 준비 실패', 'err');
    }

    // 버튼 이벤트
    el.runBtn?.addEventListener('click', () => {
      renderAll();
    });

    // 미리보기 타입 변경 시 패널 포함 갱신
    el.previewType?.addEventListener('change', debounce(() => {
      renderAll();
    }, 120));

    // 데이터 붙여넣기 (서버 비가용 시 수동 운용)
    el.pasteDataBtn?.addEventListener('click', () => {
      const hint = '한 줄에 "회차, n1, n2, n3, n4, n5, n6, bonus" (쉼표/공백 모두 허용). 여러 줄 붙여넣기 가능.';
      const text = window.prompt(`numChosen 데이터 붙여넣기\n\n${hint}\n\n예) 1152, 1 5 9 14 23 38 19`);
      if (!text) {
        return;
      }

      const lines = text.split(/\r?\n/).map((s) => {
        return s.trim();
      }).filter(Boolean);

      const out = [];
      for (const line of lines) {
        const cols = line.split(/[,\s]+/).map((x) => {
          return x.trim();
        }).filter(Boolean).map(Number);

        if (cols.length >= 7) {
          const [round, n1, n2, n3, n4, n5, n6, bonus] = cols;
          if (Number.isFinite(round) && [n1, n2, n3, n4, n5, n6].every((v) => {
            return Number.isFinite(v);
          })) {
            out.push([round, n1, n2, n3, n4, n5, n6, Number.isFinite(bonus) ? bonus : 0]);
          }
        }
      }

      if (!out.length) {
        appendLog('붙여넣기 실패: 파싱된 행이 없습니다.', 'err');
        return;
      }

      window.numChosen = out;
      CLEANED   = null;
      ROUND_MIN = null;
      ROUND_MAX = null;

      try {
        prepareDataOnce();
        if (!el.applyRound.value) {
          el.applyRound.value = ROUND_MAX;
        }
        renderDataViewer();
        renderAll();
        appendLog(`붙여넣기 완료: ${out.length}행`, 'ok');
      } catch (e) {
        console.error(e);
        appendLog('붙여넣기 처리 실패', 'err');
      }
    });
  });
})();

/* =====================================================
 * Real Data (#dataViewer) 높이 확대/축소 핸들 + 상태 저장
 * (HTML 무수정, styles.css의 .rd-resize-handle 와 연동)
 * ===================================================== */
(function initRealDataHeightControl() {
  'use strict';

  window.addEventListener('DOMContentLoaded', () => {
    const wrap  = document.getElementById('dataViewer');
    const inner = document.getElementById('dataViewerInner');

    if (!wrap || !inner) {
      return;
    }

    // 핸들 1회만 생성
    if (!wrap.querySelector('.rd-resize-handle')) {
      const handle = document.createElement('div');
      handle.className = 'rd-resize-handle';
      wrap.appendChild(handle);
    }

    const handle = wrap.querySelector('.rd-resize-handle');

    // 저장 높이 복원 (px 단위, max-height 적용)
    const KEY   = 'ui:realdata:maxh';
    const saved = parseInt(localStorage.getItem(KEY), 10);
    if (Number.isFinite(saved) && saved >= 120) {
      inner.style.maxHeight = saved + 'px';
    }

    // 드래그 리사이즈
    let dragging = false;
    let sy       = 0;
    let sh       = 0;

    const MIN_H = 140; // 헤더 + 최소 3~4행 감안

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      sy = e.clientY;

      const cs = getComputedStyle(inner);
      sh = parseFloat(cs.maxHeight);
      if (!Number.isFinite(sh)) {
        sh = inner.offsetHeight;
      }

      document.body.style.cursor = 'row-resize';
      e.preventDefault();
    });

    const onMove = (e) => {
      if (!dragging) {
        return;
      }
      const nh = Math.max(MIN_H, sh + (e.clientY - sy));
      inner.style.maxHeight = nh + 'px';
    };

    const onUp = () => {
      if (!dragging) {
        return;
      }
      dragging = false;
      document.body.style.cursor = '';

      const nh = parseFloat(getComputedStyle(inner).maxHeight);
      if (Number.isFinite(nh)) {
        localStorage.setItem(KEY, String(Math.round(nh)));
      }
    };

    window.addEventListener('mousemove', (e) => {
      onMove(e);
    });
    window.addEventListener('mouseup', () => {
      onUp();
    });
  });
})();
