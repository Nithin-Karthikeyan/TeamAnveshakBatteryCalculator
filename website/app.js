// --- PHYSICS CONSTANTS ---
const H_CONV = 15e-6; // W/mm²·°C (Realistic Air)

const MAT_PROPS = {
    nickel:   { rho20: 0.0699, alpha: 0.006 },
    copper:   { rho20: 0.0172, alpha: 0.00393 },
    aluminum: { rho20: 0.0265, alpha: 0.00429 }
};

const CHEMISTRY_PRESETS = {
    LFP:  { vmax: 3.65, vnom: 3.2,  vmin: 2.5  },
    NMC:  { vmax: 4.2,  vnom: 3.6,  vmin: 2.8  },
    LTO:  { vmax: 2.85, vnom: 2.3,  vmin: 1.8  },
    NCA:  { vmax: 4.2,  vnom: 3.6,  vmin: 2.7  },
    custom: null
};

// --- CORE UTILS ---

function fmt(v, dec = 4) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return parseFloat(v.toFixed(dec)).toLocaleString();
}

function updateTab1() {
    // 1. Get Base Inputs
    const matKey = document.getElementById('t1-material').value;
    const t_amb = parseFloat(document.getElementById('t1-ambient').value) || 0;
    const current = parseFloat(document.getElementById('t1-current').value) || 0;
    const strips = parseFloat(document.getElementById('t1-strips').value) || 1;
    const t_max = parseFloat(document.getElementById('t1-maxtemp').value) || 0;

    // 2. Get Geometry scales (convert to mm)
    const t_scale = parseFloat(document.getElementById('t1-t-unit').value) || 1;
    const w_scale = parseFloat(document.getElementById('t1-w-unit').value) || 1;
    const l_scale = parseFloat(document.getElementById('t1-l-unit').value) || 1;

    // Convert all geometric inputs to mm for standard calculation
    const thickness = (parseFloat(document.getElementById('t1-thickness').value) || 0) * t_scale;
    const width = (parseFloat(document.getElementById('t1-width').value) || 0) * w_scale;
    const length = (parseFloat(document.getElementById('t1-length').value) || 0) * l_scale;

    // 3. Calc Resistivity (T-dependent)
    const props = MAT_PROPS[matKey];
    const rho = props.rho20 * (1 + props.alpha * (t_amb - 20));
    
    // UI Update for rho
    document.getElementById('t1-rho-val').textContent = rho.toFixed(5);
    document.getElementById('t1-temp-ref').textContent = t_amb;

    // 4. Electrical & Thermal Model
    const a_cs = thickness * width;                         
    const a_surf = 2 * width * length; 
    
    // Early exit if 0 to prevent Infinity
    if (a_cs <= 0 || a_surf <= 0 || strips <= 0) {
        return;
    }

    const r = (rho * length) / (a_cs * strips); // mΩ
    const i_strip = current / strips;
    const p = (Math.pow(i_strip, 2) * r * strips) / 1000; // Watts
    
    const dt = p / (H_CONV * a_surf * strips);
    const t_final = t_amb + dt;
    const margin = t_max - t_final;

    // 5. Instant UI Update
    document.getElementById('t1-out-csa').textContent = fmt(a_cs, 2);
    document.getElementById('t1-out-sa').textContent = fmt(a_surf, 2);
    document.getElementById('t1-out-istrip').textContent = fmt(i_strip, 2);
    document.getElementById('t1-out-r').textContent = fmt(r, 4);
    document.getElementById('t1-out-p').textContent = fmt(p, 4);
    document.getElementById('t1-out-dt').textContent = fmt(dt, 2);
    document.getElementById('t1-out-tf').textContent = fmt(t_final, 2);

    // 6. Dynamic Gradient Card & Status Formatter
    const finalCard = document.getElementById('t1-final-card');
    const stateText = document.getElementById('t1-status-state');
    const marginText = document.getElementById('t1-status-margin');
    
    // Reset Classes
    finalCard.classList.remove('status-safe', 'status-warning', 'status-danger');

    // Thresholds: Danger (margin <= 0), Warning (margin <= 10 degrees close to limit), Safe (otherwise)
    if (margin <= 0) {
        finalCard.classList.add('status-danger');
        stateText.innerHTML = `Status: <span style="color:var(--danger)">Danger</span>`;
        marginText.innerHTML = `Margin: <span style="color:var(--danger)">${fmt(margin, 2)}°C</span>`;
    } else if (margin <= 10) {
        finalCard.classList.add('status-warning');
        stateText.innerHTML = `Status: <span style="color:var(--warn)">Caution</span>`;
        marginText.innerHTML = `Margin: <span style="color:var(--warn)">+${fmt(margin, 2)}°C</span>`;
    } else {
        finalCard.classList.add('status-safe');
        stateText.innerHTML = `Status: <span style="color:var(--accent)">Safe</span>`;
        marginText.innerHTML = `Margin: <span style="color:var(--accent)">+${fmt(margin, 2)}°C</span>`;
    }
}

