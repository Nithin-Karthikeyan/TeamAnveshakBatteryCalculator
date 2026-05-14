// --- UTILS & CONSTANTS -----------------------------------------
const H_CONV = 0.015; // W/mm²·°C convection coefficient

const CHEMISTRY_PRESETS = {
  LFP:  { vmax: 3.65, vnom: 3.2,  vmin: 2.5  },
  NMC:  { vmax: 4.2,  vnom: 3.6,  vmin: 2.8  },
  LTO:  { vmax: 2.85, vnom: 2.3,  vmin: 1.8  },
  NCA:  { vmax: 4.2,  vnom: 3.6,  vmin: 2.7  },
  custom: null
};

function fmt(v, dec = 4) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return parseFloat(v.toFixed(dec)).toString();
}

function animateValue(el, target, dec = 4) {
  const start = parseFloat(el.textContent) || 0;
  if (isNaN(target)) { el.textContent = '—'; return; }
  const duration = 400;
  const startTime = performance.now();
  
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(start + (target - start) * ease, dec);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setStatus(bannerId, badgeId, detailId, iconId, safe, detail) {
  const banner = document.getElementById(bannerId);
  const badge = document.getElementById(badgeId);
  const det = document.getElementById(detailId);
  const icon = document.getElementById(iconId);
  
  banner.className = 'status-banner visible ' + (safe ? 'safe' : 'danger');
  badge.textContent = safe ? '✓  SAFE' : '✗  FAILURE';
  det.textContent = detail;
  icon.textContent = safe ? '🟢' : '🔴';
}

// --- GLOBAL HANDLERS -------------------------------------------
function switchTab(idx) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
}

function updateResistivity(tab) {
  const mat = document.getElementById(`${tab}-material`).value;
  document.getElementById(`${tab}-rho`).value = mat;
}

// --- TAB 1: TEMPERATURE RISE ----------------------------------
function calcTempRise() {
  const rho = parseFloat(document.getElementById('t1-rho').value);
  const t = parseFloat(document.getElementById('t1-thickness').value);
  const w = parseFloat(document.getElementById('t1-width').value);
  const L = parseFloat(document.getElementById('t1-length').value);
  const I = parseFloat(document.getElementById('t1-current').value);
  const strips = parseFloat(document.getElementById('t1-strips').value) || 1;
  const T_amb = parseFloat(document.getElementById('t1-ambient').value);
  const T_max = parseFloat(document.getElementById('t1-maxtemp').value);

  const A_cs = t * w;                         
  const A_surf_mm2 = 2 * w * L;
  const I_strip = I / strips;
  const R = (rho * L) / (A_cs * strips);   
  const P = (I_strip * I_strip * R) / 1000;  
  const dT = P / (H_CONV * A_surf_mm2);
  const T_final = T_amb + dT;
  const margin = T_max - T_final;

  animateValue(document.getElementById('t1-out-csa'), A_cs, 4);
  animateValue(document.getElementById('t1-out-sa'), A_surf_mm2, 4);
  animateValue(document.getElementById('t1-out-r'), R, 6);
  animateValue(document.getElementById('t1-out-istrip'), I_strip, 3);
  animateValue(document.getElementById('t1-out-p'), P, 6);
  animateValue(document.getElementById('t1-out-dt'), dT, 4);
  animateValue(document.getElementById('t1-out-tf'), T_final, 4);
  animateValue(document.getElementById('t1-out-margin'), margin, 2);

  const safe = T_final <= T_max;
  const detail = safe
    ? `Final temp ${fmt(T_final, 2)}°C — ${fmt(margin, 2)}°C below limit of ${T_max}°C`
    : `Final temp ${fmt(T_final, 2)}°C — exceeds limit by ${fmt(-margin, 2)}°C!`;
    
  setStatus('t1-status', 't1-status-badge', 't1-status-detail', 't1-status-icon', safe, detail);
}

