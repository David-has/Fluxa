'use strict';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmtLei = n => Math.round(n).toLocaleString('ro-RO') + ' lei';
const fmtMoney = n => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const tween = (el, to, fmt, ms = 700) => {
    const from = el._v === undefined ? 0 : el._v;
    el._v = to;
    cancelAnimationFrame(el._raf);
    if (reduce) {
        el.textContent = fmt(to);
        return;
    }
    const t0 = performance.now();
    const tick = now => {
        const p = Math.min((now - t0) / ms, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
};

const smooth = pts => {
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
};

const header = $('#header');
const progress = $('#progress');
const onScroll = () => {
    header.classList.toggle('solid', scrollY > 40);
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

let colors = { a: '#ff5d8f', b: '#ffc65c' };
const readColors = () => {
    const s = getComputedStyle(root);
    colors = { a: s.getPropertyValue('--accent').trim(), b: s.getPropertyValue('--accent2').trim() };
};

const themeBtn = $('#themeBtn');
const curtain = $('#curtain');
const themeBg = { dark: '#0e0a1a', light: '#fff4ec' };
let switching = false;

const applyTheme = theme => {
    root.dataset.theme = theme;
    themeBtn.setAttribute('aria-checked', theme === 'light');
    readColors();
    try {
        localStorage.setItem('fluxa-theme', theme);
    } catch (e) {}
};

const STRIPS = 8;
for (let i = 0; i < STRIPS; i++) curtain.appendChild(document.createElement('i'));

const switchTheme = async () => {
    if (switching) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    if (reduce) {
        applyTheme(next);
        return;
    }
    switching = true;
    const strips = $$('i', curtain);
    strips.forEach(s => {
        s.style.background = themeBg[next];
        s.style.transformOrigin = '0 50%';
    });
    const enter = strips.map((s, i) => s.animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 420, delay: i * 55, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }
    ));
    await Promise.all(enter.map(a => a.finished));
    applyTheme(next);
    strips.forEach(s => { s.style.transformOrigin = '100% 50%'; });
    const leave = strips.map((s, i) => s.animate(
        [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
        { duration: 420, delay: i * 55, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }
    ));
    await Promise.all(leave.map(a => a.finished));
    enter.concat(leave).forEach(a => a.cancel());
    switching = false;
};
themeBtn.addEventListener('click', switchTheme);

let startTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
try {
    startTheme = localStorage.getItem('fluxa-theme') || startTheme;
} catch (e) {}
applyTheme(startTheme);

const hero = $('#top');
const tilt = $('#tilt');
const flow = $('#flow');
const fg = flow.getContext('2d');
let fw = 0;
let fh = 0;
let ft = 0;
let parts = [];
let flowOn = true;
const mouse = { x: -9999, y: -9999 };

const spawn = p => {
    p.x = Math.random() * fw;
    p.y = Math.random() * fh;
    p.px = p.x;
    p.py = p.y;
    p.life = 80 + Math.random() * 180;
    return p;
};

const sizeFlow = () => {
    const rect = flow.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    fw = rect.width;
    fh = rect.height;
    flow.width = fw * dpr;
    flow.height = fh * dpr;
    fg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(900, Math.floor((fw * fh) / 2400));
    parts = Array.from({ length: count }, (_, i) => {
        const p = spawn({});
        p.c = i % 3 === 0 ? 1 : 0;
        return p;
    });
};

const field = (x, y, t) => (
    Math.sin(x * 0.0029 + t * 0.25) +
    Math.cos(y * 0.0034 - t * 0.2) +
    Math.sin((x + y) * 0.0017 + t * 0.12)
) * 1.25;

const stepFlow = () => {
    ft += 0.012;
    fg.globalCompositeOperation = 'destination-out';
    fg.fillStyle = 'rgba(0,0,0,0.06)';
    fg.fillRect(0, 0, fw, fh);
    fg.globalCompositeOperation = 'source-over';
    parts.forEach(p => {
        p.px = p.x;
        p.py = p.y;
        const a = field(p.x, p.y, ft);
        let vx = Math.cos(a) * 1.4;
        let vy = Math.sin(a) * 1.4;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = dx * dx + dy * dy;
        if (d < 22500) {
            const m = Math.sqrt(d) || 1;
            const f = (1 - d / 22500) * 3;
            vx += (dx / m) * f;
            vy += (dy / m) * f;
        }
        p.x += vx;
        p.y += vy;
        p.life--;
        if (p.life <= 0 || p.x < 0 || p.x > fw || p.y < 0 || p.y > fh) spawn(p);
    });
    fg.lineWidth = 1.2;
    fg.globalAlpha = 0.55;
    [0, 1].forEach(ci => {
        fg.beginPath();
        parts.forEach(p => {
            if (p.c === ci) {
                fg.moveTo(p.px, p.py);
                fg.lineTo(p.x, p.y);
            }
        });
        fg.strokeStyle = ci ? colors.b : colors.a;
        fg.stroke();
    });
    fg.globalAlpha = 1;
};

sizeFlow();
let resizeTimer = null;
addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeFlow, 200);
});