// --- TAB 2: CONDUCTOR SIZING (Live Update) ---
function updateTab2() {
    // Graceful fallback for inputs missing from DOM
    const matEl = document.getElementById('t2-material');
    if (!matEl) return; 

    const matKey = matEl.value;
    const t_amb = parseFloat(document.getElementById('t2-ambient')?.value) || 25;
    const current = parseFloat(document.getElementById('t2-current')?.value) || 0;
    const strips = parseFloat(document.getElementById('t2-strips')?.value) || 1;
    const t_max = parseFloat(document.getElementById('t2-maxtemp')?.value) || 60;

    const t_scale = parseFloat(document.getElementById('t2-t-unit')?.value) || 1;
    const l_scale = parseFloat(document.getElementById('t2-l-unit')?.value) || 1;

    const thickness = (parseFloat(document.getElementById('t2-thickness')?.value) || 0) * t_scale;
    const length = (parseFloat(document.getElementById('t2-length')?.value) || 0) * l_scale;

    if (thickness <= 0 || length <= 0 || strips <= 0 || current <= 0) return;

    const props = MAT_PROPS[matKey];
    const rho = props.rho20 * (1 + props.alpha * (t_amb - 20));

    // Optional dynamic UI Updates for rho
    const rhoValEl = document.getElementById('t2-rho-val');
    if (rhoValEl) rhoValEl.textContent = rho.toFixed(5);
    const tempRefEl = document.getElementById('t2-temp-ref');
    if (tempRefEl) tempRefEl.textContent = t_amb;

    const i_strip = current / strips;
    let w = 0.1;
    let found = false;
    let T_final, dT, R, P, A_cs, A_surf;

    // Iterative Solver for Width
    while (w <= 5000) {
        A_cs = thickness * w;
        A_surf = 2 * w * length;
        R = (rho * length) / (A_cs * strips);
        P = (Math.pow(i_strip, 2) * R * strips) / 1000;
        dT = P / (H_CONV * A_surf * strips);
        T_final = t_amb + dT;
        
        if (T_final <= t_max) { 
            found = true; break; 
        }
        w += 0.1;
    }

    if (!found) return;

    const w_rounded = Math.ceil(w / 0.5) * 0.5;
    A_cs = thickness * w_rounded;
    A_surf = 2 * w_rounded * length;
    R = (rho * length) / (A_cs * strips);
    P = (Math.pow(i_strip, 2) * R * strips) / 1000;
    dT = P / (H_CONV * A_surf * strips);
    T_final = t_amb + dT;
    const margin = t_max - T_final;

    // Real-Time Output Binding
    const outWidth = document.getElementById('t2-out-width');
    if (outWidth) outWidth.textContent = fmt(w_rounded, 1);

    const checkAndSet = (id, val, dec) => {
        const el = document.getElementById(id);
        if (el) el.textContent = fmt(val, dec);
    };

    checkAndSet('t2-out-csa', A_cs, 2);
    checkAndSet('t2-out-r', R, 4);
    checkAndSet('t2-out-p', P, 4);
    checkAndSet('t2-out-dt', dT, 2);
    checkAndSet('t2-out-tf', T_final, 2);

    // Dynamic Gradient Card & Status Formatter
    const finalCard = document.getElementById('t2-final-card');
    const stateText = document.getElementById('t2-status-state');
    const marginText = document.getElementById('t2-status-margin');
    
    if (finalCard && stateText && marginText) {
        finalCard.classList.remove('status-safe', 'status-warning', 'status-danger');

        if (margin <= 0) {
            finalCard.classList.add('status-danger');
            stateText.innerHTML = `Status: <span style="color:var(--danger)">Danger</span>`;
            marginText.innerHTML = `Margin: <span style="color:var(--danger)">${fmt(margin, 2)}°C</span>`;
        } else if (margin <= 10) {
            finalCard.classList.add('status-warning');
            stateText.innerHTML = `Status: <span style="color:var(--warn)">Caution</span>`;
            marginText.innerHTML = `Margin: <span style="color:var(--warn)">+${fmt(margin, 2)}°C</span>`;
        } else {
            finalCard.classList.add('status-safe');
            stateText.innerHTML = `Status: <span style="color:var(--accent)">Safe</span>`;
            marginText.innerHTML = `Margin: <span style="color:var(--accent)">+${fmt(margin, 2)}°C</span>`;
        }
    }
}

