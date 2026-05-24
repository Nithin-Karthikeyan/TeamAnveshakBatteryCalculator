// --- PHYSICS CONSTANTS ---
const H_CONV = 15e-6; // W/mm²·°C (Realistic Air)

const MAT_PROPS = {
    nickel:   { rho20: 0.0699, alpha: 0.006 },
    copper:   { rho20: 0.0172, alpha: 0.00393 },
    aluminum: { rho20: 0.0265, alpha: 0.00429 }
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

const CELL_FORMS = {
    '21700': { dia: 21, length: 70 },
    '18650': { dia: 18, length: 65 }
};

function updateTopologyViz() {
    const sEl = document.getElementById('p-series');
    if (!sEl) return;

    const S = parseInt(sEl.value) || 1;
    const P = parseInt(document.getElementById('p-parallel')?.value) || 1;
    const formKey = document.getElementById('p-cell-form')?.value || '21700';
    const gapX = parseFloat(document.getElementById('p-gap-x')?.value) || 0;
    const gapY = parseFloat(document.getElementById('p-gap-y')?.value) || 0;
    const cellForm = CELL_FORMS[formKey];

    // Update label
    const label = document.getElementById('topology-label');
    if (label) label.textContent = `${S}S${P}P — ${S * P} cells total`;

    // Pack dimensions output
    const pitch_x = cellForm.dia + gapX;  // center-to-center spacing S direction
    const pitch_y = cellForm.dia + gapY;  // center-to-center spacing P direction
    const packW = S * pitch_x - gapX;     // outer edge to outer edge
    const packH = P * pitch_y - gapY;

    const setEl = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
    setEl('p-out-width', packW.toFixed(1));
    setEl('p-out-height', packH.toFixed(1));
    setEl('p-out-celllength', cellForm.length);
    setEl('p-out-totalcells', S * P);

    // --- SVG RENDER ---
    const svg = document.getElementById('topology-svg');
    if (!svg) return;
    svg.innerHTML = '';

    // Scale up cells to fill space better
    const SCALE = 3.2;
    const CELL_R = (cellForm.dia / 2) * SCALE;
    const PX = pitch_x * SCALE;
    const PY = pitch_y * SCALE;

    const MARGIN_LEFT  = 70;   // room for Y arrow
    const MARGIN_TOP   = 22;
    const MARGIN_BOT   = 60;   // room for X arrow + B+/B- labels
    const MARGIN_RIGHT = 16;

    const totalW = MARGIN_LEFT + S * PX - (gapX * SCALE) + MARGIN_RIGHT;
    const totalH = MARGIN_TOP + P * PY - (gapY * SCALE) + MARGIN_BOT;

    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.setAttribute('height', Math.min(totalH, 520)); // cap height, scroll if huge

    const C_RED    = '#ff2244';
    const C_BLUE   = '#00aaff';
    const C_PURPLE = '#9b59ff';
    const C_CELL   = 'rgba(12,14,18,0.95)';
    const C_BORDER = 'rgba(255,51,0,0.6)';
    const C_POS    = '#ee6829';
    const C_NEG    = '#ffffff';
    const C_LABEL  = '#94a3b8';

    const STRIP_W   = CELL_R * 0.40;   // thicker
    const STRIP_EXT = CELL_R * 0.25;
    const BRIDGE_H  = STRIP_W * 0.9;

    const cx = s => MARGIN_LEFT + s * PX + CELL_R;
    const cy = p => MARGIN_TOP  + p * PY + CELL_R;

    const ns = 'http://www.w3.org/2000/svg';
    const mkRect = (x, y, w, h, fill, opacity, rx = 2) => {
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', y);
        r.setAttribute('width', w); r.setAttribute('height', h);
        r.setAttribute('fill', fill); r.setAttribute('opacity', opacity);
        r.setAttribute('rx', rx);
        return r;
    };
    const mkCircle = (x, y, r, fill, opacity = 1, stroke = null, sw = 0) => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', y);
        c.setAttribute('r', r); c.setAttribute('fill', fill);
        c.setAttribute('opacity', opacity);
        if (stroke) { c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', sw); }
        return c;
    };
    const mkText = (x, y, txt, fill, size, weight, anchor = 'middle') => {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y);
        t.setAttribute('text-anchor', anchor);
        t.setAttribute('font-size', size);
        t.setAttribute('font-family', 'JetBrains Mono, monospace');
        t.setAttribute('font-weight', weight);
        t.setAttribute('fill', fill);
        t.setAttribute('dominant-baseline', 'middle');
        t.textContent = txt;
        return t;
    };

    // --- 1. PURPLE VERTICAL STRIPS through every group ---
    for (let s = 0; s < S; s++) {
        const x = cx(s);
        const stripTop = cy(0) - CELL_R - STRIP_EXT;
        const stripH   = (cy(P-1) + CELL_R + STRIP_EXT) - stripTop;
        svg.appendChild(mkRect(x - STRIP_W/2, stripTop, STRIP_W, stripH, C_PURPLE, '0.85'));
    }

    // --- 2. CELLS (drawn before bridges so bridges appear on top) ---
    for (let s = 0; s < S; s++) {
        for (let p = 0; p < P; p++) {
            const x = cx(s), y = cy(p);
            // C1 (s=0) = B-, so s=0 has neg tab up (posOnTop = false for s=0)
            // Clast = B+, so last group has pos tab up
            const posOnTop = (s % 2 !== 0);  // flipped vs before

            svg.appendChild(mkCircle(x, y, CELL_R, C_CELL, 1, C_BORDER, 1.8));

            if (posOnTop) {
                svg.appendChild(mkCircle(x, y, CELL_R * 0.65, 'none', 1, C_POS, 2.0));
                svg.appendChild(mkCircle(x, y, CELL_R * 0.65, C_POS, 0.12));
            } else {
                svg.appendChild(mkCircle(x, y, CELL_R * 0.80, 'none', 1, C_NEG, 1.5));
                svg.appendChild(mkCircle(x, y, CELL_R * 0.80, C_NEG, 0.08));
            }
        }
    }

    // --- 3. HORIZONTAL BRIDGES (drawn on top of cells) ---
    // C1=B-, Clast=B+
    // s=0→1: C1(neg up) connects to C2(pos up) → bridge on BOTTOM (blue, neg side of C1)
    // s=1→2: C2(pos up) to C3(neg up) → bridge on TOP (red, pos side of C2)
    // alternates: s even → blue (bottom), s odd → red (top)
    for (let s = 0; s < S - 1; s++) {
        const x1 = cx(s)   + STRIP_W / 2;
        const x2 = cx(s+1) - STRIP_W / 2;
        const bW  = Math.max(x2 - x1, 1);
        const isTop = (s % 2 !== 0);   // flipped: odd s → top (red), even s → bottom (blue)
        const color = isTop ? C_RED : C_BLUE;
        for (let p = 0; p < P; p++) {
            const yConn = isTop
                ? cy(p) - CELL_R * 0.42 - BRIDGE_H / 2
                : cy(p) + CELL_R * 0.42 - BRIDGE_H / 2;
            svg.appendChild(mkRect(x1, yConn, bW, BRIDGE_H, color, '0.88', 1));
        }
    }

    // --- 4. GROUP LABELS (C1..Cn) ---
    for (let s = 0; s < S; s++) {
        svg.appendChild(mkText(cx(s), MARGIN_TOP - 10, `C${s+1}`, C_LABEL, Math.max(9, CELL_R * 0.42), '700'));
    }

    // --- 5. B- at C1, B+ at Clast ---
    const termY = totalH - MARGIN_BOT + 14;
    svg.appendChild(mkText(cx(0),   termY, 'B−', C_BLUE, Math.max(10, CELL_R * 0.45), '800'));
    svg.appendChild(mkText(cx(S-1), termY, 'B+', C_RED,  Math.max(10, CELL_R * 0.45), '800'));

    // --- 6. DIMENSION ANNOTATIONS ---
    const DIM_COLOR = '#94a3b8';
    const DIM_SIZE  = Math.max(13, CELL_R * 0.52);
    const TICK = 4;

    // Pack bounding box edges in SVG coords
    const packLeft   = cx(0)   - CELL_R;
    const packRight  = cx(S-1) + CELL_R;
    const packTop    = cy(0)   - CELL_R;
    const packBottom = cy(P-1) + CELL_R;

    // Helper: draw dimension line with ticks and label
    const mkDimLine = (x1, y1, x2, y2, label, labelX, labelY, isVertical) => {
        // Main line
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', DIM_COLOR); line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '3,2');
        svg.appendChild(line);

        // Tick at start
        const t1 = document.createElementNS(ns, 'line');
        t1.setAttribute('x1', isVertical ? x1 - TICK : x1);
        t1.setAttribute('y1', isVertical ? y1 : y1 - TICK);
        t1.setAttribute('x2', isVertical ? x1 + TICK : x1);
        t1.setAttribute('y2', isVertical ? y1 : y1 + TICK);
        t1.setAttribute('stroke', DIM_COLOR); t1.setAttribute('stroke-width', '1.2');
        svg.appendChild(t1);

        // Tick at end
        const t2 = document.createElementNS(ns, 'line');
        t2.setAttribute('x1', isVertical ? x2 - TICK : x2);
        t2.setAttribute('y1', isVertical ? y2 : y2 - TICK);
        t2.setAttribute('x2', isVertical ? x2 + TICK : x2);
        t2.setAttribute('y2', isVertical ? y2 : y2 + TICK);
        t2.setAttribute('stroke', DIM_COLOR); t2.setAttribute('stroke-width', '1.2');
        svg.appendChild(t2);

        // Label
        const txt = mkText(labelX, labelY, label, DIM_COLOR, DIM_SIZE, '600');
        if (isVertical) {
            txt.setAttribute('transform', `rotate(-90, ${labelX}, ${labelY})`);
            txt.setAttribute('text-anchor', 'middle');
        }
        svg.appendChild(txt);
    };

    // X dimension (horizontal, below pack) — Length
    const xArrowY = packBottom + 28;
    mkDimLine(packLeft, xArrowY, packRight, xArrowY,
        `X: ${packW.toFixed(1)} mm`, (packLeft + packRight) / 2, xArrowY + 11, false);

    // Y dimension (vertical, left of pack) — Width
    const yArrowX = packLeft - 38;
    mkDimLine(yArrowX, packTop, yArrowX, packBottom,
        `Y: ${packH.toFixed(1)} mm`, yArrowX - 18, (packTop + packBottom) / 2, true);

    // Z label (bottom-left corner, static)
    svg.appendChild(mkText(packLeft, totalH - 8, `Z: ${cellForm.length} mm`, DIM_COLOR, DIM_SIZE, '600', 'start'));

    updateTab3();

    // Rebuild 3D if active
    const wrap3d = document.getElementById('topology-3d-wrap');
    if (wrap3d && wrap3d.style.display !== 'none') rebuild3D();
}

