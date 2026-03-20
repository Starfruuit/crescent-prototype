'use strict';

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
const STATE = {
  tz: -5,
  reminders: [],
  settings: {
    dyslexic: false,
    extra: false,
    simpleAnimations: true,
    longWeekendCountry: 'US',
    textSize: 2,      // 0–4 maps to xs/sm/md/lg/xl
    theme: 'dark',
  },
  selectedDate: null,
  viewMonth: null,
  viewYear: null,
  longWeekends: [],
  publicHolidays: [],
};
const SIZE_CLASSES = ['size-xs', 'size-sm', 'size-md', 'size-lg', 'size-xl'];
const SIZE_LABELS  = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];

// Load saved state
try {
  const saved = localStorage.getItem('crescent_v2');
  if (saved) {
    const s = JSON.parse(saved);
    STATE.tz        = s.tz        ?? STATE.tz;
    STATE.reminders = s.reminders ?? [];
    STATE.settings  = { ...STATE.settings, ...(s.settings ?? {}) };
  }
} catch (_) {}

function saveState() {
  try {
    localStorage.setItem('crescent_v2', JSON.stringify({
      tz: STATE.tz,
      reminders: STATE.reminders,
      settings: STATE.settings,
      longWeekends: STATE.longWeekends,
      publicHolidays: STATE.publicHolidays,
    }));
  } catch (_) {}
}

function loadCachedApiData() {
  try {
    const saved = localStorage.getItem('crescent_v2');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed.longWeekends)) STATE.longWeekends = parsed.longWeekends;
    if (Array.isArray(parsed.publicHolidays)) STATE.publicHolidays = parsed.publicHolidays;
  } catch (_) {}
}

// ══════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const SPECIAL_DAYS = [
  { month:1,  day:1,  name:"New Year's Day",      emoji:'🎆' },
  { month:1,  day:17, name:"Martin Luther King Jr Day", emoji:'✊' },
  { month:2,  day:2,  name:"Groundhog Day",        emoji:'🦔' },
  { month:2,  day:14, name:"Valentine's Day",      emoji:'💘' },
  { month:3,  day:17, name:"St. Patrick's Day",    emoji:'🍀' },
  { month:3,  day:20, name:"Spring Equinox",       emoji:'🌸' },
  { month:4,  day:1,  name:"April Fools",          emoji:'🃏' },
  { month:4,  day:22, name:"Earth Day",            emoji:'🌍' },
  { month:5,  day:4,  name:"Star Wars Day",        emoji:'⚔️' },
  { month:5,  day:25, name:"Towel Day",            emoji:'🏠' },
  { month:6,  day:21, name:"Summer Solstice",      emoji:'☀️' },
  { month:7,  day:4,  name:"Independence Day",     emoji:'🎇' },
  { month:8,  day:11, name:"Perseid Meteor Shower",emoji:'🌠' },
  { month:9,  day:22, name:"Autumn Equinox",       emoji:'🍂' },
  { month:10, day:13, name:"Spooky Season Begins", emoji:'🕸️' },
  { month:10, day:31, name:"Halloween",            emoji:'🎃' },
  { month:11, day:11, name:"Veterans Day",         emoji:'🎖️' },
  { month:12, day:13, name:"Meteor Shower (Geminid)", emoji:'🌌' },
  { month:12, day:21, name:"Winter Solstice",      emoji:'❄️' },
  { month:12, day:25, name:"Christmas",            emoji:'🎄' },
  { month:12, day:31, name:"New Year's Eve",       emoji:'🥂' },
];

const EXTRA_ONLY_SPECIAL_NAMES = new Set([
  'Towel Day', 'Star Wars Day', 'Groundhog Day', 'April Fools',
  'Perseid Meteor Shower', 'Spooky Season Begins', 'Meteor Shower (Geminid)', 'Truman Day'
]);

function isExtraOnlySpecialName(name) {
  return EXTRA_ONLY_SPECIAL_NAMES.has(name);
}

const LONG_WEEKEND_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' }
];

// ══════════════════════════════════════════════
//  TIMEZONE & TIME UTILS
// ══════════════════════════════════════════════
function getNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 75000;
  return new Date(utcMs + STATE.tz * 3600000);
}

function todayStr() {
  const n = getNow();
  return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
}

