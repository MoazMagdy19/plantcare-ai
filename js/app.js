(function () {
  'use strict';

  /* ===================== State ===================== */

  const DEFAULT_SETTINGS = {
    plantName: 'نبتة الزينة',
    minMoistureThreshold: 30,
    targetMoisture: 35,
    plantType: 'leafy',
    potSize: 'medium',
    notificationsEnabled: true,
    darkMode: false,
    language: 'ar',
  };

  const NAV_ITEMS = [
    { key: 'home', icon: '🏠' },
    { key: 'sensors', icon: '🌱' },
    { key: 'environment', icon: '💧' },
    { key: 'history', icon: '📈' },
    { key: 'settings', icon: '⚙️' },
  ];

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    page: 'home',
    snapshot: {
      soil: [18, 21, 16, 20],
      temperature: 31.2,
      humidity: 48.6,
      pressure: 1008.7,
      timestamp: Date.now(),
    },
    history: [
      { label: '09:00', average: 42 },
      { label: '10:00', average: 35 },
      { label: '11:00', average: 28 },
      { label: '12:00', average: 22 },
      { label: '13:00', average: 18.7 },
    ],
    isReading: false,
    waterCalc: null, // { key, result }
  };

  const READ_DELAY_MS = 1100;
  const CALC_DELAY_MS = 700;

  /* ===================== Helpers ===================== */

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function jitter(v, spread, min, max) {
    const delta = (Math.random() - 0.5) * 2 * spread;
    return round1(clamp(v + delta, min, max));
  }
  function formatClock(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  function average(soil) { return round1(soil.reduce((a, b) => a + b, 0) / soil.length); }
  function getMoistureLevel(value) {
    if (value < 25) return 'dry';
    if (value < 45) return 'medium';
    return 'good';
  }

  function t() { return getTranslation(state.settings.language); }

  /* ===================== i18n / static text ===================== */

  function applyStaticTranslations() {
    const dict = t();
    document.querySelectorAll('[data-t]').forEach((el) => {
      const value = tGet(dict, el.getAttribute('data-t'));
      if (typeof value === 'string') el.textContent = value;
    });
  }

  function applyDirection() {
    const lang = state.settings.language;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  function applyDarkMode() {
    document.documentElement.classList.toggle('dark', state.settings.darkMode);
  }

  /* ===================== Navigation ===================== */

  function buildNav() {
    const dict = t();
    const sidebarNav = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    sidebarNav.innerHTML = '';
    bottomNav.innerHTML = '';

    NAV_ITEMS.forEach(({ key, icon }) => {
      const isActive = state.page === key;

      const sideBtn = document.createElement('button');
      sideBtn.className = 'nav-item' + (isActive ? ' active' : '');
      sideBtn.innerHTML = `<span class="nav-icon">${icon}</span><span>${dict.nav[key]}</span>`;
      sideBtn.addEventListener('click', () => setPage(key));
      sidebarNav.appendChild(sideBtn);

      const bottomBtn = document.createElement('button');
      bottomBtn.className = 'nav-item' + (isActive ? ' active' : '');
      bottomBtn.innerHTML = `<span class="nav-icon">${icon}</span><span class="nav-text">${dict.nav[key]}</span>`;
      bottomBtn.addEventListener('click', () => setPage(key));
      bottomNav.appendChild(bottomBtn);
    });
  }

  function setPage(key) {
    state.page = key;
    document.querySelectorAll('.page').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.page !== key);
    });
    buildNav();
    renderAll();
  }

  /* ===================== Elapsed "last reading" label ===================== */

  function elapsedLabel(timestamp) {
    const dict = t();
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 3) return dict.home.justNow;
    if (seconds < 60) return dict.home.secondsAgo(seconds);
    return dict.home.minutesAgo(Math.floor(seconds / 60));
  }

  function tickElapsedLabels() {
    const lastReadingEl = document.getElementById('lastReadingLabel');
    if (lastReadingEl) lastReadingEl.textContent = elapsedLabel(state.snapshot.timestamp);
    const deviceLastEl = document.getElementById('deviceLastReading');
    if (deviceLastEl) {
      deviceLastEl.textContent = `${t().home.lastReading}: ${elapsedLabel(state.snapshot.timestamp)}`;
    }
  }

  /* ===================== Sensor simulation ===================== */

  function readSensors() {
    if (state.isReading) return;
    state.isReading = true;
    renderReadButtons();

    window.setTimeout(() => {
      const prev = state.snapshot;
      const drift = -(0.4 + Math.random() * 1.6);
      const nextSoil = prev.soil.map((v) => jitter(v + drift, 1.4, 2, 100));
      const nextTemp = jitter(prev.temperature, 0.4, 5, 45);
      const nextHumidity = jitter(prev.humidity, 1.2, 5, 95);
      const nextPressure = round1(clamp(prev.pressure + (Math.random() - 0.5) * 0.8, 950, 1050));

      state.snapshot = {
        soil: nextSoil,
        temperature: nextTemp,
        humidity: nextHumidity,
        pressure: nextPressure,
        timestamp: Date.now(),
      };

      const label = formatClock(new Date(state.snapshot.timestamp));
      state.history = [...state.history, { label, average: average(nextSoil) }].slice(-8);

      state.isReading = false;
      renderAll();
    }, READ_DELAY_MS);
  }

  /* ===================== Rendering: Home ===================== */

  function renderHome() {
    const dict = t();
    const avg = average(state.snapshot.soil);
    const needsWater = avg < state.settings.minMoistureThreshold;

    // Hero
    const hero = document.getElementById('statusHero');
    hero.classList.toggle('needs-water', needsWater);
    document.getElementById('heroStatusText').textContent = needsWater
      ? `🌱 ${dict.home.plantNeedsWater}`
      : `🌱 ${dict.home.plantOk}`;
    document.getElementById('heroAverage').textContent = avg.toFixed(1);
    tickElapsedLabels();

    // Alert banner
    document.getElementById('alertBanner').classList.toggle('hidden', !needsWater);

    // Moisture bar
    const pct = Math.min(100, Math.max(0, avg));
    const fill = document.getElementById('moistureFill');
    fill.style.width = pct + '%';
    fill.classList.toggle('low', needsWater);
    document.getElementById('moistureLabel').textContent =
      `${dict.home.averageMoisture}: ${avg.toFixed(1)}${dict.common.percent}`;
    const statusEl = document.getElementById('moistureStatus');
    statusEl.classList.toggle('low', needsWater);
    statusEl.textContent = needsWater ? `⚠️ ${dict.home.moistureLow}` : `✓ ${dict.home.moistureGood}`;

    // Read button (main, shown only when water not needed) + water card (shown only when needed)
    document.getElementById('readBtnMain').classList.toggle('hidden', needsWater);
    document.getElementById('waterCard').classList.toggle('hidden', !needsWater);

    if (needsWater) renderWaterCard();

    renderOverviewGrid();
    renderReadButtons();
  }

  function renderReadButtons() {
    const dict = t();
    ['readBtnAlert', 'readBtnMain', 'readBtnSensors'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = state.isReading;
      btn.innerHTML = state.isReading
        ? `<span class="spin">⏳</span><span>${dict.home.reading}</span>`
        : `<span>${dict.home.readSensorsBtn}</span>`;
    });
  }

  function renderOverviewGrid() {
    const dict = t();
    const grid = document.getElementById('overviewGrid');
    grid.innerHTML = '';

    state.snapshot.soil.forEach((value, idx) => {
      const level = getMoistureLevel(value);
      const card = document.createElement('div');
      card.className = `ov-card lvl-${level}`;
      card.innerHTML = `
        <div class="ov-head">
          <span class="ov-icon">🌱</span>
          <span class="ov-label">${dict.sensor.soil} ${idx + 1}</span>
        </div>
        <p class="ov-value">${value.toFixed(0)}${dict.common.percent}</p>`;
      grid.appendChild(card);
    });

    const tempCard = document.createElement('div');
    tempCard.className = 'ov-card';
    tempCard.innerHTML = `
      <div class="ov-head">
        <span class="ov-icon" style="background:rgba(176,111,60,.12);color:#8f5730;">🌡️</span>
        <span class="ov-label">${dict.sensor.temperature}</span>
      </div>
      <p class="ov-value">${state.snapshot.temperature.toFixed(1)}${dict.common.celsius}</p>`;
    grid.appendChild(tempCard);

    const humCard = document.createElement('div');
    humCard.className = 'ov-card';
    humCard.innerHTML = `
      <div class="ov-head">
        <span class="ov-icon" style="background:rgba(2,132,199,.12);color:#0369a1;">💧</span>
        <span class="ov-label">${dict.sensor.humidity}</span>
      </div>
      <p class="ov-value">${state.snapshot.humidity.toFixed(1)}${dict.common.percent}</p>`;
    grid.appendChild(humCard);

    const presCard = document.createElement('div');
    presCard.className = 'ov-card ov-wide';
    presCard.innerHTML = `
      <div class="ov-row">
        <div class="ov-head">
          <span class="ov-icon" style="background:rgba(63,146,79,.12);color:#265d33;">🌬️</span>
          <span class="ov-label">${dict.sensor.pressure}</span>
        </div>
        <p class="ov-value">${state.snapshot.pressure.toFixed(1)} <small>hPa</small></p>
      </div>`;
    grid.appendChild(presCard);
  }

  /* ===================== Water estimate card ===================== */

  function waterInputKey() {
    const avg = average(state.snapshot.soil);
    const s = state.settings;
    return [avg, state.snapshot.temperature, s.targetMoisture, s.plantType, s.potSize].join('|');
  }

  function renderWaterCard() {
    const dict = t();
    const avg = average(state.snapshot.soil);
    const s = state.settings;

    document.getElementById('waterTitleLine').textContent = `🌱 ${dict.home.plantNeedsWater}`;
    document.getElementById('waterCurrent').textContent = avg.toFixed(1) + dict.common.percent;
    document.getElementById('waterTarget').textContent = s.targetMoisture + dict.common.percent;
    document.getElementById('waterTemp').textContent = state.snapshot.temperature.toFixed(1) + dict.common.celsius;

    // Plant type / pot size selects
    const plantSelect = document.getElementById('plantTypeSelect');
    const potSelect = document.getElementById('potSizeSelect');
    plantSelect.innerHTML = Object.keys(dict.water.plantTypes)
      .map((key) => `<option value="${key}" ${key === s.plantType ? 'selected' : ''}>${dict.water.plantTypes[key]}</option>`)
      .join('');
    potSelect.innerHTML = Object.keys(dict.water.potSizes)
      .map((key) => `<option value="${key}" ${key === s.potSize ? 'selected' : ''}>${dict.water.potSizes[key]}</option>`)
      .join('');

    const inputKey = waterInputKey();
    const calc = state.waterCalc && state.waterCalc.key === inputKey ? state.waterCalc.result : null;

    const resultEl = document.getElementById('waterResult');
    const hintEl = document.getElementById('waterHint');
    const calcBtn = document.getElementById('calcWaterBtn');

    if (calc) {
      resultEl.classList.remove('hidden');
      hintEl.classList.add('hidden');
      if (calc.needed) {
        resultEl.innerHTML = `
          <div class="row-kv">
            <span>💧 ${dict.water.suggestedAmount}</span>
            <span class="amount">${calc.liters} <small style="font-size:13px;">${dict.water.liters}</small></span>
          </div>
          <div class="row-kv" style="margin-top:10px;">
            <span>⏰ ${dict.water.suggestedTime}</span>
            <strong>${calc.timing === 'now' ? dict.water.timeNow : dict.water.timeSoon}</strong>
          </div>
          <p class="disclaimer">${dict.water.disclaimer}</p>`;
      } else {
        resultEl.innerHTML = `
          <p class="no-water">✓ ${dict.water.noWaterNeeded}</p>
          <p class="disclaimer">${dict.water.disclaimer}</p>`;
      }
    } else {
      resultEl.classList.add('hidden');
      hintEl.classList.toggle('hidden', state.isReading);
    }

    calcBtn.disabled = false;
    calcBtn.innerHTML = `<span>${dict.water.calcBtn}</span>`;
  }

  function handleCalculateWater() {
    const dict = t();
    const calcBtn = document.getElementById('calcWaterBtn');
    calcBtn.disabled = true;
    calcBtn.innerHTML = `<span class="spin">⏳</span><span>${dict.water.calculating}</span>`;
    document.getElementById('waterHint').classList.add('hidden');

    window.setTimeout(() => {
      const avg = average(state.snapshot.soil);
      const s = state.settings;
      const inputKey = waterInputKey();
      const result = calculateWater({
        currentMoisture: avg,
        targetMoisture: s.targetMoisture,
        temperature: state.snapshot.temperature,
        plantType: s.plantType,
        potSize: s.potSize,
      });
      state.waterCalc = { key: inputKey, result };
      renderWaterCard();
    }, CALC_DELAY_MS);
  }

  /* ===================== Rendering: Sensors ===================== */

  function renderSensors() {
    const dict = t();
    const grid = document.getElementById('sensorsGrid');
    grid.innerHTML = '';

    state.snapshot.soil.forEach((value, idx) => {
      const level = getMoistureLevel(value);
      const statusLabel = dict.sensors[level];
      const card = document.createElement('div');
      card.className = `soil-card lvl-${level}`;
      card.innerHTML = `
        <div class="soil-top">
          <div class="soil-left">
            <span class="soil-icon">🌱</span>
            <div>
              <p class="soil-name">${dict.sensor.soil} ${idx + 1}</p>
              <p class="soil-status">${statusLabel}</p>
            </div>
          </div>
          <p class="soil-value">${value.toFixed(0)}<small>${dict.common.percent}</small></p>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, value))}%"></div></div>`;
      grid.appendChild(card);
    });

    renderReadButtons();
  }

  /* ===================== Rendering: Environment ===================== */

  function renderEnvironment() {
    const dict = t();
    const grid = document.getElementById('envGrid');
    const snap = state.snapshot;
    grid.innerHTML = `
      <div class="env-card">
        <span class="env-emoji temp">🌡️</span>
        <div class="env-body">
          <p class="env-label">${dict.environment.temperature}</p>
          <p class="env-value">${snap.temperature.toFixed(1)}<small>${dict.common.celsius}</small></p>
        </div>
        <span class="env-normal">${dict.environment.normal}</span>
      </div>
      <div class="env-card">
        <span class="env-emoji hum">💧</span>
        <div class="env-body">
          <p class="env-label">${dict.environment.humidity}</p>
          <p class="env-value">${snap.humidity.toFixed(1)}<small>${dict.common.percent}</small></p>
        </div>
        <span class="env-normal">${dict.environment.normal}</span>
      </div>
      <div class="env-card">
        <span class="env-emoji pres">🌬️</span>
        <div class="env-body">
          <p class="env-label">${dict.environment.pressure}</p>
          <p class="env-value">${snap.pressure.toFixed(1)}<small>hPa</small></p>
        </div>
        <span class="env-normal">${dict.environment.normal}</span>
      </div>`;
  }

  /* ===================== Rendering: History ===================== */

  function renderHistory() {
    const dict = t();
    const points = state.history.slice(-8);
    const bars = document.getElementById('chartBars');
    bars.innerHTML = '';

    points.forEach((point, idx) => {
      const level = getMoistureLevel(point.average);
      const heightPct = Math.max(6, (point.average / 100) * 100);
      const isLast = idx === points.length - 1;
      const col = document.createElement('div');
      col.className = 'chart-col' + (isLast ? ' last' : '');
      col.innerHTML = `
        <div class="chart-bar-wrap">
          <span class="chart-bar-val">${point.average.toFixed(0)}</span>
          <div class="chart-bar lvl-${level}" style="height:${heightPct}%;background:var(${
        level === 'dry' ? '--rust-500' : level === 'medium' ? '--sun-500' : '--moss-500'
      })"></div>
        </div>
        <span class="chart-time">${point.label}</span>`;
      bars.appendChild(col);
    });

    const first = points[0] ? points[0].average : 0;
    const last = points[points.length - 1] ? points[points.length - 1].average : 0;
    const diff = last - first;
    const trendEl = document.getElementById('chartTrend');
    if (diff <= -3) {
      trendEl.innerHTML = `📉 <span style="color:var(--rust-600)">${dict.history.trendDown}</span>`;
    } else if (diff >= 3) {
      trendEl.innerHTML = `📈 <span style="color:var(--moss-700)">${dict.history.trendUp}</span>`;
    } else {
      trendEl.innerHTML = `➖ <span>${dict.history.trendStable}</span>`;
    }

    tickElapsedLabels();
  }

  /* ===================== Rendering: Settings ===================== */

  function renderSettings() {
    const dict = t();
    const s = state.settings;

    document.getElementById('plantNameInput').value = s.plantName;
    document.getElementById('plantNameInput').placeholder = dict.settings.plantNamePlaceholder;

    document.getElementById('thresholdRange').value = s.minMoistureThreshold;
    document.getElementById('thresholdValue').textContent = s.minMoistureThreshold + '%';

    document.getElementById('targetRange').value = s.targetMoisture;
    document.getElementById('targetValue').textContent = s.targetMoisture + '%';

    document.getElementById('notifToggle').classList.toggle('on', s.notificationsEnabled);
    document.getElementById('notifToggle').setAttribute('aria-checked', String(s.notificationsEnabled));

    document.getElementById('darkToggle').classList.toggle('on', s.darkMode);
    document.getElementById('darkToggle').setAttribute('aria-checked', String(s.darkMode));

    document.getElementById('langArBtn').classList.toggle('active', s.language === 'ar');
    document.getElementById('langEnBtn').classList.toggle('active', s.language === 'en');
  }

  function flashSaved() {
    const toast = document.getElementById('savedToast');
    toast.classList.add('show');
    window.clearTimeout(flashSaved._t);
    flashSaved._t = window.setTimeout(() => toast.classList.remove('show'), 1200);
  }

  /* ===================== Render everything ===================== */

  function renderAll() {
    applyStaticTranslations();
    buildNav();
    renderHome();
    renderSensors();
    renderEnvironment();
    renderHistory();
    renderSettings();
  }

  /* ===================== Event wiring ===================== */

  function wireEvents() {
    document.getElementById('readBtnAlert').addEventListener('click', readSensors);
    document.getElementById('readBtnMain').addEventListener('click', readSensors);
    document.getElementById('readBtnSensors').addEventListener('click', readSensors);
    document.getElementById('calcWaterBtn').addEventListener('click', handleCalculateWater);

    document.getElementById('plantTypeSelect').addEventListener('change', (e) => {
      state.settings.plantType = e.target.value;
      renderWaterCard();
    });
    document.getElementById('potSizeSelect').addEventListener('change', (e) => {
      state.settings.potSize = e.target.value;
      renderWaterCard();
    });

    document.getElementById('plantNameInput').addEventListener('input', (e) => {
      state.settings.plantName = e.target.value;
    });
    document.getElementById('plantNameInput').addEventListener('blur', flashSaved);

    const thresholdRange = document.getElementById('thresholdRange');
    thresholdRange.addEventListener('input', (e) => {
      state.settings.minMoistureThreshold = Number(e.target.value);
      document.getElementById('thresholdValue').textContent = state.settings.minMoistureThreshold + '%';
      renderHome();
    });
    thresholdRange.addEventListener('change', flashSaved);

    const targetRange = document.getElementById('targetRange');
    targetRange.addEventListener('input', (e) => {
      state.settings.targetMoisture = Number(e.target.value);
      document.getElementById('targetValue').textContent = state.settings.targetMoisture + '%';
      renderWaterCard();
    });
    targetRange.addEventListener('change', flashSaved);

    document.getElementById('notifToggle').addEventListener('click', () => {
      state.settings.notificationsEnabled = !state.settings.notificationsEnabled;
      renderSettings();
      flashSaved();
    });

    document.getElementById('darkToggle').addEventListener('click', () => {
      state.settings.darkMode = !state.settings.darkMode;
      applyDarkMode();
      renderSettings();
      flashSaved();
    });

    document.getElementById('langArBtn').addEventListener('click', () => setLanguage('ar'));
    document.getElementById('langEnBtn').addEventListener('click', () => setLanguage('en'));

    document.getElementById('resetBtn').addEventListener('click', () => {
      state.settings = { ...DEFAULT_SETTINGS };
      state.waterCalc = null;
      applyDarkMode();
      applyDirection();
      renderAll();
      flashSaved();
    });
  }

  function setLanguage(lang) {
    state.settings.language = lang;
    applyDirection();
    renderAll();
    flashSaved();
  }

  /* ===================== Init ===================== */

  function init() {
    applyDirection();
    applyDarkMode();
    wireEvents();
    renderAll();
    window.setInterval(tickElapsedLabels, 1000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
