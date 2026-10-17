'use strict';

const STORAGE_KEY = 'extManagerViewPrefs';

const GEAR_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="3"></circle>' +
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';

const DEFAULT_PREFS = { columns: 'double', density: 'detail', filter: 'all', query: '' };

let state = { ...DEFAULT_PREFS };
let extensions = [];

init();

async function init() {
  state = { ...DEFAULT_PREFS, ...(await loadPrefs()) };
  document.getElementById('search').value = state.query;
  document.getElementById('filter').value = state.filter;
  bindEvents();
  applyViewClasses();
  await refresh();

  chrome.management.onEnabled.addListener(refresh);
  chrome.management.onDisabled.addListener(refresh);
  chrome.management.onInstalled.addListener(refresh);
  chrome.management.onUninstalled.addListener(refresh);
}

function loadPrefs() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (res) => resolve((res && res[STORAGE_KEY]) || {}));
  });
}

function savePrefs() {
  chrome.storage.sync.set({ [STORAGE_KEY]: state });
}

function bindEvents() {
  document.getElementById('search').addEventListener('input', (e) => {
    state.query = e.target.value;
    savePrefs();
    render();
  });

  document.getElementById('filter').addEventListener('change', (e) => {
    state.filter = e.target.value;
    savePrefs();
    render();
  });

  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state[btn.dataset.key] = btn.dataset.value;
      savePrefs();
      applyViewClasses();
    });
  });
}

function applyViewClasses() {
  const list = document.getElementById('list');
  list.classList.toggle('single', state.columns === 'single');
  list.classList.toggle('double', state.columns === 'double');
  list.classList.toggle('icon-only', state.density === 'icons');
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', state[btn.dataset.key] === btn.dataset.value);
  });
}

function getAllExtensions() {
  return new Promise((resolve) => {
    chrome.management.getAll((list) => {
      resolve(chrome.runtime.lastError ? [] : list || []);
    });
  });
}

async function refresh() {
  const all = await getAllExtensions();
  extensions = all.filter((e) => e.id !== chrome.runtime.id);
  render();
}

function render() {
  const listEl = document.getElementById('list');
  const shown = extensions
    .filter(matchesFilter)
    .sort(compareExtensions);
  listEl.innerHTML = '';

  if (!shown.length) {
    listEl.innerHTML = '<div class="empty">没有匹配的项目</div>';
  } else {
    shown.forEach((ext) => listEl.appendChild(buildItem(ext)));
  }

  const enabled = extensions.filter((e) => e.enabled).length;
  document.getElementById('counts').textContent =
    `显示 ${shown.length} / 共 ${extensions.length} · 已启用 ${enabled}`;
}

function matchesFilter(ext) {
  if (state.filter === 'extension' && ext.type !== 'extension') return false;
  if (state.filter === 'theme' && ext.type !== 'theme') return false;
  if (state.filter === 'app' && !String(ext.type).includes('app')) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = `${ext.name || ''} ${ext.description || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// 已启用的扩展自动置顶，同组内再按名称排序
function compareExtensions(a, b) {
  const ae = !!a.enabled;
  const be = !!b.enabled;
  if (ae !== be) return ae ? -1 : 1;
  return String(a.name).localeCompare(String(b.name), 'zh');
}

function buildItem(ext) {
  const item = document.createElement('div');
  item.className = 'item';
  item.title = [ext.name, ext.description, ext.disabledReason].filter(Boolean).join('\n');

  item.appendChild(buildIcon(ext));

  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = ext.name || '(未命名)';
  info.appendChild(name);
  if (ext.description) {
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = ext.description;
    info.appendChild(desc);
  }
  item.appendChild(info);

  item.appendChild(buildActions(ext));
  return item;
}

function buildIcon(ext) {
  const url = pickIcon(ext);
  if (!url) return makeFallbackIcon(ext.name);
  const img = document.createElement('img');
  img.className = 'icon';
  img.alt = '';
  img.src = url;
  img.addEventListener('error', () => img.replaceWith(makeFallbackIcon(ext.name)), { once: true });
  return img;
}

function pickIcon(ext) {
  const icons = ext.icons || [];
  if (!icons.length) return '';
  for (const s of [48, 32, 128, 64, 16]) {
    const hit = icons.find((i) => i.size === s);
    if (hit) return hit.url;
  }
  return icons.reduce((a, b) => (a.size > b.size ? a : b)).url;
}

function makeFallbackIcon(name) {
  const span = document.createElement('span');
  span.className = 'icon fallback';
  const label = (name || '?').trim();
  span.textContent = label ? label.charAt(0).toUpperCase() : '?';
  span.style.background = colorFor(label);
  return span;
}

function colorFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 55%, 52%)`;
}

function buildActions(ext) {
  const actions = document.createElement('div');
  actions.className = 'actions';

  const isApp = String(ext.type).includes('app');

  if (isApp) {
    const launch = document.createElement('button');
    launch.className = 'icon-btn';
    launch.title = '启动应用';
    launch.innerHTML = PLAY_SVG;
    launch.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.management.launchApp(ext.id);
    });
    actions.appendChild(launch);
  } else {
    if (ext.optionsUrl) {
      const settings = document.createElement('button');
      settings.className = 'icon-btn';
      settings.title = '打开设置';
      settings.innerHTML = GEAR_SVG;
      settings.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: ext.optionsUrl });
      });
      actions.appendChild(settings);
    }
    actions.appendChild(buildSwitch(ext));
  }

  return actions;
}

function buildSwitch(ext) {
  const canToggle = ext.mayDisable !== false;
  const label = document.createElement('label');
  label.className = 'switch';
  if (!canToggle) label.title = '此项目由策略或系统管理，无法禁用';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!ext.enabled;
  input.disabled = !canToggle;
  input.setAttribute('aria-label', `${ext.name} 开关`);
  input.addEventListener('change', () => toggleExtension(ext.id, input.checked));

  const slider = document.createElement('span');
  slider.className = 'slider';

  label.appendChild(input);
  label.appendChild(slider);
  return label;
}

function toggleExtension(id, enabled) {
  chrome.management.setEnabled(id, enabled, () => {
    if (chrome.runtime.lastError) {
      showToast(chrome.runtime.lastError.message || '操作失败');
      refresh();
    } else {
      showToast(enabled ? '已启用' : '已禁用');
    }
  });
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}
