/* Pantone Solid Coated Quick Reference — vanilla JS */

const STATE = {
  colors: [],
  filtered: [],
  sort: 'hue',
  query: '',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Color math (Lab/RGB/CIEDE2000) ──

const XN = 95.047, YN = 100.0, ZN = 108.883;

function srgbCompanding(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
}
function invSrgb(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function fLab(t) {
  const d = 6/29;
  return t > d*d*d ? Math.cbrt(t) : t / (3*d*d) + 4/29;
}
function rgbToLab(r, g, b) {
  const rl = invSrgb(r/255), gl = invSrgb(g/255), bl = invSrgb(b/255);
  const X = 100 * (0.4124564*rl + 0.3575761*gl + 0.1804375*bl);
  const Y = 100 * (0.2126729*rl + 0.7151522*gl + 0.0721750*bl);
  const Z = 100 * (0.0193339*rl + 0.1191920*gl + 0.9503041*bl);
  const fx = fLab(X/XN), fy = fLab(Y/YN), fz = fLab(Z/ZN);
  return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
}
function cmykToRgb(c, m, y, k) {
  c/=100; m/=100; y/=100; k/=100;
  return [Math.round(255*(1-c)*(1-k)), Math.round(255*(1-m)*(1-k)), Math.round(255*(1-y)*(1-k))];
}
function cmykToLab(c, m, y, k) {
  return rgbToLab(...cmykToRgb(c, m, y, k));
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)];
}

function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1*a1 + b1*b1);
  const C2 = Math.sqrt(a2*a2 + b2*b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC,7) / (Math.pow(avgC,7) + Math.pow(25,7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p*a1p + b1*b1);
  const C2p = Math.sqrt(a2p*a2p + b2*b2);
  const avgCp = (C1p + C2p) / 2;
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
  const avgHp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;
  const T = 1
    - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * avgHp) * Math.PI / 180)
    + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
  let dhp = h2p - h1p;
  if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * Math.PI / 180);
  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const RT = -RC * Math.sin((2 * dTheta) * Math.PI / 180);
  return Math.sqrt(
    Math.pow(dLp / SL, 2)
    + Math.pow(dCp / SC, 2)
    + Math.pow(dHp / SH, 2)
    + RT * (dCp / SC) * (dHp / SH)
  );
}

// ── Render ──