function updateTab3() {
    const vmax = parseFloat(document.getElementById('p-vmax')?.value) || 0;
    const vnom = parseFloat(document.getElementById('p-vnom')?.value) || 0;
    const vmin = parseFloat(document.getElementById('p-vmin')?.value) || 0;
    const cap  = parseFloat(document.getElementById('p-cap')?.value)  || 0;
    const S    = parseInt(document.getElementById('p-series')?.value)   || 0;
    const P    = parseInt(document.getElementById('p-parallel')?.value) || 0;

    const dash = (id) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '—'; el.style.color = 'var(--danger)'; }
    };
    const setVal = (id, val, dec) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = fmt(val, dec); el.style.color = ''; }
    };

    // Validate
    const invalid = vnom <= 0 || cap <= 0 || S <= 0 || P <= 0 || vmax <= 0 || vmin <= 0 || vmax <= vmin;
    if (invalid) {
        ['p-out-vnom','p-out-vmax','p-out-vmin','p-out-cap','p-out-etotal','p-out-eusable'].forEach(dash);
        const wrap = document.getElementById('energy-bar-wrap');
        if (wrap) wrap.style.display = 'none';
        return;
    }

    const pack_vnom = vnom * S;
    const pack_vmax = vmax * S;
    const pack_vmin = vmin * S;
    const pack_cap  = cap * P;
    const E_total   = pack_vnom * pack_cap;
    const E_usable  = (vmax - vmin) * cap * P * S;
    const pct       = E_total > 0 ? (E_usable / E_total) * 100 : 0;

    setVal('p-out-vnom', pack_vnom, 2);
    setVal('p-out-vmax', pack_vmax, 2);
    setVal('p-out-vmin', pack_vmin, 2);
    setVal('p-out-cap',  pack_cap,  2);
    setVal('p-out-etotal',  E_total,  1);
    setVal('p-out-eusable', E_usable, 1);

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