// --- TAB 2: CONDUCTOR SIZING -----------------------------------
function calcSizing() {
  const rho = parseFloat(document.getElementById('t2-rho').value);
  const t = parseFloat(document.getElementById('t2-thickness').value);
  const L = parseFloat(document.getElementById('t2-length').value);
  const strips = parseFloat(document.getElementById('t2-strips').value) || 1;
  const I = parseFloat(document.getElementById('t2-current').value);
  const T_amb = parseFloat(document.getElementById('t2-ambient').value);
  const T_max = parseFloat(document.getElementById('t2-maxtemp').value);

  const I_strip = I / strips;
  let w = 0.1;
  let found = false;
  let T_final, dT, R, P, A_cs, A_surf_mm2;

  while (w <= 5000) {
    A_cs = t * w;
    A_surf_mm2 = 2 * w * L;
    R = (rho * L) / (A_cs * strips);
    P = (I_strip * I_strip * R) / 1000;
    dT = P / (H_CONV * A_surf_mm2);
    T_final = T_amb + dT;
    if (T_final <= T_max) { found = true; break; }
    w += 0.1;
  }

  if (!found) {
    alert('No solution found within 5000mm width — check parameters');
    return;
  }

  const w_rounded = Math.ceil(w / 0.5) * 0.5;
  
  A_cs = t * w_rounded;
  A_surf_mm2 = 2 * w_rounded * L;
  R = (rho * L) / (A_cs * strips);
  P = (I_strip * I_strip * R) / 1000;
  dT = P / (H_CONV * A_surf_mm2);
  T_final = T_amb + dT;
  const margin = T_max - T_final;

  document.getElementById('t2-sizing-result').classList.add('visible');
  document.getElementById('t2-out-width').textContent = w_rounded + ' mm';

  animateValue(document.getElementById('t2-out-csa'), A_cs, 4);
  animateValue(document.getElementById('t2-out-r'), R, 6);
  animateValue(document.getElementById('t2-out-p'), P, 6);
  animateValue(document.getElementById('t2-out-dt'), dT, 4);
  animateValue(document.getElementById('t2-out-tf'), T_final, 4);
  animateValue(document.getElementById('t2-out-margin'), margin, 2);

  const safe = T_final <= T_max;
  const detail = `Min width: ${w_rounded}mm | Final temp: ${fmt(T_final, 2)}°C | Margin: ${fmt(margin, 2)}°C`;
  setStatus('t2-status', 't2-status-badge', 't2-status-detail', 't2-status-icon', safe, detail);
}

// --- TAB 3: PACK DESIGN ----------------------------------------
function setPreset(e, name) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  
  if (name !== 'custom' && CHEMISTRY_PRESETS[name]) {
    document.getElementById('p-vmax').value = CHEMISTRY_PRESETS[name].vmax;
    document.getElementById('p-vnom').value = CHEMISTRY_PRESETS[name].vnom;
    document.getElementById('p-vmin').value = CHEMISTRY_PRESETS[name].vmin;
  }
}

function updateTopologyViz() {
  const S = parseInt(document.getElementById('p-series').value) || 1;
  const P = parseInt(document.getElementById('p-parallel').value) || 1;
  const viz = document.getElementById('topology-viz');
  const label = document.getElementById('topology-label');
  
  label.textContent = `${S}S${P}P — ${S * P} cells total`;
  const maxShow = 40;
  const totalCells = S * P;
  viz.innerHTML = '';

  if (totalCells > maxShow) {
    viz.innerHTML = `<div style="color:var(--text3);font-size:11px;letter-spacing:1px;">${S}S${P}P — ${totalCells} cells (too many to render)</div>`;
    return;
  }

  for (let s = 0; s < S; s++) {
    const grp = document.createElement('div');
    grp.className = 'series-group';
    for (let p = 0; p < P; p++) {
      const cell = document.createElement('div');
      cell.className = 'cell-block';
      grp.appendChild(cell);
    }
    viz.appendChild(grp);
  }
}

function calcPack() {
  const vmax = parseFloat(document.getElementById('p-vmax').value);
  const vnom = parseFloat(document.getElementById('p-vnom').value);
  const vmin = parseFloat(document.getElementById('p-vmin').value);
  const cap = parseFloat(document.getElementById('p-cap').value);
  const S = parseInt(document.getElementById('p-series').value);
  const P = parseInt(document.getElementById('p-parallel').value);

  const pack_vnom = vnom * S;
  const pack_vmax = vmax * S;
  const pack_vmin = vmin * S;
  const pack_cap = cap * P;

  const E_total = pack_vnom * pack_cap;
  const E_usable = (vmax - vmin) * cap * P * S;
  const pct = (E_usable / E_total) * 100;

  animateValue(document.getElementById('p-out-vnom'), pack_vnom, 2);
  animateValue(document.getElementById('p-out-vmax'), pack_vmax, 2);
  animateValue(document.getElementById('p-out-vmin'), pack_vmin, 2);
  animateValue(document.getElementById('p-out-cap'), pack_cap, 2);
  animateValue(document.getElementById('p-out-etotal'), E_total, 1);
  animateValue(document.getElementById('p-out-eusable'), E_usable, 1);

  document.getElementById('energy-bar-wrap').style.display = 'block';
  setTimeout(() => {
    document.getElementById('bar-usable').style.width = pct + '%';
  }, 100);
  
  document.getElementById('bar-label-usable').textContent = `Usable: ${fmt(E_usable, 1)} Wh`;
  document.getElementById('bar-label-total').textContent = `Total: ${fmt(E_total, 1)} Wh`;
  document.getElementById('bar-pct').textContent = fmt(pct, 1) + '% usable';
}

// --- INITIALIZATION --------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  updateTopologyViz();
});