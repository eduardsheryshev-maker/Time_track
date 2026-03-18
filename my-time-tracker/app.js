// ══════════════════════════════════════════════════
//  TrackIt — Notion-style Time Tracker
// ══════════════════════════════════════════════════

const COLORS = [
  '#2383e2','#0f7b56','#eb5757','#f59e0b',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16',
  '#f97316','#6366f1','#14b8a6','#e11d48'
];

// ═══════ STORE (localStorage) ═══════

const Store = {
  _get(k, fb) {
    try { return JSON.parse(localStorage.getItem(`ti_${k}`)) || fb; }
    catch { return fb; }
  },
  _set(k, v) { localStorage.setItem(`ti_${k}`, JSON.stringify(v)); },

  entries()       { return this._get('entries', []); },
  saveEntries(e)  { this._set('entries', e); },
  addEntry(e)     { const all = this.entries(); all.unshift(e); this.saveEntries(all); },
  deleteEntry(id) { this.saveEntries(this.entries().filter(e => e.id !== id)); },

  projects()        { return this._get('projects', [
    { id:'p1', name:'Работа',  color:COLORS[0] },
    { id:'p2', name:'Учёба',   color:COLORS[1] },
    { id:'p3', name:'Личное',  color:COLORS[2] },
  ]); },
  saveProjects(p)   { this._set('projects', p); },
  addProject(name)  {
    const p = this.projects();
    const proj = { id:'p'+Date.now(), name, color: COLORS[p.length % COLORS.length] };
    p.push(proj);
    this.saveProjects(p);
    return proj;
  },
  deleteProject(id) { this.saveProjects(this.projects().filter(p => p.id !== id)); },

  theme()          { return this._get('theme', null); },
  saveTheme(t)     { this._set('theme', t); },
};

// ═══════ HELPERS ═══════

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

function fmtDuration(sec) {
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
function fmtHM(sec) {
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  return h ? `${h}ч ${m}м` : `${m}м`;
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'long'});
}
function fmtISO(d) { return new Date(d).toISOString().split('T')[0]; }
function isToday(d) { return fmtISO(d) === fmtISO(new Date()); }
function projectById(id) { return Store.projects().find(p=>p.id===id); }

// ═══════ TIMER ENGINE ═══════

class Timer {
  constructor(onTick) {
    this.sec = 0;
    this.running = false;
    this.paused = false;
    this._iv = null;
    this.startTime = null;
    this.onTick = onTick;
  }
  start() {
    if (this.running && !this.paused) return;
    if (!this.startTime) this.startTime = new Date();
    this.running = true;
    this.paused = false;
    this._iv = setInterval(() => { this.sec++; this.onTick(this.sec); }, 1000);
  }
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    clearInterval(this._iv);
  }
  resume() { if (this.paused) this.start(); }
  stop() {
    clearInterval(this._iv);
    const r = { seconds:this.sec, startTime:this.startTime, endTime:new Date() };
    this.sec=0; this.running=false; this.paused=false; this.startTime=null;
    this.onTick(0);
    return r;
  }
}

// ═══════ APP ═══════

class App {
  constructor() {
    this.timer = new Timer(s => this.onTick(s));
    this.tab = 'timer';
    this.statsPeriod = 'week';

    this.initTheme();
    this.bind();
    this.renderProjects();
    this.renderToday();
    this.setDefaultDates();
  }

  // ── Theme ──