function pad(n) { return String(n).padStart(2,'0'); }

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h%12||12}:${pad(m)} ${ampm}`;
}

function getMoonPhase(year, month, day) {
  const emojis = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
  const names  = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Third Quarter','Waning Crescent'];
  const d = new Date(year, month-1, day);
  const ref = new Date(2000, 0, 6);
  const diff = Math.floor((d - ref) / 86400000);
  const cycle = ((diff % 29.53) + 29.53) % 29.53;
  const idx = Math.round(cycle / 29.53 * 8) % 8;
  return { emoji: emojis[idx], name: names[idx] };
}

function getLongWeekendForDate(dateStr) {
  return STATE.longWeekends.find(lw => dateStr >= lw.startDate && dateStr <= lw.endDate);
}

function getPublicHolidayForDate(dateStr) {
  return STATE.publicHolidays.find(ph => ph.date === dateStr);
}

function getHolidayEmoji(holidayName) {
  const lower = holidayName.toLowerCase();
  if (lower.includes('easter')) return '🥚';
  if (lower.includes('christmas')) return '🎄';
  if (lower.includes('new year')) return '🎆';
  if (lower.includes('independence')) return '🎇';
  if (lower.includes('labour') || lower.includes('labor')) return '🛠️';
  if (lower.includes('thanksgiving')) return '🦃';
  if (lower.includes('holiday')) return '🎉';
  return '📅';
}

function isObservedIndependenceDay(holiday) {
  if (!holiday || !holiday.name) return false;
  const nameLower = holiday.name.toLowerCase();
  if (!nameLower.includes('independence day')) return false;
  const year = Number(holiday.date.split('-')[0]);
  return holiday.date !== `${year}-07-04`;
}

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isEaster(dateStr) {
  const year = Number(dateStr.split('-')[0]);
  return dateStr === getEasterDate(year);
}

async function fetchLongWeekends() {
  const countryCode = STATE.settings.longWeekendCountry;
  const baseYear = STATE.viewYear != null ? STATE.viewYear : getNow().getFullYear();
  const toFetchYears = [baseYear - 1, baseYear, baseYear + 1];
  const longWeekendResults = [];
  const holidayResults = [];

  let hasAnyHolidays = false;

  for (const year of toFetchYears) {
    if (STATE.settings.extra) {
      try {
        const lwResp = await fetch(`https://date.nager.at/api/v3/LongWeekend/${year}/${countryCode}`, { cache: 'no-store' });
        if (lwResp.ok) {
          const lwJson = await lwResp.json();
          if (Array.isArray(lwJson)) {
            lwJson.forEach(item => { if (item.startDate && item.endDate) longWeekendResults.push({ ...item, year }); });
          }
        }
      } catch (err) {
        console.warn('LongWeekend API error:', err);
      }
    }

    try {
      const phResp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, { cache: 'no-store' });
      if (phResp.ok) {
        const phJson = await phResp.json();
        if (Array.isArray(phJson)) {
          phJson.forEach(item => {
            if (!item.date || !item.name) return;
            if (isObservedIndependenceDay(item)) return;
            holidayResults.push({ ...item, year });
          });
          hasAnyHolidays = hasAnyHolidays || phJson.length > 0;
        }
      }
    } catch (err) {
      console.warn('PublicHolidays API error:', err);
    }
  }

  if (!hasAnyHolidays && Array.isArray(STATE.publicHolidays) && STATE.publicHolidays.length > 0) {
    // use cached API data when available
    holidayResults.push(...STATE.publicHolidays);
  }

  STATE.longWeekends = longWeekendResults;
  STATE.publicHolidays = holidayResults;
  saveState();
  renderCalendar();
  renderContentArea();
}

// ══════════════════════════════════════════════
//  SCREEN SYSTEM
// ══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
  if (id === 'main')     renderAll();
  if (id === 'settings') renderSettings();
}

// ══════════════════════════════════════════════
//  STARS
// ══════════════════════════════════════════════
function generateStars() {
  const el = document.getElementById('stars');
  el.innerHTML = '';
  for (let i = 0; i < 130; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.4 + 0.4;
    s.style.cssText = `width:${size}px;height:${size}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--d:${(Math.random()*3+1.5).toFixed(1)}s;animation-delay:${(Math.random()*5).toFixed(1)}s;opacity:${(Math.random()*1+0.5).toFixed(2)}`;
    el.appendChild(s);
  }
}