if (reduce) {
    for (let i = 0; i < 160; i++) stepFlow();
} else {
    const loopFlow = () => {
        if (flowOn) stepFlow();
        requestAnimationFrame(loopFlow);
    };
    requestAnimationFrame(loopFlow);
    new IntersectionObserver(entries => {
        flowOn = entries[0].isIntersecting;
    }).observe(hero);
}

hero.addEventListener('pointermove', e => {
    const rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    hero.style.setProperty('--mx', mouse.x + 'px');
    hero.style.setProperty('--my', mouse.y + 'px');
    if (reduce) return;
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    tilt.style.setProperty('--ry', (nx * 9).toFixed(2) + 'deg');
    tilt.style.setProperty('--rx', (-ny * 7).toFixed(2) + 'deg');
});
hero.addEventListener('pointerleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
    tilt.style.setProperty('--ry', '0deg');
    tilt.style.setProperty('--rx', '0deg');
});

$$('.tile, .plan').forEach(el => {
    el.addEventListener('pointermove', e => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--x', e.clientX - rect.left + 'px');
        el.style.setProperty('--y', e.clientY - rect.top + 'px');
    });
});

const mag = $('.mag');
if (mag && !reduce) {
    mag.addEventListener('pointermove', e => {
        const rect = mag.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.35;
        mag.style.transform = `translate(${x}px, ${y}px)`;
    });
    mag.addEventListener('pointerleave', () => { mag.style.transform = ''; });
}

const feedPool = [
    ['Cafenea Origo', 'Mâncare', -18.5],
    ['Magazin Mega', 'Mâncare', -142.3],
    ['Abonament muzică', 'Abonamente', -24],
    ['Transfer de la Ana', 'Transfer', 250],
    ['Metrou', 'Transport', -5],
    ['Dobândă cont economii', 'Economii', 31.2],
    ['Benzinărie', 'Transport', -210],
    ['Salariu', 'Venit', 6400]
];
const catColor = {
    Mâncare: 'var(--accent)',
    Abonamente: 'var(--accent2)',
    Transfer: 'var(--good)',
    Transport: 'var(--accent2)',
    Economii: 'var(--good)',
    Venit: 'var(--good)'
};

const feed = $('#feed');
const balEl = $('#bal');
let balance = 24318.4;
let feedIndex = 0;
let spark = Array.from({ length: 24 }, (_, i) => balance - (24 - i) * 38 + Math.sin(i * 0.9) * 120);
balEl._v = balance;

const renderSpark = () => {
    const min = Math.min(...spark);
    const max = Math.max(...spark);
    const span = max - min || 1;
    const pts = spark.map((v, i) => [(i / (spark.length - 1)) * 300, 70 - ((v - min) / span) * 60]);
    const line = smooth(pts);
    $('#sparkLine').setAttribute('d', line);
    $('#sparkArea').setAttribute('d', `${line}L300 80L0 80Z`);
};

const addFeedItem = (item, animate) => {
    const [name, cat, amount] = item;
    const li = document.createElement('li');
    if (!animate) li.style.animation = 'none';
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.textContent = name[0];
    ic.style.setProperty('--k', catColor[cat]);
    const info = document.createElement('div');
    const title = document.createElement('b');
    const small = document.createElement('small');
    title.textContent = name;
    small.textContent = cat;
    info.append(title, small);
    const value = document.createElement('em');
    value.className = amount > 0 ? 'up' : 'down';
    value.textContent = (amount > 0 ? '+' : '−') + fmtMoney(Math.abs(amount)) + ' lei';
    li.append(ic, info, value);
    feed.prepend(li);
    while (feed.children.length > 3) feed.lastElementChild.remove();
};