  initTheme() {
    const saved = Store.theme();
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeSwatches();

    $$('#themeSwitcher .theme-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.themeValue;
        document.documentElement.setAttribute('data-theme', t);
        Store.saveTheme(t);
        this.updateThemeSwatches();
      });
    });
  }

  updateThemeSwatches() {
    const current = document.documentElement.getAttribute('data-theme') || Store.theme() || 'light';
    $$('#themeSwitcher .theme-swatch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeValue === current);
    });
  }

  // ── Bindings ──

  bind() {
    // Nav
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.tab)));

    // Timer
    $('#btnStart').addEventListener('click', () => this.startTimer());
    $('#btnPause').addEventListener('click', () => this.pauseTimer());
    $('#btnStop').addEventListener('click', () => this.stopTimer());

    // Manual
    $('#btnManualToggle').addEventListener('click', () => {
      $('#manualEntry').classList.toggle('hidden');
    });
    $('#btnManualSave').addEventListener('click', () => this.saveManual());

    // Projects
    $('#btnAddProject').addEventListener('click', () => this.addProject());

    // History
    $('#btnFilter').addEventListener('click', () => this.renderHistory());
    $('#btnExport').addEventListener('click', () => this.exportCSV());

    // Stats period
    $$('#statsPeriodBtns button').forEach(b => {
      b.addEventListener('click', () => {
        $$('#statsPeriodBtns button').forEach(x => {
          x.classList.remove('active');
          x.style.background = '';
          x.style.color = '';
        });
        b.classList.add('active');
        b.style.background = 'var(--accent)';
        b.style.color = 'var(--accent-fg)';
        this.statsPeriod = b.dataset.period;
        this.renderStats();
      });
    });
    // Init first button style
    const firstStatsBtn = $('#statsPeriodBtns button.active');
    if (firstStatsBtn) {
      firstStatsBtn.style.background = 'var(--accent)';
      firstStatsBtn.style.color = 'var(--accent-fg)';
    }

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); this.timer.running && !this.timer.paused ? this.pauseTimer() : this.startTimer(); }
      if (e.code === 'Escape' && this.timer.running) this.stopTimer();
    });
  }

  // ── Tabs ──

  switchTab(tab) {
    this.tab = tab;
    $$('.nav-btn').forEach(b => {
      const isActive = b.dataset.tab === tab;
      b.classList.toggle('active', isActive);
      b.style.background = isActive ? 'var(--accent-soft)' : '';
      b.style.color = isActive ? 'var(--accent)' : '';
    });
    $$('.tab-content').forEach(t => t.classList.add('hidden'));

    if (tab === 'timer')   { $('#tabTimer').classList.remove('hidden'); this.renderToday(); }
    if (tab === 'history') { $('#tabHistory').classList.remove('hidden'); this.renderHistory(); }
    if (tab === 'stats')   { $('#tabStats').classList.remove('hidden'); this.renderStats(); }
  }

  // ── Timer ──

  onTick(sec) {
    $('#timerDisplay').textContent = fmtDuration(sec);
    document.title = this.timer.running ? `${fmtDuration(sec)} — TrackIt` : 'TrackIt';
  }

  startTimer() {
    if (this.timer.paused) this.timer.resume(); else this.timer.start();
    $('#btnStart').classList.add('hidden');
    $('#btnPause').classList.remove('hidden');
    $('#btnStop').classList.remove('hidden');
    $('#timerStatus').innerHTML = `<span class="dot pulse-running" style="background:var(--success);"></span><span class="text-xs" style="color:var(--success);">Запись...</span>`;
  }

  pauseTimer() {
    this.timer.pause();
    $('#btnPause').classList.add('hidden');
    $('#btnStart').classList.remove('hidden');
    const startBtn = $('#btnStart');
    startBtn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Продолжить`;
    $('#timerStatus').innerHTML = `<span class="dot" style="background:var(--text3);"></span><span class="text-xs" style="color:var(--text3);">Пауза</span>`;
  }

  stopTimer() {
    const r = this.timer.stop();
    if (r.seconds < 1) return;

    Store.addEntry({
      id: genId(),
      task: $('#taskInput').value.trim() || 'Без названия',
      projectId: $('#projectSelect').value,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
      duration: r.seconds
    });

    $('#taskInput').value = '';
    $('#btnStart').classList.remove('hidden');
    $('#btnStart').innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Старт`;
    $('#btnPause').classList.add('hidden');
    $('#btnStop').classList.add('hidden');
    $('#timerStatus').innerHTML = '';
    document.title = 'TrackIt';
    this.renderToday();
  }

  // ── Manual Entry ──

  saveManual() {
    const start = new Date($('#manualStart').value);
    const end = new Date($('#manualEnd').value);
    if (isNaN(start) || isNaN(end) || end <= start) { alert('Проверь даты'); return; }

    Store.addEntry({
      id: genId(),
      task: $('#manualTask').value.trim() || 'Без названия',
      projectId: $('#manualProject').value,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration: Math.floor((end - start) / 1000)
    });

    $('#manualEntry').classList.add('hidden');
    $('#manualTask').value = '';
    $('#manualStart').value = '';
    $('#manualEnd').value = '';
    this.renderToday();
  }

  // ── Projects ──

  renderProjects() {
    const projects = Store.projects();

    // Sidebar
    $('#projectsList').innerHTML = projects.map(p => `
      <div class="project-row anim-slide-in">
        <span class="dot" style="background:${p.color};"></span>
        <span class="flex-1 truncate">${p.name}</span>
        <button class="remove-btn btn-notion btn-danger-ghost p-0.5 text-xs" data-id="${p.id}">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');

    $$('#projectsList .remove-btn').forEach(b => {
      b.addEventListener('click', () => {
        Store.deleteProject(b.dataset.id);
        this.renderProjects();
        this.renderToday();
      });
    });

    // Selects
    const opts = `<option value="">Без проекта</option>` +
      projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    $('#projectSelect').innerHTML = opts;
    $('#manualProject').innerHTML = opts;
    $('#filterProject').innerHTML = `<option value="">Все проекты</option>` +
      projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  addProject() {
    const name = prompt('Название проекта:');
    if (!name?.trim()) return;
    Store.addProject(name.trim());
    this.renderProjects();
  }

  // ── Today Entries ──

  renderToday() {
    const entries = Store.entries().filter(e => isToday(e.startTime));
    const total = entries.reduce((s,e) => s + e.duration, 0);
    $('#todayTotal').textContent = fmtHM(total);

    if (!entries.length) {
      $('#todayEntries').innerHTML = `<div class="text-center py-10" style="color:var(--text3);">Пока ничего. Запусти таймер! 🚀</div>`;
      return;
    }

    $('#todayEntries').innerHTML = entries.map((e,i) => this.entryHTML(e,i)).join('');
    this.bindDeleteBtns('#todayEntries');
  }

  entryHTML(e, i) {
    const p = projectById(e.projectId);
    const color = p?.color || 'var(--text3)';
    const pName = p?.name || '';
    const delay = i * 30;

    return `
      <div class="entry-row anim-fade-up" style="animation-delay:${delay}ms;">
        <div style="width:3px; height:32px; border-radius:2px; background:${color}; flex-shrink:0;"></div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${e.task}</div>
          <div class="text-xs truncate" style="color:var(--text3);">${pName}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-semibold timer-mono">${fmtHM(e.duration)}</div>
          <div class="text-[11px]" style="color:var(--text3);">${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}</div>
        </div>
        <button class="delete-btn btn-notion btn-danger-ghost p-1" data-id="${e.id}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;
  }

  bindDeleteBtns(containerSel) {
    $$(containerSel + ' .delete-btn').forEach(b => {
      b.addEventListener('click', () => {
        Store.deleteEntry(b.dataset.id);
        this.renderToday();
        if (this.tab === 'history') this.renderHistory();
        if (this.tab === 'stats') this.renderStats();
      });
    });
  }

  // ── History ──

  setDefaultDates() {
    const now = new Date();
    const week = new Date(now); week.setDate(week.getDate() - 7);
    $('#filterFrom').value = fmtISO(week);
    $('#filterTo').value = fmtISO(now);
  }

  renderHistory() {
    const from = $('#filterFrom').value;
    const to = $('#filterTo').value;
    const pf = $('#filterProject').value;

    let entries = Store.entries();
    if (from) entries = entries.filter(e => fmtISO(e.startTime) >= from);
    if (to) entries = entries.filter(e => fmtISO(e.startTime) <= to);
    if (pf) entries = entries.filter(e => e.projectId === pf);

    const groups = {};
    entries.forEach(e => {
      const d = fmtISO(e.startTime);
      (groups[d] = groups[d] || []).push(e);
    });

    const days = Object.keys(groups).sort().reverse();

    if (!days.length) {
      $('#historyList').innerHTML = `<div class="text-center py-10" style="color:var(--text3);">Нет записей</div>`;
      return;
    }

    $('#historyList').innerHTML = days.map(day => {
      const de = groups[day];
      const tot = de.reduce((s,e) => s+e.duration, 0);
      return `
        <div class="mb-6 anim-fade-up">
          <div class="flex justify-between items-center pb-2 mb-2" style="border-bottom:1px solid var(--border);">
            <span class="text-sm font-medium" style="color:var(--text2);">${fmtDate(day)}</span>
            <span class="text-xs font-medium timer-mono" style="color:var(--text3);">${fmtHM(tot)}</span>
          </div>
          <div class="flex flex-col gap-1">${de.map((e,i)=>this.entryHTML(e,i)).join('')}</div>
        </div>
      `;
    }).join('');

    this.bindDeleteBtns('#historyList');
  }

  exportCSV() {
    const entries = Store.entries();
    if (!entries.length) { alert('Нет данных'); return; }
    const projects = Store.projects();
    const pName = id => projects.find(p=>p.id===id)?.name || '';

    let csv = 'Задача,Проект,Начало,Конец,Минуты\n';
    entries.forEach(e => {
      csv += `"${e.task}","${pName(e.projectId)}","${e.startTime}","${e.endTime}",${Math.round(e.duration/60)}\n`;
    });

    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trackit_${fmtISO(new Date())}.csv`;
    a.click();
  }

  // ── Stats ──

  renderStats() {
    const all = Store.entries();
    const now = new Date();
    let filtered, daysN;

    if (this.statsPeriod === 'week') {
      const d = new Date(now); d.setDate(d.getDate()-7);
      filtered = all.filter(e => new Date(e.startTime)>=d);
      daysN = 7;
    } else if (this.statsPeriod === 'month') {
      const d = new Date(now); d.setDate(d.getDate()-30);
      filtered = all.filter(e => new Date(e.startTime)>=d);
      daysN = 30;
    } else {
      filtered = all;
      daysN = all.length ? Math.max(1, Math.ceil((now - new Date(all[all.length-1].startTime))/864e5)) : 1;
    }

    const totalSec = filtered.reduce((s,e)=>s+e.duration,0);
    const avgSec = Math.round(totalSec / daysN);

    // Top project
    const pt = {};
    filtered.forEach(e => { pt[e.projectId||'_'] = (pt[e.projectId||'_']||0)+e.duration; });
    let topName='—', topSec=0;
    Object.entries(pt).forEach(([id,s]) => {
      if (s>topSec) { topSec=s; const p=projectById(id); topName=p?p.name:'Без проекта'; }
    });

    $('#statTotal').textContent = fmtHM(totalSec);
    $('#statAvg').textContent = fmtHM(avgSec);
    $('#statEntries').textContent = filtered.length;
    $('#statTopProject').textContent = topName;

    this.renderChart(filtered, daysN);
    this.renderBreakdown(filtered);
  }

  renderChart(entries, daysN) {
    const daily = {};
    const now = new Date();
    const n = Math.min(daysN, 14);

    for (let i=n-1; i>=0; i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      daily[fmtISO(d)] = 0;
    }
    entries.forEach(e => { const d=fmtISO(e.startTime); if (daily[d]!==undefined) daily[d]+=e.duration; });

    const max = Math.max(...Object.values(daily), 1);
    const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

    $('#barChart').innerHTML = Object.entries(daily).map(([date, sec]) => {
      const pct = (sec/max)*100;
      const dn = dayNames[new Date(date).getDay()];
      const isToday = date === fmtISO(new Date());
      return `
        <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
          <span class="text-[9px] timer-mono" style="color:var(--text3);">${sec>0?fmtHM(sec):''}</span>
          <div class="bar w-full" style="height:${Math.max(pct,1)}%; background:${isToday?'var(--accent)':'var(--border-2)'}; ${sec===0?'opacity:0.3':''}"></div>
          <span class="text-[10px]" style="color:${isToday?'var(--accent)':'var(--text3)'}; font-weight:${isToday?'600':'400'};">${dn}</span>
        </div>
      `;
    }).join('');
  }

  renderBreakdown(entries) {
    const pt = {};
    entries.forEach(e => { pt[e.projectId||'_'] = (pt[e.projectId||'_']||0)+e.duration; });
    const sorted = Object.entries(pt).sort((a,b)=>b[1]-a[1]);
    const max = sorted[0]?.[1] || 1;

    if (!sorted.length) {
      $('#projectBreakdown').innerHTML = `<div class="text-center py-6" style="color:var(--text3);">Нет данных</div>`;
      return;
    }

    $('#projectBreakdown').innerHTML = sorted.map(([id,sec]) => {
      const p = projectById(id);
      const name = p?.name || 'Без проекта';
      const color = p?.color || 'var(--text3)';
      const pct = (sec/max)*100;
      return `
        <div class="flex items-center gap-3 mb-3 last:mb-0">
          <span class="dot-lg dot" style="background:${color};"></span>
          <span class="text-sm flex-1">${name}</span>
          <div class="breakdown-track w-[180px]">
            <div class="breakdown-fill" style="width:${pct}%; background:${color};"></div>
          </div>
          <span class="text-sm font-semibold timer-mono min-w-[50px] text-right">${fmtHM(sec)}</span>
        </div>
      `;
    }).join('');
  }
}

// ═══════ INIT ═══════
document.addEventListener('DOMContentLoaded', () => new App());