// ══════════════════════════════════════════════
//  WELCOME / ENTER APP
// ══════════════════════════════════════════════
function enterApp() {
  const tz = parseFloat(document.getElementById('tz-select').value);
  STATE.tz = tz;
  saveState();
  showScreen('main');
}

// ══════════════════════════════════════════════
//  DATE HEADER
// ══════════════════════════════════════════════
function renderDateHeader() {
  const now = getNow();
  const tzSign = STATE.tz >= 0 ? '+' : '';
  const tzLabel = `UTC${tzSign}${STATE.tz}`;
  const h = now.getHours(), mi = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  document.getElementById('main-date-big').textContent =
    `${DAYS_LONG[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  document.getElementById('main-date-sub').textContent =
    `${h%12||12}:${pad(mi)} ${ampm} · ${tzLabel}`;
}

// ══════════════════════════════════════════════
//  CALENDAR
// ══════════════════════════════════════════════
function renderCalendar() {
  const now = getNow();
  if (STATE.viewMonth === null) { STATE.viewMonth = now.getMonth(); STATE.viewYear = now.getFullYear(); }
  if (STATE.selectedDate === null) STATE.selectedDate = todayStr();

  const m = STATE.viewMonth, y = STATE.viewYear;
  document.getElementById('cal-month-label').textContent = `${MONTHS[m]} ${y}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Day headers
  ['S','M','T','W','T','F','S'].forEach((h, i) => {
    const el = document.createElement('div');
    el.className = 'cal-header' + (i===0||i===6 ? ' weekend' : '');
    el.textContent = h;
    grid.appendChild(el);
  });

  const firstDow   = new Date(y, m, 1).getDay();
  const daysInMon  = new Date(y, m+1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const today      = todayStr();

  // Previous month padding
  for (let i = firstDow-1; i >= 0; i--) {
    const el = document.createElement('div');
    el.className = 'cal-day other-month empty';
    el.textContent = daysInPrev - i;
    grid.appendChild(el);
  }

  // Current month days
  for (let d = 1; d <= daysInMon; d++) {
    const el = document.createElement('div');
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    const dow = new Date(y, m, d).getDay();
    let cls = 'cal-day';
    if (dow===0||dow===6) cls += ' weekend-col';
    if (ds === today) cls += ' today';
    if (ds === STATE.selectedDate) cls += ' selected';
    if (STATE.reminders.some(r => r.date === ds)) cls += ' has-reminder';
    const matchedSpecials = SPECIAL_DAYS.filter(s => s.month===m+1 && s.day===d);
    const hasVisibleSpecial = matchedSpecials.some(s => STATE.settings.extra || !isExtraOnlySpecialName(s.name));
    if (hasVisibleSpecial) cls += ' has-special';
    if (getPublicHolidayForDate(ds) || (STATE.settings.extra && getLongWeekendForDate(ds)) || isEaster(ds)) cls += ' has-special';
    el.className = cls;
    el.textContent = d;
    el.onclick = () => selectDay(ds);
    grid.appendChild(el);
  }

  // Next month padding
  const total = firstDow + daysInMon;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day other-month empty';
    el.textContent = i;
    grid.appendChild(el);
  }
}

function changeMonth(dir) {
  STATE.viewMonth += dir;
  if (STATE.viewMonth > 11) { STATE.viewMonth = 0; STATE.viewYear++; }
  if (STATE.viewMonth < 0)  { STATE.viewMonth = 11; STATE.viewYear--; }
  renderCalendar();
  renderContentArea();
}

function selectDay(ds) {
  STATE.selectedDate = ds;
  renderCalendar();
  renderContentArea();
}