const tick = () => {
    const item = feedPool[feedIndex % feedPool.length];
    feedIndex++;
    balance += item[2];
    spark.push(balance);
    spark.shift();
    addFeedItem(item, true);
    tween(balEl, balance, fmtMoney, 900);
    renderSpark();
};

feedPool.slice(0, 3).reverse().forEach(item => addFeedItem(item, false));
feedIndex = 3;
renderSpark();
if (!reduce) setInterval(tick, 3400);

const rates = [
    ['EUR/RON', '4,97', 0.2],
    ['USD/RON', '4,58', -0.1],
    ['GBP/RON', '5,79', 0.3],
    ['CHF/RON', '5,21', 0.1],
    ['Aur, 1 g', '412 lei', 0.6],
    ['ROBOR 3M', '5,8%', -0.1]
];
const trackEl = $('#tickerTrack');
const tickerHTML = rates.map(([name, value, change]) => {
    const up = change >= 0;
    const pct = Math.abs(change).toLocaleString('ro-RO', { minimumFractionDigits: 1 });
    return `<span><b>${name}</b>${value}<em class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${pct}%</em></span>`;
}).join('');
trackEl.innerHTML = tickerHTML + tickerHTML;

const runCounters = () => {
    $$('[data-count]').forEach(el => {
        const dec = +el.dataset.dec || 0;
        tween(el, +el.dataset.count, v =>
            (el.dataset.pre || '') +
            v.toLocaleString('ro-RO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
            (el.dataset.suf || ''), 1800);
    });
};

const subs = $$('.sw');
const subTotal = $('#subTotal');
const renderSubs = () => {
    const total = subs.reduce((sum, b) => sum + (b.getAttribute('aria-checked') === 'true' ? +b.dataset.p : 0), 0);
    tween(subTotal, total, fmtLei, 500);
};
subs.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.setAttribute('aria-checked', btn.getAttribute('aria-checked') !== 'true');
        renderSubs();
    });
});
subTotal._v = 212;

const names = {
    week: ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'],
    year: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
};
const series = {
    week: {
        labels: ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'],
        full: names.week,
        values: [142, 96, 210, 174, 260, 318, 121],
        avg: 'Medie pe zi'
    },
    month: {
        labels: Array.from({ length: 30 }, (_, i) => String(i + 1)),
        full: Array.from({ length: 30 }, (_, i) => 'Ziua ' + (i + 1)),
        values: Array.from({ length: 30 }, (_, i) =>
            Math.round(120 + 80 * Math.sin(i * 0.7) + 60 * Math.sin(i * 1.9 + 1) + (i % 7 > 4 ? 90 : 0))),
        avg: 'Medie pe zi'
    },
    year: {
        labels: ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'],
        full: names.year,
        values: [3100, 2850, 3320, 3480, 3010, 3650, 4100, 3890, 3300, 3560, 3920, 4620],
        avg: 'Medie pe lună'
    }
};

const CH = { w: 640, h: 340, l: 52, r: 18, t: 20, b: 34 };
const svgChart = $('#chartSvg');
const wrap = $('#chartWrap');
const tip = $('#tip');
let range = 'week';
let current = null;

const fmtK = v => (v >= 1000 ? (v / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 }) + 'k' : String(Math.round(v)));