function render() {
  const q = STATE.query.trim().toLowerCase();
  let filtered = STATE.colors;

  if (q) {
    // HEX判定（# で始まる or 6文字hex）
    const hexMatch = q.match(/^#?([0-9a-f]{6})$/i);
    if (hexMatch) {
      const targetLab = rgbToLab(...hexToRgb('#' + hexMatch[1]));
      filtered = STATE.colors
        .map(c => ({ ...c, _de: deltaE2000(targetLab, c.lab) }))
        .sort((a, b) => a._de - b._de)
        .slice(0, 100);
    } else {
      filtered = STATE.colors.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }
  } else {
    // 通常ソート
    const key = STATE.sort;
    if (key === 'hue') {
      filtered = [...filtered].sort((a, b) => {
        // 無彩色（彩度極低）は最後に
        if (a.s < 0.05 && b.s >= 0.05) return 1;
        if (b.s < 0.05 && a.s >= 0.05) return -1;
        if (a.h !== b.h) return a.h - b.h;
        return a.l - b.l;
      });
    } else if (key === 'code') {
      filtered = [...filtered].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    } else if (key === 'light') {
      filtered = [...filtered].sort((a, b) => b.l - a.l);
    }
  }

  STATE.filtered = filtered;
  $('#count').textContent = filtered.length.toLocaleString();

  const grid = $('#grid');
  const empty = $('#empty');
  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // バッチ描画（DocumentFragment）
  const frag = document.createDocumentFragment();
  for (const c of filtered) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="swatch" style="background:${c.hex}"></div>
      <div class="card-body">
        <div class="card-name">${escape(c.name)}</div>
        <div class="card-hex">${c.hex}</div>
        <div class="card-cmyk">C${c.cmyk[0]} M${c.cmyk[1]} Y${c.cmyk[2]} K${c.cmyk[3]}</div>
      </div>
    `;
    card.addEventListener('click', () => openDetail(c));
    frag.appendChild(card);
  }
  grid.replaceChildren(frag);
}

function escape(s) {
  return s.replace(/[<>&"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]));
}

function openDetail(c) {
  const dlg = $('#detail');
  const content = dlg.querySelector('.detail-content');
  content.innerHTML = `
    <div class="detail-swatch" style="background:${c.hex}"></div>
    <div class="detail-body">
      <div class="detail-name">${escape(c.name)}</div>
      <div class="detail-row">
        <span class="detail-label">HEX</span>
        <span class="detail-value">${c.hex}</span>
        <button class="copy-btn" data-copy="${c.hex}">コピー</button>
      </div>
      <div class="detail-row">
        <span class="detail-label">CMYK</span>
        <span class="detail-value">C${c.cmyk[0]} M${c.cmyk[1]} Y${c.cmyk[2]} K${c.cmyk[3]}</span>
        <button class="copy-btn" data-copy="C${c.cmyk[0]} M${c.cmyk[1]} Y${c.cmyk[2]} K${c.cmyk[3]}">コピー</button>
      </div>
      <div class="detail-row">
        <span class="detail-label">Lab</span>
        <span class="detail-value">L ${c.lab[0]} / a ${c.lab[1]} / b ${c.lab[2]}</span>
        <button class="copy-btn" data-copy="L ${c.lab[0]} a ${c.lab[1]} b ${c.lab[2]}">コピー</button>
      </div>
      <div class="detail-row">
        <span class="detail-label">Code</span>
        <span class="detail-value">${c.code}</span>
      </div>
    </div>
  `;
  dlg.showModal();
}

// ── CMYK search dialog ──

function runCmykSearch() {
  const c = parseFloat($('#c').value) || 0;
  const m = parseFloat($('#m').value) || 0;
  const y = parseFloat($('#y').value) || 0;
  const k = parseFloat($('#k').value) || 0;
  const lab = cmykToLab(c, m, y, k);
  const scored = STATE.colors
    .map(col => ({ col, de: deltaE2000(lab, col.lab) }))
    .sort((a, b) => a.de - b.de)
    .slice(0, 5);
  const container = $('.cmyk-results');
  container.innerHTML = scored.map(({ col, de }, i) => `
    <div class="cmyk-result-row" data-code="${col.code}">
      <div class="cmyk-chip" style="background:${col.hex}"></div>
      <div class="cmyk-meta">
        <span class="cmyk-meta-name">${i === 0 ? '★ ' : ''}${escape(col.name)}</span>
        <span class="cmyk-meta-de">ΔE=${de.toFixed(2)}  ${col.hex}  C${col.cmyk[0]} M${col.cmyk[1]} Y${col.cmyk[2]} K${col.cmyk[3]}</span>
      </div>
    </div>
  `).join('');
  // クリックで詳細
  container.querySelectorAll('.cmyk-result-row').forEach(row => {
    row.addEventListener('click', () => {
      const c = STATE.colors.find(c => c.code === row.dataset.code);
      if (c) { $('#cmyk-search').close(); openDetail(c); }
    });
  });
}

// ── Init ──

async function init() {
  const res = await fetch('data.json');
  STATE.colors = await res.json();
  render();

  $('#search').addEventListener('input', (e) => {
    STATE.query = e.target.value;
    render();
  });

  $$('.sort-group button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.sort-group button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.sort = btn.dataset.sort;
      render();
    });
  });

  // Detail dialog
  const dlg = $('#detail');
  dlg.addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) dlg.close();
    if (e.target.classList.contains('copy-btn')) {
      navigator.clipboard.writeText(e.target.dataset.copy);
      e.target.classList.add('copied');
      e.target.textContent = 'コピー済';
      setTimeout(() => {
        e.target.classList.remove('copied');
        e.target.textContent = 'コピー';
      }, 1200);
    }
  });
  dlg.addEventListener('cancel', () => dlg.close());

  // CMYK search
  $('#cmyk-link').addEventListener('click', (e) => {
    e.preventDefault();
    $('#cmyk-search').showModal();
    runCmykSearch();
  });
  $('#cmyk-run').addEventListener('click', runCmykSearch);
  ['c','m','y','k'].forEach(id => {
    $('#' + id).addEventListener('input', () => {
      clearTimeout(window._cmykDebounce);
      window._cmykDebounce = setTimeout(runCmykSearch, 200);
    });
  });
}

init();