// ══════════════════════════════════════════════
//  CONTENT AREA
// ══════════════════════════════════════════════
function renderContentArea() {
  // Day banner
  const banner = document.getElementById('selected-day-banner');
  if (STATE.selectedDate) {
    const [sy, sm, sd] = STATE.selectedDate.split('-').map(Number);
    const dow = new Date(sy, sm-1, sd).getDay();
    banner.innerHTML = `<div class="day-banner">${DAYS_LONG[dow]}, ${MONTHS[sm-1]} ${sd}, ${sy}</div>`;
  } else { banner.innerHTML = ''; }

  // Special days for selected date only
  const specialList = document.getElementById('special-list');
  if (!STATE.selectedDate) {
    specialList.innerHTML = '<div class="no-items">select a day to see special events!</div>';
  } else {
    const [sy, sm, sd] = STATE.selectedDate.split('-').map(Number);
    const specials = SPECIAL_DAYS
      .filter(s => s.month === sm && s.day === sd)
      .filter(s => STATE.settings.extra || !isExtraOnlySpecialName(s.name));

    // Moon phase for selected date (if extra events on)
    if (STATE.settings.extra) {
      const moon = getMoonPhase(sy, sm, sd);
      if (!specials.find(s => s.name === moon.name)) {
        specials.push({ month: sm, day: sd, name: moon.name, emoji: moon.emoji });
      }

      // Long weekend info for selected date
      const lw = getLongWeekendForDate(STATE.selectedDate);
      if (lw) {
        const countryName = LONG_WEEKEND_COUNTRIES.find(c => c.code === lw.countryCode)?.name || lw.countryCode;
        const lwName = `Long Weekend`;
        if (!specials.find(s => s.name === lwName)) {
          specials.push({ month: sm, day: sd, name: lwName, emoji: '🏖️' });
        }
      }
    }

    // Public holidays (from API) for selected date (always enabled)
    const ph = getPublicHolidayForDate(STATE.selectedDate);
    if (ph && !isObservedIndependenceDay(ph)) {
      const holidayName = ph.localName || ph.name || 'Public Holiday';
      if (!specials.find(s => s.name === holidayName)) {
        specials.push({ month: sm, day: sd, name: holidayName, emoji: getHolidayEmoji(holidayName) });
      }
    }

    // Easter fallback always visible
    if (isEaster(STATE.selectedDate) && !specials.find(s => s.name.toLowerCase().includes('easter'))) {
      specials.push({ month: sm, day: sd, name: 'Easter', emoji: '🥚' });
    }

    if (specials.length === 0) {
      specialList.innerHTML = '<div class="no-items">no special events today...</div>';
    } else {
      specialList.innerHTML = specials.map(s =>
        `<div class="special-item">
          <div class="si-emoji">${s.emoji}</div>
          <div class="si-text">
            <div class="si-name">${s.name}</div>
            <div class="si-date">${MONTHS[s.month-1]} ${s.day}</div>
          </div>
        </div>`
      ).join('');
    }
  }

  // Reminders
  const reminderList = document.getElementById('reminder-list');
  const list = STATE.selectedDate
    ? STATE.reminders.filter(r => r.date === STATE.selectedDate)
    : [...STATE.reminders].sort((a,b) => a.date.localeCompare(b.date));

  if (list.length === 0) {
    reminderList.innerHTML = `<div class="no-items">${STATE.selectedDate ? 'no reminders today' : 'no reminders yet'} — tap ＋ to add one!</div>`;
  } else {
    reminderList.innerHTML = list.map(r => {
      const [ry, rm, rd] = r.date.split('-').map(Number);
      const label = `${MONTHS[rm-1]} ${rd}, ${ry}${r.allDay ? ' · All Day' : (r.time ? ' · ' + formatTime(r.time) : '')}`;
      return `<div class="reminder-item">
        <div class="ri-dot"></div>
        <div class="ri-body">
          <div class="ri-text">${r.text}</div>
          <div class="ri-date">${label}</div>
        </div>
        <button class="ri-del" onclick="deleteReminder('${r.id}')" title="Delete">🗑</button>
      </div>`;
    }).join('');
  }
}

function renderAll() {
  renderDateHeader();
  renderCalendar();
  renderContentArea();
}