const drawChart = animate => {
    const s = series[range];
    const n = s.values.length;
    const max = Math.max(...s.values) * 1.18;
    const x = i => CH.l + (i / (n - 1)) * (CH.w - CH.l - CH.r);
    const y = v => CH.h - CH.b - (v / max) * (CH.h - CH.b - CH.t);
    const pts = s.values.map((v, i) => [x(i), y(v)]);
    const line = smooth(pts);
    const base = CH.h - CH.b;
    let html = `<defs>
        <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/>
            <stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient>
        <linearGradient id="gLine" gradientUnits="userSpaceOnUse" x1="${CH.l}" y1="0" x2="${CH.w - CH.r}" y2="0">
            <stop offset="0" style="stop-color:var(--accent)"/>
            <stop offset="1" style="stop-color:var(--accent2)"/>
        </linearGradient>
    </defs>`;
    for (let k = 0; k <= 4; k++) {
        const v = (max / 4) * k;
        html += `<line class="c-grid" x1="${CH.l}" x2="${CH.w - CH.r}" y1="${y(v)}" y2="${y(v)}"/>`;
        html += `<text class="c-axis" x="${CH.l - 10}" y="${y(v) + 4}" text-anchor="end">${fmtK(v)}</text>`;
    }
    s.labels.forEach((label, i) => {
        if (n > 12 && i % 5 !== 0) return;
        html += `<text class="c-axis" x="${x(i)}" y="${CH.h - 10}" text-anchor="middle">${label}</text>`;
    });
    html += `<path class="c-area" id="cArea" d="${line}L${x(n - 1)} ${base}L${x(0)} ${base}Z" fill="url(#gArea)" style="opacity:${animate ? 0 : 1}"/>`;
    html += `<path class="c-line" id="cLine" d="${line}" stroke="url(#gLine)"/>`;
    html += `<line class="c-cursor" id="cCursor" y1="${CH.t}" y2="${base}"/><circle class="c-dot" id="cDot" r="6"/>`;
    svgChart.innerHTML = html;
    current = { s, n, x, y };

    const path = $('#cLine');
    if (animate && !reduce) {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)';
        path.style.strokeDashoffset = 0;
        $('#cArea').style.opacity = 1;
    } else {
        $('#cArea').style.opacity = 1;
    }

    const total = s.values.reduce((a, b) => a + b, 0);
    const peak = Math.max(...s.values);
    $('#kAvgLabel').textContent = s.avg;
    tween($('#kSpent'), total, fmtLei);
    tween($('#kAvg'), total / n, fmtLei);
    tween($('#kPeak'), peak, fmtLei);
};

const moveChart = e => {
    if (!current) return;
    const rect = svgChart.getBoundingClientRect();
    const scale = CH.w / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const { s, n, x, y } = current;
    const idx = Math.max(0, Math.min(n - 1, Math.round(((mx - CH.l) / (CH.w - CH.l - CH.r)) * (n - 1))));
    const px = x(idx);
    const py = y(s.values[idx]);
    const cursor = $('#cCursor');
    const dot = $('#cDot');
    cursor.setAttribute('x1', px);
    cursor.setAttribute('x2', px);
    cursor.style.opacity = 1;
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', py);
    dot.style.opacity = 1;
    const wrapRect = wrap.getBoundingClientRect();
    tip.hidden = false;
    tip.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = fmtLei(s.values[idx]);
    tip.append(b, document.createTextNode(s.full[idx]));
    const left = rect.left - wrapRect.left + px / scale;
    tip.style.left = Math.max(60, Math.min(wrapRect.width - 60, left)) + 'px';
    tip.style.top = rect.top - wrapRect.top + py / scale + 'px';
};

svgChart.addEventListener('pointermove', moveChart);
svgChart.addEventListener('pointerdown', moveChart);
svgChart.addEventListener('pointerleave', () => {
    tip.hidden = true;
    const cursor = $('#cCursor');
    const dot = $('#cDot');
    if (cursor) cursor.style.opacity = 0;
    if (dot) dot.style.opacity = 0;
});

$$('.range button').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.range button').forEach(b => b.setAttribute('aria-pressed', b === btn));
        range = btn.dataset.range;
        tip.hidden = true;
        drawChart(true);
    });
});

const inp = {
    monthly: $('#rMonthly'),
    initial: $('#rInitial'),
    years: $('#rYears'),
    rate: $('#rRate')
};
const outs = {
    monthly: $('#oMonthly'),
    initial: $('#oInitial'),
    years: $('#oYears'),
    rate: $('#oRate')
};
const growth = $('#growth');
let calcSeen = false;

const balanceAt = (P, pmt, rate, months) => {
    const r = rate / 100 / 12;
    if (!r) return P + pmt * months;
    const g = Math.pow(1 + r, months);
    return P * g + (pmt * (g - 1)) / r;
};