// --- TAB 3: PACK DESIGN (Live Update) ---

function setPreset(e, name) {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    if (e) e.target.classList.add('active');
    
    if (name !== 'custom' && CHEMISTRY_PRESETS[name]) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.value = val;
        };
        setVal('p-vmax', CHEMISTRY_PRESETS[name].vmax);
        setVal('p-vnom', CHEMISTRY_PRESETS[name].vnom);
        setVal('p-vmin', CHEMISTRY_PRESETS[name].vmin);
    }
    updateTab3();
}

function updateTopologyViz() {
    const sEl = document.getElementById('p-series');
    if (!sEl) return;

    const S = parseInt(sEl.value) || 1;
    const P = parseInt(document.getElementById('p-parallel')?.value) || 1;
    const viz = document.getElementById('topology-viz');
    const label = document.getElementById('topology-label');
    
    if (label) label.textContent = `${S}S${P}P — ${S * P} cells total`;
    const maxShow = 60;
    const totalCells = S * P;
    
    if (viz) {
        viz.innerHTML = '';
        if (totalCells > maxShow) {
            viz.innerHTML = `<div style="color:var(--text3);font-size:11px;letter-spacing:1px;">${S}S${P}P — ${totalCells} cells (too many to render)</div>`;
        } else {
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
    }
    updateTab3();
}

function updateTab3() {
    const vmax = parseFloat(document.getElementById('p-vmax')?.value) || 0;
    const vnom = parseFloat(document.getElementById('p-vnom')?.value) || 0;
    const vmin = parseFloat(document.getElementById('p-vmin')?.value) || 0;
    const cap = parseFloat(document.getElementById('p-cap')?.value) || 0;
    const S = parseInt(document.getElementById('p-series')?.value) || 1;
    const P = parseInt(document.getElementById('p-parallel')?.value) || 1;

    const pack_vnom = vnom * S;
    const pack_vmax = vmax * S;
    const pack_vmin = vmin * S;
    const pack_cap = cap * P;

    const E_total = pack_vnom * pack_cap;
    const E_usable = (vmax - vmin) * cap * P * S;
    const pct = E_total > 0 ? (E_usable / E_total) * 100 : 0;

    const checkAndSet = (id, val, dec) => {
        const el = document.getElementById(id);
        if (el) el.textContent = fmt(val, dec);
    };

    checkAndSet('p-out-vnom', pack_vnom, 2);
    checkAndSet('p-out-vmax', pack_vmax, 2);
    checkAndSet('p-out-vmin', pack_vmin, 2);
    checkAndSet('p-out-cap', pack_cap, 2);
    checkAndSet('p-out-etotal', E_total, 1);
    checkAndSet('p-out-eusable', E_usable, 1);

    const wrap = document.getElementById('energy-bar-wrap');
    if (wrap) wrap.style.display = 'block';
    
    const barUsable = document.getElementById('bar-usable');
    if (barUsable) barUsable.style.width = pct + '%';
    
    const lblUsable = document.getElementById('bar-label-usable');
    if (lblUsable) lblUsable.textContent = `Usable: ${fmt(E_usable, 1)} Wh`;
    
    const lblTotal = document.getElementById('bar-label-total');
    if (lblTotal) lblTotal.textContent = `Total: ${fmt(E_total, 1)} Wh`;
    
    const barPct = document.getElementById('bar-pct');
    if (barPct) barPct.textContent = fmt(pct, 1) + '% usable';
}

function switchTab(idx) {
    document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
    document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
}

window.onload = () => {
    updateTab1();
    updateTab2();
    updateTopologyViz(); 
};