// ══════════════════════════════════════════════
//  REMINDERS CRUD
// ══════════════════════════════════════════════
function openAddModal() {
  const now = getNow();
  document.getElementById('r-date').value = STATE.selectedDate
    || `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  document.getElementById('r-text').value = '';
  document.getElementById('r-time').value = '';
  document.getElementById('modal-add').classList.add('open');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function addReminder() {
  const text = document.getElementById('r-text').value.trim();
  const date = document.getElementById('r-date').value;
  const allDay = document.getElementById('r-allday').checked;
  const time = allDay ? '' : document.getElementById('r-time').value;
  if (!text || !date) { showToast('⚠️ Please enter text and a date!'); return; }
  STATE.reminders.push({ id: Date.now().toString(36), text, date, time, allDay });
  saveState();
  closeModal('modal-add');
  renderCalendar();
  renderContentArea();
  showToast('✓ Reminder saved!');
}

function deleteReminder(id) {
  STATE.reminders = STATE.reminders.filter(r => r.id !== id);
  saveState();
  renderCalendar();
  renderContentArea();
  showToast('🗑 Reminder removed');
}

// ══════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════
function renderSettings() {
  const s = STATE.settings;
  document.getElementById('toggle-dyslexic').className = 'toggle' + (s.dyslexic ? ' on' : '');
  document.getElementById('toggle-extra').className    = 'toggle' + (s.extra    ? ' on' : '');
  document.getElementById('toggle-simple-animations').className = 'toggle' + (s.simpleAnimations ? ' on' : '');

  // Slider
  const slider = document.getElementById('size-slider');
  slider.value = s.textSize;
  document.getElementById('size-label').textContent = SIZE_LABELS[s.textSize];

  // Swatches
  ['dark','light','purple'].forEach(th => {
    const sw = document.getElementById('swatch-'+th);
    sw.className = `theme-swatch swatch-${th}` + (s.theme === th ? ' active' : '');
  });

  // TZ
  const sel = document.getElementById('tz-select-settings');
  if (sel.options.length === 0) {
    sel.innerHTML = document.getElementById('tz-select').innerHTML;
  }
  sel.value = STATE.tz;

  // Long weekend country
  const countrySel = document.getElementById('country-select');
  countrySel.innerHTML = LONG_WEEKEND_COUNTRIES.map(c =>
    `<option value="${c.code}">${c.name}</option>`
  ).join('');
  countrySel.value = STATE.settings.longWeekendCountry;
}

function setLongWeekendCountry(code) {
  STATE.settings.longWeekendCountry = code;
  saveState();
  fetchLongWeekends();
  renderSettings();
  showToast('🌍 Long weekend country: ' + (LONG_WEEKEND_COUNTRIES.find(c => c.code === code)?.name || code));
}

function toggleSetting(key) {
  STATE.settings[key] = !STATE.settings[key];
  saveState(); applySettings(); renderSettings();
  if (key === 'extra') {
    fetchLongWeekends();
  }
}

function onSizeSlider(val) {
  STATE.settings.textSize = parseInt(val);
  document.getElementById('size-label').textContent = SIZE_LABELS[STATE.settings.textSize];
  saveState(); applySettings();
}

function setTheme(th) {
  STATE.settings.theme = th;
  saveState(); applySettings(); renderSettings();
}

function changeTimezone(val) {
  STATE.tz = parseFloat(val);
  saveState(); renderDateHeader();
  showToast('⏰ Timezone updated');
}

function resetData() {
  if (confirm('Clear all reminders? This cannot be undone.')) {
    STATE.reminders = [];
    saveState(); renderAll();
    showToast('🗑 Reminders cleared');
  }
}

function applySettings() {
  const s = STATE.settings;
  const body = document.body;
  const html = document.documentElement;
  // Remove all theme/size classes
  body.classList.remove('theme-light','theme-purple','dyslexic');
  SIZE_CLASSES.forEach(c => { body.classList.remove(c); html.classList.remove(c); });
  if (s.theme === 'light')  body.classList.add('theme-light');
  if (s.theme === 'purple') body.classList.add('theme-purple');
  if (s.dyslexic)           body.classList.add('dyslexic');
  if (s.simpleAnimations)   body.classList.add('simple-animations'); else body.classList.remove('simple-animations');
  body.classList.add(SIZE_CLASSES[s.textSize]);
  html.classList.add(SIZE_CLASSES[s.textSize]);
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
(function init() {
  generateStars();
  applySettings();

  // Pre-set TZ on welcome
  document.getElementById('tz-select').value = STATE.tz;

  // Close modal on backdrop click
  document.getElementById('modal-add').addEventListener('click', function(e) {
    if (e.target === this) closeModal('modal-add');
  });

  // Clock refresh
  setInterval(() => {
    if (document.getElementById('screen-main').classList.contains('active')) {
      renderDateHeader();
    }
  }, 30000);

  // Fetch long weekends if extra events enabled
  loadCachedApiData();
  fetchLongWeekends();
})();