// --- 3D VIEW ---
let _3d = null; // lazy init container

function setTopoView(mode) {
    const btn2d = document.getElementById('btn-2d');
    const btn3d = document.getElementById('btn-3d');
    const wrap2d = document.getElementById('topology-svg-wrap');
    const wrap3d = document.getElementById('topology-3d-wrap');
    const legend = document.getElementById('topo-legend');

    if (mode === '3d') {
        btn2d.classList.remove('active'); btn3d.classList.add('active');
        wrap2d.style.display = 'none'; wrap3d.style.display = 'block';
        legend.style.display = 'none';
        if (!_3d) init3D();
        else rebuild3D();
    } else {
        btn2d.classList.add('active'); btn3d.classList.remove('active');
        wrap2d.style.display = 'flex'; wrap3d.style.display = 'none';
        legend.style.display = 'flex';
        if (_3d) _3d.renderer.setAnimationLoop(null);
    }
}

function init3D() {
    const canvas = document.getElementById('topology-3d-canvas');
    const wrap   = document.getElementById('topology-3d-wrap');
    const W = wrap.clientWidth, H = wrap.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 5000);

    // Orbit controls (manual, no import needed for r128)
    let isDragging = false, isRightDrag = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { theta: Math.PI / 6, phi: Math.PI / 3, r: 300 };
    let target = new THREE.Vector3(0, 0, 0);

    const updateCamera = () => {
        camera.position.set(
            target.x + spherical.r * Math.sin(spherical.phi) * Math.sin(spherical.theta),
            target.y + spherical.r * Math.cos(spherical.phi),
            target.z + spherical.r * Math.sin(spherical.phi) * Math.cos(spherical.theta)
        );
        camera.lookAt(target);
    };
    updateCamera();

    canvas.addEventListener('mousedown', e => {
        isDragging = true; isRightDrag = e.button === 2;
        prevMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        prevMouse = { x: e.clientX, y: e.clientY };
        if (isRightDrag) {
            const right = new THREE.Vector3();
            const up    = new THREE.Vector3();
            camera.getWorldDirection(right); right.cross(camera.up).normalize();
            up.copy(camera.up);
            target.addScaledVector(right, -dx * 0.3);
            target.addScaledVector(up,    dy * 0.3);
        } else {
            spherical.theta -= dx * 0.008;
            spherical.phi    = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.008));
        }
        updateCamera();
    });
    // passive: false so we can preventDefault and stop page scroll
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        spherical.r = Math.max(50, spherical.r + e.deltaY * 0.4);
        updateCamera();
    }, { passive: false });

    // Home button overlay
    const homeBtn = document.createElement('button');
    homeBtn.id = 'topo-3d-home';
    homeBtn.innerHTML = '⌂';
    homeBtn.title = 'Reset view';
    homeBtn.addEventListener('click', () => {
        spherical.theta = Math.PI / 6;
        spherical.phi   = Math.PI / 3;
        const packDiag  = Math.sqrt(Math.pow(
            (parseInt(document.getElementById('p-series')?.value)||1) * ((CELL_FORMS[document.getElementById('p-cell-form')?.value||'21700'].dia) + (parseFloat(document.getElementById('p-gap-x')?.value)||0)), 2) +
            Math.pow((parseInt(document.getElementById('p-parallel')?.value)||1) * ((CELL_FORMS[document.getElementById('p-cell-form')?.value||'21700'].dia) + (parseFloat(document.getElementById('p-gap-y')?.value)||0)), 2));
        spherical.r = packDiag * 1.6 + (CELL_FORMS[document.getElementById('p-cell-form')?.value||'21700'].length);
        target.set(0, 0, 0);
        updateCamera();
    });
    wrap.style.position = 'relative';
    wrap.appendChild(homeBtn);

    // Ambient + directional light
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirL = new THREE.DirectionalLight(0xffffff, 0.9);
    dirL.position.set(1, 2, 1.5);
    scene.add(dirL);

    _3d = { renderer, scene, camera, updateCamera, spherical, target };
    rebuild3D();

    renderer.setAnimationLoop(() => renderer.render(scene, camera));

    // Resize
    window.addEventListener('resize', () => {
        const W2 = wrap.clientWidth, H2 = wrap.clientHeight;
        renderer.setSize(W2, H2);
        camera.aspect = W2 / H2;
        camera.updateProjectionMatrix();
    });
}

