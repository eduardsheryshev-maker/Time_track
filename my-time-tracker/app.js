// ==========================================
//  TrackIt — Time Tracker App
// ==========================================

const PROJECT_COLORS = [
  '#6c5ce7', '#00d68f', '#ff6b6b', '#ffa94d',
  '#ffd43b', '#74b9ff', '#fd79a8', '#a29bfe',
  '#55efc4', '#fab1a0', '#81ecec', '#dfe6e9'
];

// ===== DATA LAYER (localStorage) =====

class Store {
  static get(key, fallback = []) {
    try {
      const data = localStorage.getItem(`trackit_${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  static set(key, value) {
    localStorage.setItem(`trackit_${key}`, JSON.stringify(value));
  }

  // Entries
  static getEntries() {
    return this.get('entries', []);
  }

  static saveEntry(entry) {
    const entries = this.getEntries();
    entries.unshift(entry);
    this.set('entries', entries);
  }

  static deleteEntry(id) {
    const entries = this.getEntries().filter(e => e.id !== id);
    this.set('entries', entries);
  }

  // Projects
  static getProjects() {
    return this.get('projects', [
      { id: 'p1', name: 'Работа', color: PROJECT_COLORS[0] },
      { id: 'p2', name: 'Учёба', color: PROJECT_COLORS[1] },
      { id: 'p3', name: 'Личное', color: PROJECT_COLORS[2] },
    ]);
  }

  static saveProjects(projects) {
    this.set('projects', projects);
  }

  static addProject(name) {
    const projects = this.getProjects();
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const project = { id: 'p' + Date.now(), name, color };
    projects.push(project);
    this.saveProjects(projects);
    return project;
  }

  static deleteProject(id) {
    const projects = this.getProjects().filter(p => p.id !== id);
    this.saveProjects(projects);
  }
}

// ===== TIMER ENGINE =====

class Timer {
  constructor(onTick) {
    this.seconds = 0;
    this.running = false;
    this.paused = false;
    this.interval = null;
    this.startTime = null;
    this.onTick = onTick;
  }

  start() {
    if (this.running && !this.paused) return;
    if (!this.startTime) this.startTime = new Date();
    this.running = true;
    this.paused = false;
    this.interval = setInterval(() => {
      this.seconds++;
      this.onTick(this.seconds);
    }, 1000);
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    clearInterval(this.interval);
  }

  resume() {
    if (!this.paused) return;
    this.start();
  }

  stop() {
    clearInterval(this.interval);
    const result = {
      seconds: this.seconds,
      startTime: this.startTime,
      endTime: new Date()
    };
    this.seconds = 0;
    this.running = false;
    this.paused = false;
    this.startTime = null;
    this.onTick(0);
    return result;
  }
}

// ===== HELPERS =====

function formatDuration(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatHM(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}м`;
  return `${h}ч ${m}м`;
}

function formatTimeShort(date) {
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  });
}

function formatDateISO(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function isSameDay(d1, d2) {
  return formatDateISO(d1) === formatDateISO(d2);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getProjectById(id) {
  return Store.getProjects().find(p => p.id === id);
}

// ===== APP =====

class App {
  constructor() {
    this.timer = new Timer((s) => this.updateTimerDisplay(s));
    this.currentTab = 'timer';
    this.statsPeriod = 'week';

    this.cacheElements();
    this.bindEvents();
    this.renderProjects();
    this.renderTodayEntries();
    this.setDefaultDates();
  }

  cacheElements() {
    // Timer
    this.elTimerDisplay = document.getElementById('timerDisplay');
    this.elTaskInput = document.getElementById('taskInput');
    this.elProjectSelect = document.getElementById('projectSelect');
    this.elBtnStart = document.getElementById('btnStart');
    this.elBtnPause = document.getElementById('btnPause');
    this.elBtnStop = document.getElementById('btnStop');

    // Manual
    this.elManualEntry = document.getElementById('manualEntry');
    this.elManualTask = document.getElementById('manualTask');
    this.elManualProject = document.getElementById('manualProject');
    this.elManualStart = document.getElementById('manualStart');
    this.elManualEnd = document.getElementById('manualEnd');

    // Today
    this.elTodayEntries = document.getElementById('todayEntries');
    this.elTodayTotal = document.getElementById('todayTotal');

    // History
    this.elHistoryList = document.getElementById('historyList');
    this.elFilterFrom = document.getElementById('filterFrom');
    this.elFilterTo = document.getElementById('filterTo');
    this.elFilterProject = document.getElementById('filterProject');

    // Stats
    this.elBarChart = document.getElementById('barChart');
    this.elProjectBreakdown = document.getElementById('projectBreakdown');

    // Projects sidebar
    this.elProjectsList = document.getElementById('projectsList');
  }

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Timer controls
    this.elBtnStart.addEventListener('click', () => this.startTimer());
    this.elBtnPause.addEventListener('click', () => this.pauseTimer());
    this.elBtnStop.addEventListener('click', () => this.stopTimer());

    // Manual entry
    document.getElementById('btnManualToggle').addEventListener('click', () => {
      this.elManualEntry.classList.toggle('hidden');
    });
    document.getElementById('btnManualSave').addEventListener('click', () => this.saveManualEntry());

    // Projects
    document.getElementById('btnAddProject').addEventListener('click', () => this.addProject());

    // History
    document.getElementById('btnFilter').addEventListener('click', () => this.renderHistory());
    document.getElementById('btnExport').addEventListener('click', () => this.exportCSV());

    // Stats period
    document.querySelectorAll('.stats-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stats-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.statsPeriod = btn.dataset.period;
        this.renderStats();
      });
    });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.timer.running) this.startTimer();
        else if (this.timer.paused) this.startTimer();
        else this.pauseTimer();
      }
      if (e.code === 'Escape' && this.timer.running) {
        this.stopTimer();
      }
    });
  }

  // ===== TABS =====

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'timer') {
      document.getElementById('tabTimer').classList.add('active');
      this.renderTodayEntries();
    } else if (tab === 'history') {
      document.getElementById('tabHistory').classList.add('active');
      this.renderHistory();
    } else if (tab === 'stats') {
      document.getElementById('tabStats').classList.add('active');
      this.renderStats();
    }
  }

  // ===== TIMER =====

  updateTimerDisplay(seconds) {
    this.elTimerDisplay.textContent = formatDuration(seconds);
    document.title = this.timer.running
      ? `${formatDuration(seconds)} — TrackIt`
      : 'TrackIt';
  }

  startTimer() {
    if (this.timer.paused) {
      this.timer.resume();
    } else {
      this.timer.start();
    }
    this.elBtnStart.classList.add('hidden');
    this.elBtnPause.classList.remove('hidden');
    this.elBtnStop.classList.remove('hidden');
  }

  pauseTimer() {
    this.timer.pause();
    this.elBtnPause.classList.add('hidden');
    this.elBtnStart.classList.remove('hidden');
    this.elBtnStart.textContent = '▶ Продолжить';
  }

  stopTimer() {
    const result = this.timer.stop();
    if (result.seconds < 1) return;

    const entry = {
      id: generateId(),
      task: this.elTaskInput.value.trim() || 'Без названия',
      projectId: this.elProjectSelect.value || '',
      startTime: result.startTime.toISOString(),
      endTime: result.endTime.toISOString(),
      duration: result.seconds
    };

    Store.saveEntry(entry);
    this.elTaskInput.value = '';

    // Reset buttons
    this.elBtnStart.classList.remove('hidden');
    this.elBtnStart.textContent = '▶ Старт';
    this.elBtnPause.classList.add('hidden');
    this.elBtnStop.classList.add('hidden');

    document.title = 'TrackIt';
    this.renderTodayEntries();
  }

  // ===== MANUAL ENTRY =====

  saveManualEntry() {
    const task = this.elManualTask.value.trim() || 'Без названия';
    const projectId = this.elManualProject.value;
    const start = new Date(this.elManualStart.value);
    const end = new Date(this.elManualEnd.value);

    if (isNaN(start) || isNaN(end) || end <= start) {
      alert('Проверь даты: конец должен быть позже начала');
      return;
    }

    const duration = Math.floor((end - start) / 1000);

    const entry = {
      id: generateId(),
      task,
      projectId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration
    };

    Store.saveEntry(entry);
    this.elManualEntry.classList.add('hidden');
    this.elManualTask.value = '';
    this.elManualStart.value = '';
    this.elManualEnd.value = '';
    this.renderTodayEntries();
  }

  // ===== PROJECTS =====

  renderProjects() {
    const projects = Store.getProjects();

    // Sidebar list
    this.elProjectsList.innerHTML = projects.map(p => `
      <li class="project-item">
        <span class="project-dot" style="background:${p.color}"></span>
        <span>${p.name}</span>
        <button class="delete-project" data-id="${p.id}">✕</button>
      </li>
    `).join('');

    // Delete handlers
    this.elProjectsList.querySelectorAll('.delete-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Удалить проект?')) {
          Store.deleteProject(btn.dataset.id);
          this.renderProjects();
        }
      });
    });

    // Update all <select>s
    const optionsHTML = '<option value="">Без проекта</option>' +
      projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    this.elProjectSelect.innerHTML = optionsHTML;
    this.elManualProject.innerHTML = optionsHTML;
    this.elFilterProject.innerHTML = '<option value="">Все проекты</option>' +
      projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  addProject() {
    const name = prompt('Название проекта:');
    if (!name || !name.trim()) return;
    Store.addProject(name.trim());
    this.renderProjects();
  }

  // ===== TODAY ENTRIES =====

  renderTodayEntries() {
    const entries = Store.getEntries().filter(e => isSameDay(e.startTime, new Date()));
    const total = entries.reduce((sum, e) => sum + e.duration, 0);

    this.elTodayTotal.textContent = formatHM(total);

    if (entries.length === 0) {
      this.elTodayEntries.innerHTML = '<div class="empty-state">Пока ничего. Запусти таймер! 🚀</div>';
      return;
    }

    this.elTodayEntries.innerHTML = entries.map(e => this.renderEntryCard(e)).join('');
    this.bindDeleteButtons(this.elTodayEntries);
  }

  renderEntryCard(entry) {
    const project = getProjectById(entry.projectId);
    const color = project ? project.color : '#555';
    const projectName = project ? project.name : '';

    return `
      <div class="entry-card">
        <div class="entry-color" style="background:${color}"></div>
        <div class="entry-info">
          <div class="entry-task">${entry.task}</div>
          <div class="entry-project">${projectName}</div>
        </div>
        <div class="entry-time">
          <div class="entry-duration">${formatHM(entry.duration)}</div>
          <div class="entry-range">${formatTimeShort(entry.startTime)} – ${formatTimeShort(entry.endTime)}</div>
        </div>
        <button class="entry-delete" data-id="${entry.id}">🗑</button>
      </div>
    `;
  }

  bindDeleteButtons(container) {
    container.querySelectorAll('.entry-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.deleteEntry(btn.dataset.id);
        this.renderTodayEntries();
        if (this.currentTab === 'history') this.renderHistory();
        if (this.currentTab === 'stats') this.renderStats();
      });
    });
  }

  // ===== HISTORY =====

  setDefaultDates() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    this.elFilterFrom.value = formatDateISO(weekAgo);
    this.elFilterTo.value = formatDateISO(now);
  }

  renderHistory() {
    const from = this.elFilterFrom.value;
    const to = this.elFilterTo.value;
    const projectFilter = this.elFilterProject.value;

    let entries = Store.getEntries();

    if (from) entries = entries.filter(e => formatDateISO(e.startTime) >= from);
    if (to) entries = entries.filter(e => formatDateISO(e.startTime) <= to);
    if (projectFilter) entries = entries.filter(e => e.projectId === projectFilter);

    // Group by date
    const groups = {};
    entries.forEach(e => {
      const day = formatDateISO(e.startTime);
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });

    const sortedDays = Object.keys(groups).sort().reverse();

    if (sortedDays.length === 0) {
      this.elHistoryList.innerHTML = '<div class="empty-state">Нет записей за выбранный период</div>';
      return;
    }

    this.elHistoryList.innerHTML = sortedDays.map(day => {
      const dayEntries = groups[day];
      const dayTotal = dayEntries.reduce((s, e) => s + e.duration, 0);
      return `
        <div class="history-date-group">
          <div class="history-date-header">
            <span>${formatDate(day)}</span>
            <span>${formatHM(dayTotal)}</span>
          </div>
          <div class="entries-list">
            ${dayEntries.map(e => this.renderEntryCard(e)).join('')}
          </div>
        </div>
      `;
    }).join('');

    this.bindDeleteButtons(this.elHistoryList);
  }

  exportCSV() {
    const entries = Store.getEntries();
    if (entries.length === 0) { alert('Нет данных для экспорта'); return; }

    const projects = Store.getProjects();
    const getProjectName = (id) => {
      const p = projects.find(pr => pr.id === id);
      return p ? p.name : '';
    };

    let csv = 'Задача,Проект,Начало,Конец,Длительность (мин)\n';
    entries.forEach(e => {
      const mins = Math.round(e.duration / 60);
      csv += `"${e.task}","${getProjectName(e.projectId)}","${e.startTime}","${e.endTime}",${mins}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackit_export_${formatDateISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== STATS =====

  renderStats() {
    const entries = Store.getEntries();
    const now = new Date();
    let filtered;
    let daysCount;

    if (this.statsPeriod === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = entries.filter(e => new Date(e.startTime) >= weekAgo);
      daysCount = 7;
    } else if (this.statsPeriod === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      filtered = entries.filter(e => new Date(e.startTime) >= monthAgo);
      daysCount = 30;
    } else {
      filtered = entries;
      if (entries.length > 0) {
        const oldest = new Date(entries[entries.length - 1].startTime);
        daysCount = Math.max(1, Math.ceil((now - oldest) / 86400000));
      } else {
        daysCount = 1;
      }
    }

    const totalSec = filtered.reduce((s, e) => s + e.duration, 0);
    const avgSec = Math.round(totalSec / daysCount);

    // Top project
    const projectTotals = {};
    filtered.forEach(e => {
      const pid = e.projectId || '_none';
      projectTotals[pid] = (projectTotals[pid] || 0) + e.duration;
    });

    let topProjectName = '—';
    let topProjectSec = 0;
    Object.entries(projectTotals).forEach(([pid, sec]) => {
      if (sec > topProjectSec) {
        topProjectSec = sec;
        const p = getProjectById(pid);
        topProjectName = p ? p.name : 'Без проекта';
      }
    });

    document.getElementById('statTotal').textContent = formatHM(totalSec);
    document.getElementById('statAvg').textContent = formatHM(avgSec);
    document.getElementById('statEntries').textContent = filtered.length;
    document.getElementById('statTopProject').textContent = topProjectName;

    // Bar chart — daily
    this.renderBarChart(filtered, daysCount);

    // Breakdown
    this.renderBreakdown(filtered, totalSec);
  }

  renderBarChart(entries, daysCount) {
    const dailyData = {};
    const now = new Date();

    const chartDays = Math.min(daysCount, 14); // max 14 bars

    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyData[formatDateISO(d)] = 0;
    }

    entries.forEach(e => {
      const day = formatDateISO(e.startTime);
      if (dailyData[day] !== undefined) {
        dailyData[day] += e.duration;
      }
    });

    const maxSec = Math.max(...Object.values(dailyData), 1);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    this.elBarChart.innerHTML = Object.entries(dailyData).map(([date, sec]) => {
      const pct = (sec / maxSec) * 100;
      const dayName = days[new Date(date).getDay()];
      return `
        <div class="chart-bar-wrapper">
          <div class="chart-value">${sec > 0 ? formatHM(sec) : ''}</div>
          <div class="chart-bar" style="height:${Math.max(pct, 1)}%;${sec === 0 ? 'opacity:0.2' : ''}"></div>
          <div class="chart-label">${dayName}</div>
        </div>
      `;
    }).join('');
  }

  renderBreakdown(entries, totalSec) {
    const projectTotals = {};
    entries.forEach(e => {
      const pid = e.projectId || '_none';
      projectTotals[pid] = (projectTotals[pid] || 0) + e.duration;
    });

    const sorted = Object.entries(projectTotals).sort((a, b) => b[1] - a[1]);
    const maxSec = sorted.length > 0 ? sorted[0][1] : 1;

    if (sorted.length === 0) {
      this.elProjectBreakdown.innerHTML = '<div class="empty-state">Нет данных</div>';
      return;
    }

    this.elProjectBreakdown.innerHTML = sorted.map(([pid, sec]) => {
      const p = getProjectById(pid);
      const name = p ? p.name : 'Без проекта';
      const color = p ? p.color : '#555';
      const pct = (sec / maxSec) * 100;

      return `
        <div class="breakdown-item">
          <div class="breakdown-color" style="background:${color}"></div>
          <div class="breakdown-name">${name}</div>
          <div class="breakdown-bar-bg">
            <div class="breakdown-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="breakdown-hours">${formatHM(sec)}</div>
        </div>
      `;
    }).join('');
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => new App());
