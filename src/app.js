import { advanceTurn, createGame, exportNovel } from './engine.js';

const STORAGE_KEY = 'wendao-fusheng-save-v1';
const RANDOM_COMMANDS = [
  '闭关修炼三月，尝试突破',
  '前往后山探索灵脉',
  '找林师姐打听雾隐秘境的消息',
  '炼制一炉聚气丹',
  '挑战外门第十席',
  '拜见玄衡长老求取功法'
];

let game = loadGame();

const nodes = {
  playerName: document.querySelector('#playerName'),
  playerOrigin: document.querySelector('#playerOrigin'),
  hudResources: document.querySelector('#hudResources'),
  realm: document.querySelector('#realm'),
  spiritualRoot: document.querySelector('#spiritualRoot'),
  location: document.querySelector('#location'),
  meters: document.querySelector('#meters'),
  sectRelationLabel: document.querySelector('#sectRelationLabel'),
  sectRelationBar: document.querySelector('#sectRelationBar'),
  npcList: document.querySelector('#npcList'),
  gameDate: document.querySelector('#gameDate'),
  turnPill: document.querySelector('#turnPill'),
  logList: document.querySelector('#logList'),
  actionGrid: document.querySelector('#actionGrid'),
  timeline: document.querySelector('#timeline'),
  foreshadows: document.querySelector('#foreshadows'),
  commandForm: document.querySelector('#commandForm'),
  commandInput: document.querySelector('#commandInput'),
  saveBtn: document.querySelector('#saveBtn'),
  exportBtn: document.querySelector('#exportBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  sampleBtn: document.querySelector('#sampleBtn'),
  mockMode: document.querySelector('#mockMode'),
  apiMode: document.querySelector('#apiMode'),
  apiBanner: document.querySelector('#apiBanner'),
  worldMode: document.querySelector('#worldMode'),
  toast: document.querySelector('#toast')
};

render();

nodes.commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitCommand(nodes.commandInput.value);
});

nodes.actionGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-command]');
  if (!button) return;
  submitCommand(button.dataset.command);
});

nodes.saveBtn.addEventListener('click', () => {
  saveGame();
  showToast('存档已保存');
});