const renderCalc = () => {
    const P = +inp.initial.value;
    const pmt = +inp.monthly.value;
    const yrs = +inp.years.value;
    const rate = +inp.rate.value;
    Object.values(inp).forEach(i => i.style.setProperty('--p', ((i.value - i.min) / (i.max - i.min)) * 100 + '%'));
    outs.monthly.textContent = fmtLei(pmt);
    outs.initial.textContent = fmtLei(P);
    outs.years.textContent = yrs + (yrs === 1 ? ' an' : yrs >= 20 ? ' de ani' : ' ani');
    outs.rate.textContent = rate.toLocaleString('ro-RO', { minimumFractionDigits: 1 }) + '%';

    const total = balanceAt(P, pmt, rate, yrs * 12);
    const contrib = P + pmt * yrs * 12;
    tween($('#total'), total, fmtLei);
    tween($('#vPrin'), contrib, fmtLei);
    tween($('#vInt'), total - contrib, fmtLei);

    const W = 560;
    const H = 220;
    const pad = 8;
    const base = H - 26;
    const bw = (W - pad * 2) / yrs;
    const usable = base - 10;
    let html = '';
    for (let y = 1; y <= yrs; y++) {
        const bal = balanceAt(P, pmt, rate, y * 12);
        const c = P + pmt * 12 * y;
        const hc = (c / total) * usable;
        const hi = Math.max(((bal - c) / total) * usable, 0);
        const x = pad + (y - 1) * bw + bw * 0.15;
        const w = bw * 0.7;
        html += `<g><title>An ${y}: ${fmtLei(bal)}</title>`;
        html += `<rect class="b1" x="${x.toFixed(1)}" y="${(base - hc).toFixed(1)}" width="${w.toFixed(1)}" height="${hc.toFixed(1)}" rx="2"/>`;
        html += `<rect class="b2" x="${x.toFixed(1)}" y="${(base - hc - hi).toFixed(1)}" width="${w.toFixed(1)}" height="${hi.toFixed(1)}" rx="2"/></g>`;
        if (yrs <= 12 || y % 5 === 0 || y === 1) {
            html += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}">${y}</text>`;
        }
    }
    growth.innerHTML = html;
    if (!calcSeen && !reduce) {
        growth.classList.add('anim');
        setTimeout(() => growth.classList.remove('anim'), 1200);
    }
    calcSeen = true;

    const goal = Math.max(+$('#goal').value || 0, 1);
    const r = rate / 100 / 12;
    let bal = P;
    let m = 0;
    if (P < goal) {
        while (bal < goal && m < 600) {
            bal = bal * (1 + r) + pmt;
            m++;
        }
    }
    const text = $('#goalText');
    if (P >= goal) {
        text.textContent = 'Obiectivul este deja atins cu suma de început.';
    } else if (bal < goal) {
        text.textContent = 'Cu setările actuale nu ajungi la obiectiv în 50 de ani. Crește suma lunară.';
    } else {
        const years = Math.floor(m / 12);
        const months = m % 12;
        const parts2 = [];
        if (years) parts2.push(years + (years === 1 ? ' an' : years >= 20 ? ' de ani' : ' ani'));
        if (months) parts2.push(months + (months === 1 ? ' lună' : ' luni'));
        text.textContent = 'Ajungi la obiectiv în ' + parts2.join(' și ') + '.';
    }
    $('#goalBar').style.width = Math.min(100, (total / goal) * 100) + '%';
};

Object.values(inp).forEach(i => i.addEventListener('input', renderCalc));
$('#goal').addEventListener('input', renderCalc);

const billing = $('#billing');
const priceEls = $$('.price b');
priceEls.forEach(el => { el._v = +el.dataset.m; });
billing.addEventListener('click', () => {
    const yearly = billing.getAttribute('aria-checked') !== 'true';
    billing.setAttribute('aria-checked', yearly);
    priceEls.forEach(el => tween(el, +(yearly ? el.dataset.y : el.dataset.m), v => String(Math.round(v)), 500));
});

$$('.qa button').forEach(btn => {
    btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        $$('.qa button').forEach(b => b.setAttribute('aria-expanded', 'false'));
        btn.setAttribute('aria-expanded', !open);
    });
});

const hooks = {
    grafic: () => drawChart(true),
    calculator: renderCalc
};

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('in');
        if (el.classList.contains('stats')) runCounters();
        if (hooks[el.id]) hooks[el.id]();
        observer.unobserve(el);
    });
}, { threshold: 0.15 });
$$('.reveal, .stats').forEach(el => observer.observe(el));