function rebuild3D() {
    if (!_3d) return;
    const { scene, camera, updateCamera, spherical, target } = _3d;

    // Clear old meshes
    while (scene.children.length > 0) scene.remove(scene.children[0]);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirL = new THREE.DirectionalLight(0xffffff, 0.9);
    dirL.position.set(1, 2, 1.5); scene.add(dirL);

    // Get params
    const S        = parseInt(document.getElementById('p-series')?.value)   || 1;
    const P        = parseInt(document.getElementById('p-parallel')?.value) || 1;
    const formKey  = document.getElementById('p-cell-form')?.value || '21700';
    const gapX     = parseFloat(document.getElementById('p-gap-x')?.value) || 0;
    const gapY     = parseFloat(document.getElementById('p-gap-y')?.value) || 0;
    const cellForm = CELL_FORMS[formKey];

    const cellR   = cellForm.dia / 2;
    const cellH   = cellForm.length;
    const pitchX  = cellForm.dia + gapX;
    const pitchY  = cellForm.dia + gapY;

    const STRIP_T       = 0.4;   // nickel strip thickness mm
    const STRIP_W_FRAC  = 0.38;  // strip width as fraction of cell diameter
    const BRIDGE_T      = 0.4;
    const PURPLE_OFFSET = 0;           // flush with top face
    const RED_OFFSET    = STRIP_T + 0.3;   // sits above purple
    const BLUE_OFFSET   = STRIP_T + 0.3;   // sits below bottom face (proud)

    // Materials
    const matCell   = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.6, metalness: 0.4 });
    const matBorder = new THREE.MeshStandardMaterial({ color: 0xee6829, roughness: 0.5, metalness: 0.3, emissive: 0xee6829, emissiveIntensity: 0.12 });
    const matPos    = new THREE.MeshStandardMaterial({ color: 0xee6829, roughness: 0.4, metalness: 0.5, emissive: 0xee6829, emissiveIntensity: 0.3 });
    const matNeg    = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.6 });
    const matPurple = new THREE.MeshStandardMaterial({ color: 0x9b59ff, roughness: 0.3, metalness: 0.7, emissive: 0x9b59ff, emissiveIntensity: 0.15 });
    const matRed    = new THREE.MeshStandardMaterial({ color: 0xff2244, roughness: 0.3, metalness: 0.7, emissive: 0xff2244, emissiveIntensity: 0.2 });
    const matBlue   = new THREE.MeshStandardMaterial({ color: 0x00aaff, roughness: 0.3, metalness: 0.7, emissive: 0x00aaff, emissiveIntensity: 0.2 });

    const geoCell     = new THREE.CylinderGeometry(cellR, cellR, cellH - 2, 32);
    const geoCap      = new THREE.CylinderGeometry(cellR * 0.98, cellR * 0.98, 1, 32);
    const geoPosCap   = new THREE.CylinderGeometry(cellR * 0.65, cellR * 0.65, 1.2, 32);
    const geoNegCap   = new THREE.CylinderGeometry(cellR * 0.80, cellR * 0.80, 1.2, 32);

    const STRIP_W = cellForm.dia * STRIP_W_FRAC;

    // Pack center offset so pack is centered at origin
    const packCX = (S - 1) * pitchX / 2;
    const packCY = (P - 1) * pitchY / 2;

    for (let s = 0; s < S; s++) {
        for (let p = 0; p < P; p++) {
            const x = s * pitchX - packCX;
            const z = p * pitchY - packCY;
            const posOnTop = (s % 2 !== 0); // matches 2D logic

            // Cell body
            const cell = new THREE.Mesh(geoCell, matCell);
            cell.position.set(x, 0, z);
            scene.add(cell);

            // Border ring (thin outer cylinder slightly larger)
            const border = new THREE.Mesh(
                new THREE.CylinderGeometry(cellR + 0.3, cellR + 0.3, cellH - 2, 32, 1, true),
                matBorder
            );
            border.position.set(x, 0, z);
            scene.add(border);

            // Bottom cap (flat)
            const botCap = new THREE.Mesh(geoCap, matCell);
            botCap.position.set(x, -(cellH / 2 - 0.5), z);
            scene.add(botCap);

            // Top/bottom tab caps
            if (posOnTop) {
                // Positive nub on top
                const posCap = new THREE.Mesh(geoPosCap, matPos);
                posCap.position.set(x, cellH / 2 + 0.2, z);
                scene.add(posCap);
                // Negative flat on bottom
                const negCap = new THREE.Mesh(geoNegCap, matNeg);
                negCap.position.set(x, -(cellH / 2 + 0.2), z);
                scene.add(negCap);
            } else {
                // Negative flat on top
                const negCap = new THREE.Mesh(geoNegCap, matNeg);
                negCap.position.set(x, cellH / 2 + 0.2, z);
                scene.add(negCap);
                // Positive nub on bottom
                const posCap = new THREE.Mesh(geoPosCap, matPos);
                posCap.position.set(x, -(cellH / 2 + 0.2), z);
                scene.add(posCap);
            }
        }
    }

    // --- STRIPS ---
    // Purple: vertical bar (along Z = parallel direction) through all P cells per column
    // Placed on TOP face, centered on column X
    const purpleH = (P - 1) * pitchY + cellForm.dia; // full span
    const geoPurple = new THREE.BoxGeometry(STRIP_W, STRIP_T, purpleH);

    for (let s = 0; s < S; s++) {
        const x = s * pitchX - packCX;
        const stripY = cellH / 2 + PURPLE_OFFSET + STRIP_T / 2;
        const mesh = new THREE.Mesh(geoPurple, matPurple);
        mesh.position.set(x, stripY, 0);
        scene.add(mesh);

        // Also on bottom face (purple = both sides)
        const meshBot = new THREE.Mesh(geoPurple, matPurple);
        meshBot.position.set(x, -(cellH / 2 + PURPLE_OFFSET + STRIP_T / 2), 0);
        scene.add(meshBot);
    }

    // Red/Blue bridges between adjacent columns
    // Red = top face, Blue = bottom face
    // s even→odd: red on top; s odd→even: blue on bottom (matches 2D)
    for (let s = 0; s < S - 1; s++) {
        const x1 = s * pitchX - packCX;
        const x2 = (s + 1) * pitchX - packCX;
        const bridgeLen = x2 - x1 - STRIP_W + 0.5; // gap between purple strips
        const bridgeX   = (x1 + x2) / 2;
        const isTop = (s % 2 !== 0); // matches 2D flip

        for (let p = 0; p < P; p++) {
            const z = p * pitchY - packCY;
            const geoBridge = new THREE.BoxGeometry(bridgeLen, BRIDGE_T, STRIP_W);

            if (isTop) {
                // Red on top, above purple
                const m = new THREE.Mesh(geoBridge, matRed);
                m.position.set(bridgeX, cellH / 2 + PURPLE_OFFSET + STRIP_T + RED_OFFSET + BRIDGE_T / 2, z);
                scene.add(m);
            } else {
                // Blue on bottom, below purple
                const m = new THREE.Mesh(geoBridge, matBlue);
                m.position.set(bridgeX, -(cellH / 2 + PURPLE_OFFSET + STRIP_T + BLUE_OFFSET + BRIDGE_T / 2), z);
                scene.add(m);
            }
        }
    }

    // --- TERMINAL WIRES ---
    const WIRE_R   = cellForm.dia * 0.06;
    const WIRE_LEN = cellH * 0.55;
    const geoWire  = new THREE.CylinderGeometry(WIRE_R, WIRE_R, WIRE_LEN, 12);
    const matWireRed   = new THREE.MeshStandardMaterial({ color: 0xff2244, roughness: 0.4, metalness: 0.6, emissive: 0xff2244, emissiveIntensity: 0.3 });
    const matWireBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.5 });

    // B- (C1, s=0) — black wire, exits top face (neg tab faces up for s=0)
    const wireNeg = new THREE.Mesh(geoWire, matWireBlack);
    wireNeg.position.set(
        0 * pitchX - packCX,
        cellH / 2 + STRIP_T * 2 + WIRE_LEN / 2 + 2,
        0 * pitchY - packCY   // first cell row
    );
    scene.add(wireNeg);

    // B+ (Clast, s=S-1) — red wire, exits top face (pos tab faces up for last odd group)
    const wirePosX = (S - 1) * pitchX - packCX;
    const wirePos = new THREE.Mesh(geoWire, matWireRed);
    wirePos.position.set(
        wirePosX,
        cellH / 2 + STRIP_T * 2 + WIRE_LEN / 2 + 2,
        0 * pitchY - packCY
    );
    scene.add(wirePos);

    // Refit camera to pack size
    const packDiag = Math.sqrt(Math.pow(S * pitchX, 2) + Math.pow(P * pitchY, 2));
    spherical.r = packDiag * 1.6 + cellH;
    target.set(0, 0, 0);
    updateCamera();
}

window.onload = () => {
    updateTab1();
    updateTab2();
    updateTopologyViz();
};