nodes.exportBtn.addEventListener('click', () => {
  const blob = new Blob([exportNovel(game)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `问道浮生-${game.player.name}-第${game.turn}回合.txt`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('已导出修仙人生');
});

nodes.resetBtn.addEventListener('click', () => {
  game = createGame(Date.now() % 10000);
  saveGame();
  render();
  showToast('新的一世已经开启');
});

nodes.sampleBtn.addEventListener('click', () => {
  const command = RANDOM_COMMANDS[(game.turn + game.seed) % RANDOM_COMMANDS.length];
  submitCommand(command);
});

nodes.mockMode.addEventListener('click', () => setMode('mock'));
nodes.apiMode.addEventListener('click', () => setMode('api'));

function submitCommand(command) {
  game = advanceTurn(game, command);
  nodes.commandInput.value = '';
  saveGame();
  render();
  nodes.logList.scrollTo({ top: nodes.logList.scrollHeight, behavior: 'smooth' });
}

function setMode(mode) {
  game = { ...game, mode };
  saveGame();
  render();
}

function render() {
  renderPlayer();
  renderNpcs();
  renderNarrative();
  renderWorld();
  renderMode();
}

function renderPlayer() {
  const { player } = game;
  nodes.playerName.textContent = player.name;
  nodes.playerOrigin.textContent = player.origin;
  nodes.realm.textContent = player.realm;
  nodes.spiritualRoot.textContent = player.spiritualRoot;
  nodes.location.textContent = player.location;
  nodes.sectRelationLabel.textContent = player.sectRelation;
  nodes.sectRelationBar.style.width = `${player.sectRelation}%`;

  nodes.hudResources.innerHTML = [
    ['境界', player.realm, '✦'],
    ['灵石', player.spiritStones, '◇'],
    ['灵气', player.qi, '气'],
    ['寿元', player.lifespan, '寿']
  ].map(([label, value, icon]) => `
    <div class="resource">
      <span>${icon}</span>
      <div><em>${label}</em><strong>${value}</strong></div>
    </div>
  `).join('');

  const meterRows = [
    ['灵气', player.qi, 'qi'],
    ['心境', player.mood, 'mood'],
    ['破境', player.cultivationProgress, 'progress'],
    ['灵石', player.spiritStones, 'stones'],
    ['寿元', player.lifespan, 'life']
  ];

  nodes.meters.innerHTML = meterRows.map(([label, value, key]) => {
    const percent = key === 'stones' ? Math.min(100, value / 2) : Math.min(100, value);
    return `
      <div class="meter-row">
        <div><span>${label}</span><strong>${value}</strong></div>
        <div class="bar ${key}"><span style="width:${percent}%"></span></div>
      </div>
    `;
  }).join('');
}

function renderNpcs() {
  nodes.npcList.innerHTML = game.npcs.map((npc) => `
    <article class="npc-card">
      <div>
        <strong>${npc.name}</strong>
        <span>${npc.role}</span>
      </div>
      <div class="affinity">${npc.affinity}</div>
    </article>
  `).join('');
}

function renderNarrative() {
  nodes.gameDate.textContent = formatDate(game.calendar);
  nodes.turnPill.textContent = `第 ${game.turn} 回合`;
  nodes.logList.innerHTML = game.log.slice(-5).reverse().map((entry) => `
    <article class="log-card">
      <div class="log-meta">
        <span>${entry.title}</span>
        <em>${entry.command}</em>
      </div>
      <p>${entry.body}</p>
      ${entry.npcLine ? `<blockquote>${entry.npcLine}</blockquote>` : ''}
      ${entry.worldEvent ? `<div class="event-chip">${entry.worldEvent}</div>` : ''}
    </article>
  `).join('');

  const actionCards = buildActionCards(game.suggestions);
  nodes.actionGrid.innerHTML = actionCards.map((card) => `
    <button class="action-card ${card.kind}" type="button" data-command="${escapeAttribute(card.command)}">
      <span class="action-icon">${card.icon}</span>
      <strong>${card.title}</strong>
      <em>${card.command}</em>
    </button>
  `).join('');
}

function renderWorld() {
  nodes.timeline.innerHTML = game.timeline.slice(-6).reverse().map((item) => `
    <article class="timeline-item">
      <span></span>
      <div>
        <strong>${item.title}</strong>
        <p>${item.detail}</p>
      </div>
    </article>
  `).join('');

  nodes.foreshadows.innerHTML = game.foreshadows.map((item) => `
    <div class="memory-card">${item}</div>
  `).join('');
}

function renderMode() {
  const isApi = game.mode === 'api';
  nodes.mockMode.classList.toggle('active', !isApi);
  nodes.apiMode.classList.toggle('active', isApi);
  nodes.apiBanner.hidden = !isApi;
  nodes.worldMode.textContent = isApi ? 'API 预留' : 'Mock 推演';
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : createGame(42);
  } catch {
    return createGame(42);
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
}

function showToast(message) {
  nodes.toast.textContent = message;
  nodes.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => nodes.toast.classList.remove('show'), 1800);
}

function formatDate(calendar) {
  return `玄历${calendar.year}年 ${calendar.season} 第${calendar.month}月`;
}

function escapeAttribute(value) {
  return value.replaceAll('"', '&quot;');
}

function buildActionCards(suggestions) {
  const fallback = [
    '闭关修炼三月，尝试突破',
    '找林师姐打听雾隐秘境的消息',
    '前往后山探索灵脉'
  ];
  const commands = [...suggestions, ...fallback].slice(0, 6);
  return commands.map((command) => {
    if (command.includes('炼') || command.includes('闭关') || command.includes('突破') || command.includes('稳固')) {
      return { command, title: '闭关修炼', icon: '息', kind: 'cultivate' };
    }
    if (command.includes('林师姐') || command.includes('长老') || command.includes('打听') || command.includes('请教')) {
      return { command, title: '拜会道友', icon: '友', kind: 'social' };
    }
    if (command.includes('丹') || command.includes('药')) {
      return { command, title: '丹炉开火', icon: '丹', kind: 'alchemy' };
    }
    if (command.includes('挑战') || command.includes('斗法') || command.includes('斩妖')) {
      return { command, title: '演武斗法', icon: '斗', kind: 'combat' };
    }
    return { command, title: '秘境游历', icon: '山', kind: 'explore' };
  });
}
