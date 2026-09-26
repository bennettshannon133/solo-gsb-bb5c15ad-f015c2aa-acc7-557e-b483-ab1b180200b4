// 前端逻辑（原生 JS，无框架、无打包）
// 所有周长/偏移/布长均以字符串保存与提交，服务端用 BigInt 计算，
// 返回的大整数也保持字符串，前端不经过 Number，避免精度丢失。

const MIN_ROLLERS = 2;
const MAX_ROLLERS = 8;

const els = {
  planSelect: document.getElementById('planSelect'),
  newBtn: document.getElementById('newBtn'),
  saveBtn: document.getElementById('saveBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  planName: document.getElementById('planName'),
  addRollerBtn: document.getElementById('addRollerBtn'),
  removeRollerBtn: document.getElementById('removeRollerBtn'),
  rollerRows: document.getElementById('rollerRows'),
  clothLength: document.getElementById('clothLength'),
  errorBox: document.getElementById('errorBox'),
  resultBox: document.getElementById('resultBox')
};

let currentId = null; // null = 未保存的新方案

// ---------- 色筒表格 ----------

function addRollerRow(perimeter = '', offset = '') {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-index"></td>
    <td><input class="perimeter" type="text" inputmode="numeric" placeholder="如 640" /></td>
    <td><input class="offset" type="text" inputmode="numeric" placeholder="如 120" /></td>
    <td><button type="button" class="row-remove" title="删除此筒">✕</button></td>
  `;
  tr.querySelector('.perimeter').value = perimeter;
  tr.querySelector('.offset').value = offset;
  tr.querySelector('.row-remove').addEventListener('click', () => {
    if (getRows().length <= MIN_ROLLERS) return;
    tr.remove();
    renumber();
    scheduleAnalyze();
  });
  tr.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', scheduleAnalyze);
  });
  els.rollerRows.appendChild(tr);
  renumber();
}

function getRows() {
  return [...els.rollerRows.querySelectorAll('tr')];
}

function renumber() {
  getRows().forEach((tr, i) => {
    tr.querySelector('.row-index').textContent = i + 1;
  });
  const count = getRows().length;
  els.addRollerBtn.disabled = count >= MAX_ROLLERS;
  els.removeRollerBtn.disabled = count <= MIN_ROLLERS;
  getRows().forEach((tr) => {
    tr.querySelector('.row-remove').disabled = count <= MIN_ROLLERS;
  });
}

function readForm() {
  return {
    name: els.planName.value,
    clothLength: els.clothLength.value,
    rollers: getRows().map((tr) => ({
      perimeter: tr.querySelector('.perimeter').value,
      offset: tr.querySelector('.offset').value
    }))
  };
}

function loadForm(plan) {
  els.rollerRows.innerHTML = '';
  plan.rollers.forEach((r) => addRollerRow(r.perimeter, r.offset));
  els.clothLength.value = plan.clothLength;
  els.planName.value = plan.name;
  renumber();
}

function resetForm() {
  els.rollerRows.innerHTML = '';
  addRollerRow('', '');
  addRollerRow('', '');
  els.clothLength.value = '100000';
  els.planName.value = '';
  currentId = null;
  syncSelect();
  renumber();
  scheduleAnalyze();
}

// ---------- 方案列表 ----------

async function refreshPlans(selectId = null) {
  const res = await fetch('/api/plans');
  const { plans } = await res.json();
  els.planSelect.innerHTML = '';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '（未保存的新方案）';
  els.planSelect.appendChild(emptyOpt);
  plans.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    els.planSelect.appendChild(opt);
  });
  if (selectId && plans.some((p) => p.id === selectId)) {
    currentId = selectId;
  } else if (!currentId || !plans.some((p) => p.id === currentId)) {
    currentId = null;
  }
  syncSelect();
}

function syncSelect() {
  els.planSelect.value = currentId || '';
  els.deleteBtn.disabled = currentId === null;
}

els.planSelect.addEventListener('change', async () => {
  const id = els.planSelect.value;
  if (!id) {
    resetForm();
    return;
  }
  const res = await fetch(`/api/plans/${id}`);
  if (!res.ok) {
    scheduleAnalyze();
    return;
  }
  const { plan } = await res.json();
  currentId = plan.id;
  loadForm(plan);
  syncSelect();
  scheduleAnalyze();
});

els.newBtn.addEventListener('click', resetForm);

els.saveBtn.addEventListener('click', async () => {
  const body = readForm();
  const url = currentId ? `/api/plans/${currentId}` : '/api/plans';
  const method = currentId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    showErrors(json.errors || [json.error || '保存失败']);
    return;
  }
  currentId = json.plan.id;
  await refreshPlans(currentId);
  showErrors(null);
  flashSaveNote(currentId ? '已保存修改' : '方案已保存');
  scheduleAnalyze();
});

els.deleteBtn.addEventListener('click', async () => {
  if (!currentId) return;
  const name = els.planName.value || '该方案';
  if (!window.confirm(`确认删除方案「${name}」？此操作不可撤销。`)) return;
  const res = await fetch(`/api/plans/${currentId}`, { method: 'DELETE' });
  if (!res.ok) {
    showErrors(['删除失败']);
    return;
  }
  currentId = null;
  await refreshPlans(null);
  resetForm();
});

let saveNoteTimer = null;
function flashSaveNote(text) {
  let note = document.querySelector('.save-note');
  if (!note) {
    note = document.createElement('span');
    note.className = 'save-note';
    els.saveBtn.after(note);
  }
  note.textContent = text;
  clearTimeout(saveNoteTimer);
  saveNoteTimer = setTimeout(() => { note.textContent = ''; }, 2500);
}

// ---------- 实时校核 ----------

let analyzeTimer = null;
function scheduleAnalyze() {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(analyze, 300);
}

async function analyze() {
  markLocalInvalid();
  const body = readForm();
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    showErrors(json.errors || [json.error || '计算失败']);
    els.resultBox.innerHTML = '<p class="placeholder">请修正输入参数…</p>';
    return;
  }
  showErrors(null);
  renderResult(json.result);
}

// 轻量本地检查，仅用于输入框红框提示；以服务端校验为准
function markLocalInvalid() {
  const isDigits = (s) => /^[0-9]+$/.test(s.trim());
  getRows().forEach((tr) => {
    const pInput = tr.querySelector('.perimeter');
    const oInput = tr.querySelector('.offset');
    const pRaw = pInput.value.trim();
    const oRaw = oInput.value.trim();
    let pBad = !isDigits(pRaw);
    let oBad = !isDigits(oRaw);
    if (isDigits(pRaw)) {
      try {
        if (BigInt(pRaw) === 0n) pBad = true;
        if (isDigits(oRaw) && BigInt(oRaw) >= BigInt(pRaw)) oBad = true;
      } catch { /* ignore */ }
    }
    pInput.classList.toggle('invalid', pBad);
    oInput.classList.toggle('invalid', oBad);
  });
  els.clothLength.classList.toggle('invalid', !isDigits(els.clothLength.value));
}

function showErrors(errors) {
  if (!errors || errors.length === 0) {
    els.errorBox.hidden = true;
    els.errorBox.innerHTML = '';
    return;
  }
  els.errorBox.hidden = false;
  els.errorBox.innerHTML = '输入存在问题：<ul>' +
    errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('') + '</ul>';
}

// ---------- 结果渲染 ----------

function renderResult(r) {
  if (!r.solvable) {
    const p = r.incompatiblePair;
    els.resultBox.innerHTML = `
      <span class="status fail">✕ 永不对花（同余方程组无解）</span>
      <div class="incompat">
        广义中国剩余定理判定：存在一对色筒互不相容——
        其标记偏移之差不能被两筒周长的最大公约数整除，因此不存在任何位置使两筒标记同时出现。
        <table>
          <thead>
            <tr><th>色筒</th><th>重复周长 (mm)</th><th>标记偏移 (mm)</th></tr>
          </thead>
          <tbody>
            <tr><td>第 ${p.a + 1} 筒</td><td>${fmt(p.perimeterA)}</td><td>${fmt(p.offsetA)}</td></tr>
            <tr><td>第 ${p.b + 1} 筒</td><td>${fmt(p.perimeterB)}</td><td>${fmt(p.offsetB)}</td></tr>
          </tbody>
        </table>
        <p>不相容条件验证：两筒周长 gcd = <strong>${fmt(p.gcd)}</strong>，
        偏移差（${fmt(p.offsetB)} − ${fmt(p.offsetA)} = ${fmt(bigSubAbs(p.offsetB, p.offsetA))}）
        不能被该 gcd 整除。</p>
      </div>`;
    return;
  }

  const positionsRows = r.positions
    .map((x, i) => `<tr><td class="idx">${i + 1}</td><td>${fmt(x)}</td></tr>`)
    .join('');

  const clothRaw = els.clothLength.value.trim();
  const headNote = r.firstPosition === '0'
    ? '首次对花恰好在布头 0 mm 处（所有偏移为 0 时必然如此）。'
    : '';

  els.resultBox.innerHTML = `
    <span class="status ok">✓ 存在对花位置</span>
    ${headNote ? `<p class="hint">${headNote}</p>` : ''}
    <div class="metric-grid">
      <div class="metric">
        <div class="label">首次同时对花位置（距布头）</div>
        <div class="value">${fmt(r.firstPosition)} mm</div>
      </div>
      <div class="metric">
        <div class="label">共同重复周期 LCM</div>
        <div class="value">${fmt(r.period)} mm</div>
      </div>
      <div class="metric wide">
        <div class="label">布长 ${fmt(clothRaw)} mm 内对花点总数（含两端边界）</div>
        <div class="value">${fmt(r.totalInCloth)} 个</div>
      </div>
    </div>
    <div class="positions-wrap">
      <h3>布长内最早的 ${r.positions.length} 个对花位置${r.truncated ? `（共 ${fmt(r.totalInCloth)} 个，仅显示前 20 个）` : ''}</h3>
      ${r.positions.length > 0
        ? `<table class="positions-table">
             <thead><tr><th>序号</th><th>距布头位置 (mm)</th></tr></thead>
             <tbody>${positionsRows}</tbody>
           </table>`
        : '<p class="empty-note">首次对花位置已超出布长范围，布内没有对花点。可增大布长后重新校核。</p>'}
    </div>`;
}

// 大整数（十进制字符串）按千位加逗号；原始值放 title
function fmt(numStr) {
  const s = String(numStr ?? '');
  const withCommas = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `<span title="${escapeHtml(s)}">${withCommas}</span>`;
}

// 对两个十进制字符串求 |a-b|（避免 Number 转换）
function bigSubAbs(a, b) {
  const cmp = a.length === b.length
    ? (a < b ? -1 : a > b ? 1 : 0)
    : a.length - b.length;
  if (cmp === 0) return '0';
  const [max, min] = cmp > 0 ? [a, b] : [b, a];
  let i = max.length - 1;
  let j = min.length - 1;
  let borrow = 0;
  let out = '';
  while (i >= 0) {
    let d = Number(max[i]) - borrow - (j >= 0 ? Number(min[j]) : 0);
    if (d < 0) { d += 10; borrow = 1; } else { borrow = 0; }
    out = String(d) + out;
    i--; j--;
  }
  return out.replace(/^0+(?=\d)/, '');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- 初始化 ----------

els.clothLength.addEventListener('input', scheduleAnalyze);
els.addRollerBtn.addEventListener('click', () => {
  if (getRows().length >= MAX_ROLLERS) return;
  addRollerRow('', '');
  scheduleAnalyze();
});
els.removeRollerBtn.addEventListener('click', () => {
  const rows = getRows();
  if (rows.length <= MIN_ROLLERS) return;
  rows[rows.length - 1].remove();
  renumber();
  scheduleAnalyze();
});

(async function init() {
  await refreshPlans();
  resetForm();
})();
