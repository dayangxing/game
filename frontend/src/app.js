import { createGameApi } from './api/gameApi.js';
import { getLayoutMode } from './ui/layoutModes.js';
import {
  getGuideStep,
  guideSteps,
  markGuideCompleted,
  shouldAutoOpenGuide
} from './ui/onboardingGuide.js';
import { createImmediateViewActions } from './ui/immediateViewActions.js';
import {
  createDefaultAllocation,
  formatAttributeCards,
  randomizeAllocation,
  remainingAllocationPoints,
  updateAllocation
} from './ui/characterCreation.js';
import { getView, viewList } from './ui/views.js';

const STORAGE_KEY = 'wendao-fusheng-frontend-save-v1';
const MODE_KEY = 'wendao-fusheng-mode-v1';
const HISTORY_SUMMARY_KEY = 'wendao-fusheng-history-summary-v1';
const HISTORY_SUMMARY_SCOPE_KEY = 'wendao-fusheng-history-summary-scope-v1';
const BACKEND_BASE_URL = window.WENDAO_API_BASE_URL ?? 'http://127.0.0.1:8787';
const RANDOM_COMMANDS = [
  '闭关修炼三月，尝试突破',
  '前往后山探索灵脉',
  '找林师姐打听雾隐秘境的消息',
  '炼制一炉聚气丹',
  '挑战外门第十席',
  '拜见玄衡长老求取功法'
];

const initialMode = localStorage.getItem(MODE_KEY) || 'api';
let startupNotice = '';
let actionRefreshSequence = 0;
let pendingApiImmediateActions = false;
let streamingNarration = null;
let highlightedHistoryEntryId = null;
let suppressNextHashChange = false;
let pendingCharacterSeed = Number(localStorage.getItem('wendao-fusheng-character-seed') ?? Date.now());
let pendingAttributes = createDefaultAllocation();
const api = createGameApi({
  seed: 42,
  baseUrl: BACKEND_BASE_URL,
  preferredMode: initialMode
});
const layoutMode = getLayoutMode();
let game = await loadGame();
let activeViewId = readInitialActiveViewId();
let dailyActions = await loadDailyActionsForGame(game, getView(activeViewId)).catch((error) => {
  startupNotice = apiErrorMessage(error);
  return createImmediateViewActions(game, getView(activeViewId));
});
let guideStepIndex = 0;

document.documentElement.dataset.layout = layoutMode.id;
document.body.classList.add(layoutMode.shellClass);

const nodes = {
  topTabs: document.querySelector('#topTabs'),
  viewTitle: document.querySelector('#viewTitle'),
  viewDescription: document.querySelector('#viewDescription'),
  gameDate: document.querySelector('#gameDate'),
  turnPill: document.querySelector('#turnPill'),
  logList: document.querySelector('#logList'),
  actionGrid: document.querySelector('#actionGrid'),
  activeViewContent: document.querySelector('#activeViewContent'),
  guideBtn: document.querySelector('#guideBtn'),
  guideOverlay: document.querySelector('#guideOverlay'),
  guideTitle: document.querySelector('#guideTitle'),
  guideBody: document.querySelector('#guideBody'),
  guideProgress: document.querySelector('#guideProgress'),
  guideNextBtn: document.querySelector('#guideNextBtn'),
  guideSkipBtn: document.querySelector('#guideSkipBtn'),
  saveBtn: document.querySelector('#saveBtn'),
  exportBtn: document.querySelector('#exportBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  sampleBtn: document.querySelector('#sampleBtn'),
  mockMode: document.querySelector('#mockMode'),
  apiMode: document.querySelector('#apiMode'),
  apiBanner: document.querySelector('#apiBanner'),
  worldMode: document.querySelector('#worldMode'),
  dashboardContent: document.querySelector('#dashboardContent'),
  onboardingPanel: document.querySelector('#onboardingPanel'),
  onboardingTitle: document.querySelector('#onboardingTitle'),
  onboardingBody: document.querySelector('#onboardingBody'),
  onboardingActionBtn: document.querySelector('#onboardingActionBtn'),
  characterPanel: document.querySelector('#characterPanel'),
  characterNameInput: document.querySelector('#characterNameInput'),
  remainingAttributePoints: document.querySelector('#remainingAttributePoints'),
  attributeAllocation: document.querySelector('#attributeAllocation'),
  characterRoll: document.querySelector('#characterRoll'),
  rerollCharacterBtn: document.querySelector('#rerollCharacterBtn'),
  startFormalGameBtn: document.querySelector('#startFormalGameBtn'),
  statusOverview: document.querySelector('#statusOverview'),
  attributeSummary: document.querySelector('#attributeSummary'),
  viewFocusTitle: document.querySelector('#viewFocusTitle'),
  viewFocusMeta: document.querySelector('#viewFocusMeta'),
  viewFocusBody: document.querySelector('#viewFocusBody'),
  toast: document.querySelector('#toast')
};

if (game.character?.attributes) {
  pendingAttributes = { ...game.character.attributes };
}

render();
if (startupNotice) showToast(startupNotice);
if (!startupNotice && shouldAutoOpenGuide(localStorage)) openGuide();

nodes.activeViewContent.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-command]');
  if (!button) return;
  const action = dailyActions.find((item) => item.id === button.dataset.actionId);
  if (!action) return;
  await submitDailyAction(action);
});

nodes.topTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (!button) return;
  setActiveView(button.dataset.view);
});

window.addEventListener('hashchange', () => {
  if (suppressNextHashChange) {
    suppressNextHashChange = false;
    return;
  }
  setActiveView(viewIdFromHash(), { updateHash: false });
});

nodes.guideBtn.addEventListener('click', () => openGuide());

nodes.guideNextBtn.addEventListener('click', () => {
  if (guideStepIndex >= guideSteps.length - 1) {
    completeGuide();
    return;
  }
  guideStepIndex += 1;
  renderGuide();
});

nodes.guideSkipBtn.addEventListener('click', () => completeGuide());

nodes.saveBtn.addEventListener('click', () => {
  saveGame();
  showToast(game.mode === 'api' ? '云端存档已落册' : '本地存档已落册');
});

nodes.exportBtn.addEventListener('click', async () => {
  try {
    downloadText(await api.exportStory(game), `问道浮生-${game.player.name}-第${game.turn}回合.txt`);
    showToast('传记已导出');
  } catch (error) {
    handleApiError(error);
  }
});

nodes.resetBtn.addEventListener('click', async () => {
  try {
    const freshGame = await api.createGame(game.mode);
    rotateHistorySummaryScope();
    const nextGame = hydrateHistorySummaries(freshGame);
    const nextActions = await loadDailyActionsForGame(nextGame, getView(activeViewId));
    actionRefreshSequence += 1;
    pendingApiImmediateActions = false;
    game = nextGame;
    dailyActions = nextActions;
    resetPendingCharacterPreview();
    saveGame();
    render();
    showToast(game.mode === 'api' ? '云端命途已重开' : '新的一世已经开启');
  } catch (error) {
    handleApiError(error);
  }
});

nodes.sampleBtn.addEventListener('click', async () => {
  if (!dailyActions.length && game.mode === 'api') {
    showToast('行动尚未入册，请切换页签重试');
    return;
  }
  const fallbackCommand = RANDOM_COMMANDS[(game.turn + game.seed) % RANDOM_COMMANDS.length];
  const action = dailyActions.length ? dailyActions[(game.turn + game.seed) % dailyActions.length] : {
    id: 'fallback-random',
    command: fallbackCommand
  };
  await submitDailyAction(action);
});

nodes.mockMode.addEventListener('click', () => setMode('mock'));
nodes.apiMode.addEventListener('click', () => setMode('api'));

nodes.onboardingActionBtn.addEventListener('click', async () => {
  try {
    const [action] = await api.getDailyActions(game, getView(activeViewId));
    await submitDailyAction(action);
  } catch (error) {
    handleApiError(error);
  }
});

nodes.characterNameInput.addEventListener('input', () => {
  renderPendingCharacterStatus();
});

nodes.attributeAllocation.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-key][data-delta]');
  if (!button) return;
  const key = button.dataset.key;
  const delta = Number(button.dataset.delta);
  pendingAttributes = updateAllocation(pendingAttributes, key, delta);
  renderPendingCharacterStatus();
});

nodes.rerollCharacterBtn.addEventListener('click', async () => {
  try {
    pendingCharacterSeed += 1;
    localStorage.setItem('wendao-fusheng-character-seed', String(pendingCharacterSeed));
    pendingAttributes = randomizeAllocation(pendingCharacterSeed);
    renderPendingCharacterStatus();
  } catch (error) {
    handleApiError(error);
  }
});

nodes.startFormalGameBtn.addEventListener('click', async () => {
  try {
    if (remainingAllocationPoints(pendingAttributes) !== 0) {
      showToast('请先分完全部天赋点。');
      return;
    }
    game = await api.createFormalGame({
      name: nodes.characterNameInput.value,
      rerollSeed: pendingCharacterSeed,
      attributes: pendingAttributes
    });
    rotateHistorySummaryScope();
    game = hydrateHistorySummaries(game);
    dailyActions = await loadDailyActionsForGame(game, getView(activeViewId));
    actionRefreshSequence += 1;
    pendingApiImmediateActions = false;
    saveGame();
    render();
  } catch (error) {
    handleApiError(error);
  }
});

async function submitDailyAction(action) {
  if (shouldBlockImmediateApiAction(action)) {
    showToast('行动尚在刷新，请稍候再试');
    return;
  }
  beginStreamingNarration(action);
  try {
    const previousGame = game;
    game = hydrateHistorySummaries(await api.submitDailyActionStream(game, action, {
      onNarrationPreview: updateStreamingNarration
    }));
    game = enrichGameHistory(game, previousGame);
    markHistoryRefreshed(game);
    persistHistorySummaryCache(game);
    saveGame();
    clearStreamingNarration();
    showImmediateActionsForView(activeViewId);
    refreshDailyActionsForView(activeViewId).catch(handleApiError);
    nodes.logList?.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    clearStreamingNarration();
    renderStory();
    handleApiError(error);
  }
}

async function setMode(mode) {
  try {
    const modeGame = await api.setMode(game, mode);
    rotateHistorySummaryScope();
    const nextGame = hydrateHistorySummaries(modeGame);
    const nextActions = await loadDailyActionsForGame(nextGame, getView(activeViewId));
    actionRefreshSequence += 1;
    pendingApiImmediateActions = false;
    game = nextGame;
    dailyActions = nextActions;
    if (game.character?.attributes) {
      pendingAttributes = { ...game.character.attributes };
    }
    saveGame();
    render();
    showToast(mode === 'api' ? '已转为云端存档' : '已转为本地存档');
  } catch (error) {
    handleApiError(error);
  }
}

function render() {
  renderFirstRunStage();
  renderTabs();
  renderStory({ refreshActiveView: false });
  renderActiveView(activeViewId);
  renderMode();
}

function renderFirstRunStage() {
  const needsOnboarding = game.onboarding && !game.onboarding.completed;
  const needsCharacter = shouldShowCharacterCreation(game);
  const onboardingStep = game.onboarding?.completed ? null : game.log.at(-1);

  nodes.onboardingPanel.hidden = !needsOnboarding;
  nodes.characterPanel.hidden = !needsCharacter;
  nodes.dashboardContent.hidden = needsOnboarding || needsCharacter;

  if (needsOnboarding && onboardingStep) {
    nodes.onboardingTitle.textContent = onboardingStep.title;
    nodes.onboardingBody.textContent = onboardingStep.body;
  }

  if (needsCharacter) {
    renderPendingCharacterStatus();
  }
}

function shouldShowCharacterCreation(game) {
  if (!game.onboarding?.completed) return false;
  if (!game.onboarding?.unlockedCharacterCreation) return false;
  return !game.characterSeed || !hasFormalCharacterData(game.character);
}

function hasFormalCharacterData(character) {
  if (!character) return false;
  if (!Array.isArray(character.traits) || character.traits.length < 2) return false;
  if (character.traits.includes('新手序章')) return false;
  return typeof character.initialLifespan === 'number'
    && typeof character.startingResources?.spiritStones === 'number'
    && typeof character.origin === 'string'
    && typeof character.spiritualRoot === 'string';
}

function renderPendingCharacterStatus() {
  const pendingName = String(nodes.characterNameInput?.value ?? '').trim() || '未定名';
  const cards = formatAttributeCards(pendingAttributes);
  const remaining = remainingAllocationPoints(pendingAttributes);
  const previewHealth = 80 + (pendingAttributes.rootBone * 8) + (pendingAttributes.lifeSeed * 2);
  const previewLifespan = 80 + (pendingAttributes.lifeSeed * 8);

  nodes.remainingAttributePoints.textContent = String(remaining);
  nodes.attributeAllocation.innerHTML = cards.map((card) => {
    const canLower = card.value > 1;
    const canRaise = remaining > 0 && card.value < 10;
    return `
      <article class="allocation-card">
        <div class="allocation-copy">
          <strong>${card.label}</strong>
          <p>${card.note}</p>
        </div>
        <div class="allocation-controls">
          <button type="button" data-key="${card.key}" data-delta="-1"${canLower ? '' : ' disabled'}>-</button>
          <span>${card.value}</span>
          <button type="button" data-key="${card.key}" data-delta="1"${canRaise ? '' : ' disabled'}>+</button>
        </div>
      </article>
    `;
  }).join('');

  nodes.characterRoll.innerHTML = [
    `<div class="attribute-row"><span>角色名</span><strong>${pendingName}</strong></div>`,
    `<div class="attribute-row"><span>预计气血</span><strong>${previewHealth}</strong></div>`,
    `<div class="attribute-row"><span>预计寿元</span><strong>${previewLifespan} 年</strong></div>`,
    ...cards.map((card) => `<div class="attribute-row"><span>${card.label}</span><strong>${card.value}</strong></div>`),
    '<p>入山门后会随机写定出身、灵根、命格与随身资源，天赋分配会直接影响气血、寿元与修行底色。</p>'
  ].join('');

  nodes.startFormalGameBtn.disabled = remaining !== 0;
}

function renderTabs() {
  const view = getView(activeViewId);
  nodes.viewTitle.textContent = view.title;
  nodes.viewDescription.textContent = view.description;

  nodes.topTabs.innerHTML = viewList.map((item) => `
    <button class="${item.id === view.id ? 'active' : ''}" type="button" data-view="${item.id}">${item.label}</button>
  `).join('');
}

function viewIdFromHash() {
  let hashViewId = '';
  try {
    hashViewId = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
  } catch {
    return 'home';
  }

  if (!hashViewId) return '';
  return resolveViewId(hashViewId);
}

function readInitialActiveViewId() {
  const hashViewId = viewIdFromHash();
  if (hashViewId) return hashViewId;
  return resolveViewId(localStorage.getItem('wendao-fusheng-active-view'));
}

function resolveViewId(viewId) {
  return viewList.some((view) => view.id === viewId) ? viewId : 'home';
}

function setActiveView(viewId, { updateHash = true } = {}) {
  const nextViewId = resolveViewId(viewId);
  activeViewId = nextViewId;
  localStorage.setItem('wendao-fusheng-active-view', activeViewId);

  if (updateHash && window.location.hash !== `#${activeViewId}`) {
    suppressNextHashChange = true;
    window.location.hash = `#${activeViewId}`;
  }

  showImmediateActionsForView(activeViewId);
  render();
  refreshDailyActionsForView(activeViewId).catch(handleApiError);
}

function renderStatusOverview() {
  const healthNow = game.player.health ?? game.player.maxHealth ?? 0;
  const healthMax = game.player.maxHealth ?? (healthNow || 1);
  const lifespanNow = game.player.lifespan ?? game.player.maxLifespan ?? 0;
  const lifespanMax = game.player.maxLifespan ?? (lifespanNow || 1);
  const sectRelation = game.player.sectRelation ?? 0;
  const cards = [
    {
      label: '气血',
      value: `${healthNow}/${healthMax}`,
      percent: Math.round((healthNow / Math.max(1, healthMax)) * 100),
      tone: 'health',
      note: healthNow <= Math.floor(healthMax * 0.4) ? '内息紊乱，宜先调养。' : '经脉尚稳，可继续推进。'
    },
    {
      label: '寿元',
      value: `${lifespanNow}/${lifespanMax}`,
      percent: Math.round((lifespanNow / Math.max(1, lifespanMax)) * 100),
      tone: 'lifespan',
      note: lifespanNow <= Math.floor(lifespanMax * 0.45) ? '命火渐弱，行事务必克制。' : '命火尚盛，仍有余地布局。'
    },
    {
      label: '境界',
      value: game.player.realm,
      percent: Math.min(100, game.player.cultivationProgress ?? 0),
      tone: 'realm',
      note: `当前破境进度 ${game.player.cultivationProgress ?? 0}%`
    },
    {
      label: '宗门声望',
      value: `${sectRelation}/100`,
      percent: Math.min(100, sectRelation),
      tone: 'sect',
      note: `所在 ${game.player.location}`
    }
  ];

  nodes.statusOverview.innerHTML = cards.map((card) => `
    <article class="status-card">
      <div class="status-card-head">
        <span>${card.label}</span>
        <strong>${card.value}</strong>
      </div>
      <div class="bar ${card.tone}"><i style="width:${card.percent}%"></i></div>
      <p>${card.note}</p>
    </article>
  `).join('');
}

function renderAttributeSummary() {
  const attributes = game.character?.attributes ?? pendingAttributes;
  nodes.attributeSummary.innerHTML = formatAttributeCards(attributes).map((card) => `
    <article class="summary-card">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <p>${card.note}</p>
    </article>
  `).join('');
}

function renderStory({ refreshActiveView = true } = {}) {
  nodes.gameDate.textContent = formatDate(game.calendar);
  nodes.turnPill.textContent = `第 ${game.turn} 回合`;
  if (refreshActiveView) renderActiveView(activeViewId);
}

function renderActiveView(viewId = activeViewId) {
  nodes.activeViewContent.dataset.activeView = viewId;
  switch (viewId) {
    case 'home':
      return renderHomeView();
    case 'cultivation':
      return renderCultivationView();
    case 'skills':
      return renderSkillsView();
    case 'realm':
      return renderRealmView();
    case 'bag':
      return renderBagView();
    default:
      return renderHomeView();
  }
}

function renderHomeView() {
  nodes.activeViewContent.innerHTML = [
    renderStatusPanel(),
    renderHistoryPanel(3),
    renderActionPanel(),
    renderFocusPanel()
  ].join('');

  syncActiveViewNodes();
  renderStatusOverview();
  renderAttributeSummary();
  renderHomeFocus();
}

function renderCultivationView() {
  nodes.activeViewContent.innerHTML = [
    renderStatusPanel(),
    renderCultivationFocusPanel()
  ].join('');

  syncActiveViewNodes();
  renderStatusOverview();
  renderAttributeSummary();
}

function renderSkillsView() {
  nodes.activeViewContent.innerHTML = [
    renderPersonalPanel()
  ].join('');

  syncActiveViewNodes();
}

function renderRealmView() {
  nodes.activeViewContent.innerHTML = [
    renderRealmCluePanel(),
    renderTimelinePanel(),
    renderForeshadowPanel()
  ].join('');

  syncActiveViewNodes();
}

function renderBagView() {
  nodes.activeViewContent.innerHTML = [
    renderTreasureCollectionPanel(),
    renderInventoryCollectionPanel()
  ].join('');

  syncActiveViewNodes();
}

function renderStatusPanel() {
  return renderPanel({
    className: 'stage-status',
    title: '命途状态',
    meta: '当前气象',
    body: `
      <div class="status-overview" id="statusOverview"></div>
      <div class="attribute-summary" id="attributeSummary"></div>
    `
  });
}

function renderFocusPanel() {
  return `
    <section class="paper-card action-note">
      <div class="section-title">
        <h3 id="viewFocusTitle">当前见闻</h3>
        <span id="viewFocusMeta">命簿摘录</span>
      </div>
      <div id="viewFocusBody"></div>
    </section>
  `;
}

function renderCultivationFocusPanel() {
  return renderPanel({
    className: 'action-note cultivation-focus',
    title: '闭关要点',
    meta: '修行重心',
    body: [
      `<article class="focus-card"><strong>当前瓶颈</strong><p>${summarizeCultivationFocus()}</p></article>`,
      `<article class="focus-card"><strong>近期建议</strong><p>${buildSuggestionText()}</p></article>`
    ].join('')
  });
}

function renderPersonalPanel() {
  return `
    <section class="paper-card personal-panel">
      <div class="personal-sheet">
        <header class="personal-sheet-header">
          <div>
            <span>修士档案</span>
            <h3>个人面板</h3>
          </div>
          <strong>${game.player.realm}</strong>
        </header>
        <div class="personal-left">
          ${renderPersonalProfileSection()}
          ${renderPersonalSectSection()}
        </div>
        <div class="personal-sections">
          ${renderPersonalAttributeSection()}
          ${renderPersonalStatusSection()}
          ${renderPersonalRelationshipSection()}
          ${renderPersonalTechniqueSection()}
        </div>
      </div>
    </section>
  `;
}

function renderPersonalProfileSection() {
  const { player } = game;
  const traits = (game.character?.traits ?? []).join('、') || '命格未定';
  return `
    <section class="personal-section personal-profile-section">
      <div class="personal-portrait">${player.name.slice(0, 1)}</div>
      <div class="personal-nameplate">
        <span>人物</span>
        <strong>${player.name}</strong>
        <em>${player.origin}</em>
      </div>
      <div class="personal-line-list">
        <div class="state-row"><span>灵根</span><strong>${player.spiritualRoot}</strong></div>
        <div class="state-row"><span>所在</span><strong>${player.location}</strong></div>
        <div class="state-row"><span>命格</span><strong>${traits}</strong></div>
      </div>
    </section>
  `;
}

function renderPersonalSectSection() {
  const sect = game.sect ?? { name: '青云宗', contribution: game.player.sectRelation ?? 0, rank: '外门弟子' };
  return `
    <section class="personal-section personal-sect-section">
      <div class="personal-section-title">
        <h4>宗门</h4>
        <span>${sect.name}</span>
      </div>
      <div class="personal-line-list">
        <div class="state-row"><span>身份</span><strong>${sect.rank}</strong></div>
        <div class="state-row"><span>声望</span><strong>${game.player.sectRelation ?? 0}/100</strong></div>
        <div class="state-row"><span>贡献</span><strong>${sect.contribution ?? game.player.sectRelation ?? 0}</strong></div>
      </div>
    </section>
  `;
}

function renderPersonalAttributeSection() {
  const attributes = game.character?.attributes ?? pendingAttributes;
  return `
    <section class="personal-section personal-attribute-section">
      <div class="personal-section-title">
        <h4>五维</h4>
        <span>天赋根基</span>
      </div>
      <div class="personal-attribute-grid">
        ${formatAttributeCards(attributes).map((card) => `
          <article>
            <span>${card.label}</span>
            <strong>${card.value}</strong>
            <em>${card.note}</em>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPersonalStatusSection() {
  const healthNow = game.player.health ?? game.player.maxHealth ?? 0;
  const healthMax = game.player.maxHealth ?? healthNow;
  const lifespanNow = game.player.lifespan ?? game.player.maxLifespan ?? 0;
  const lifespanMax = game.player.maxLifespan ?? lifespanNow;
  const statusRows = [
    ['气血', `${healthNow}/${healthMax}`],
    ['寿元', `${lifespanNow}/${lifespanMax}`],
    ['灵气', game.player.qi ?? 0],
    ['心境', game.player.mood ?? 0],
    ['破境', `${game.player.cultivationProgress ?? 0}%`],
    ['灵石', game.player.spiritStones ?? 0]
  ];

  return `
    <section class="personal-section personal-status-section">
      <div class="personal-section-title">
        <h4>生命与修行</h4>
        <span>气血与寿元</span>
      </div>
      <div class="personal-status-grid">
        ${statusRows.map(([label, value]) => `
          <div class="state-row"><span>${label}</span><strong>${value}</strong></div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPersonalRelationshipSection() {
  const npcCards = Array.isArray(game.npcs)
    ? game.npcs.map((npc) => `
      <article>
        <div>
          <strong>${npc.name}</strong>
          <span>${npc.role}</span>
        </div>
        <b>${npc.affinity}</b>
      </article>
    `).join('')
    : '';

  return `
    <section class="personal-section personal-relationship-section">
      <div class="personal-section-title">
        <h4>道友牵绊</h4>
        <span>${game.npcs?.length ?? 0} 人</span>
      </div>
      <div class="personal-relation-list">
        ${npcCards || '<div class="empty-collection">暂未结下新的道友牵绊。</div>'}
      </div>
    </section>
  `;
}

function renderPersonalTechniqueSection() {
  const techniques = game.techniques ?? [];
  return `
    <section class="personal-section personal-technique-section">
      <div class="personal-section-title">
        <h4>已修功法</h4>
        <span>${techniques.length} 门</span>
      </div>
      <div class="personal-technique-list">
        ${techniques.length
          ? game.techniques.map((technique) => `
            <article>
              <strong>${technique.name}</strong>
              <span>${technique.badge ?? technique.grade ?? technique.type ?? '功法'}</span>
              <p>${technique.description}</p>
              ${technique.detail ? `<em>${technique.detail}</em>` : ''}
            </article>
          `).join('')
          : '<div class="empty-collection">尚未习得新的功法。</div>'}
      </div>
    </section>
  `;
}

function renderCharacterProfilePanel() {
  const { player } = game;
  const traits = (game.character?.traits ?? []).join('、') || '命格未定';
  return renderPanel({
    className: 'character-profile',
    title: '角色总览',
    meta: player.origin ?? '求道者',
    body: `
      <div class="profile-head">
        <div class="avatar compact-avatar">${player.name.slice(0, 1)}</div>
        <div>
          <strong>${player.name}</strong>
          <span>${player.spiritualRoot} · ${player.realm}</span>
        </div>
      </div>
      <div class="profile-grid">
        <div class="state-row"><span>所在</span><strong>${player.location}</strong></div>
        <div class="state-row"><span>出身</span><strong>${player.origin}</strong></div>
        <div class="state-row"><span>命格</span><strong>${traits}</strong></div>
        <div class="state-row"><span>灵石</span><strong>${player.spiritStones ?? 0}</strong></div>
      </div>
      ${renderMeterRows()}
    `
  });
}

function renderMeterRows() {
  const meters = [
    ['灵气', game.player.qi ?? 0, 'qi'],
    ['心境', game.player.mood ?? 0, 'mood'],
    ['破境', game.player.cultivationProgress ?? 0, 'progress'],
    ['灵石', game.player.spiritStones ?? 0, 'stones']
  ];

  return `
    <div class="profile-meter-grid">
      ${meters.map(([label, value, kind]) => {
        const percent = kind === 'stones' ? Math.min(100, value / 2) : Math.min(100, value);
        return `
          <div class="meter-row">
            <div><span>${label}</span><strong>${value}</strong></div>
            <div class="bar ${kind}"><i style="width:${percent}%"></i></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderResourceLedgerPanel() {
  return renderPanel({
    className: 'resource-grid resource-ledger',
    title: '资源与门派',
    meta: '随身底蕴',
    body: `
      <section>
        <h4>气血与寿元</h4>
        ${renderHealthState()}
      </section>
      <section>
        <h4>因果</h4>
        ${renderKarmaState()}
      </section>
      <section>
        <h4>门派</h4>
        ${renderSectState()}
      </section>
      <section>
        <h4>丹药与材料</h4>
        ${renderInventoryState()}
      </section>
    `
  });
}

function renderRelationshipPanel() {
  const npcCards = Array.isArray(game.npcs)
    ? game.npcs.map((npc) => `
      <article class="npc-card">
        <div>
          <strong>${npc.name}</strong>
          <span>${npc.role}</span>
        </div>
        <b>${npc.affinity}</b>
      </article>
    `)
    : [];

  return renderPanel({
    className: 'relationship-section',
    title: '道友牵绊',
    meta: `${npcCards.length} 人`,
    body: npcCards.length
      ? `<div class="npc-list state-npc-list">${npcCards.join('')}</div>`
      : '<div class="empty-collection">暂未结下新的道友牵绊。</div>'
  });
}

function renderTechniqueCollectionPanel() {
  return renderPanel({
    className: 'collection-section',
    title: '已得功法',
    meta: `${game.techniques?.length ?? 0} 门已入册`,
    body: renderCollectionCards(game.techniques, '尚未习得新的功法。')
  });
}

function renderTechniqueAdvicePanel() {
  return renderPanel({
    className: 'action-note technique-advice',
    title: '修习节奏',
    meta: '心法取舍',
    body: renderTrainingAdvice()
  });
}

function renderTreasureCollectionPanel() {
  return renderPanel({
    className: 'collection-section',
    title: '奇珍法器',
    meta: `${game.treasures?.length ?? 0} 件入囊`,
    body: renderCollectionCards(game.treasures, '暂无奇珍入囊。')
  });
}

function renderInventoryCollectionPanel() {
  return renderPanel({
    className: 'collection-section',
    title: '丹药与材料',
    meta: `${countInventoryStacks(game.inventory)} 类存货`,
    body: renderCollectionCards(buildInventoryCollection(game.inventory), '行囊里仍空空如也。')
  });
}

function renderRealmCluePanel() {
  const latestEvent = game.timeline.at(-1)?.detail ?? '山门今日平静无波。';
  const foreshadowSummary = (game.foreshadows ?? []).slice(-2).join(' ') || '尚无新的征兆。';
  return renderPanel({
    className: 'action-note realm-clues',
    title: '秘境线索',
    meta: `${game.foreshadows?.length ?? 0} 条伏笔`,
    body: [
      `<article class="focus-card"><strong>最新异动</strong><p>${latestEvent}</p></article>`,
      `<article class="focus-card"><strong>未明征兆</strong><p>${foreshadowSummary}</p></article>`
    ].join('')
  });
}

function renderTimelinePanel() {
  const events = game.timeline.slice(-6).reverse();
  return renderPanel({
    className: 'story-section timeline-section',
    title: '天机事件',
    meta: '近六件',
    body: events.length
      ? `
        <div class="timeline-list">
          ${events.map((item) => `
            <article class="timeline-item">
              <i></i>
              <div><strong>${item.title}</strong><p>${item.detail}</p></div>
            </article>
          `).join('')}
        </div>
      `
      : '<div class="empty-collection">暂未记下新的天机事件。</div>'
  });
}

function renderForeshadowPanel() {
  const foreshadows = game.foreshadows ?? [];
  return renderPanel({
    className: 'story-section foreshadow-section',
    title: '长期伏笔',
    meta: `${foreshadows.length} 条`,
    body: foreshadows.length
      ? `
        <div class="foreshadow-list">
          ${foreshadows.map((item) => `<article>${item}</article>`).join('')}
        </div>
      `
      : '<div class="empty-collection">命簿尚未浮现新的远兆。</div>'
  });
}

function syncActiveViewNodes() {
  const root = nodes.activeViewContent;
  nodes.statusOverview = root.querySelector('#statusOverview');
  nodes.attributeSummary = root.querySelector('#attributeSummary');
  nodes.actionGrid = root.querySelector('#actionGrid');
  nodes.logList = root.querySelector('#logList');
  nodes.viewFocusTitle = root.querySelector('#viewFocusTitle');
  nodes.viewFocusMeta = root.querySelector('#viewFocusMeta');
  nodes.viewFocusBody = root.querySelector('#viewFocusBody');
}

function renderPanel({ className = '', title, meta, body }) {
  return `
    <section class="paper-card ${className}">
      ${renderSectionTitle(title, meta)}
      ${body}
    </section>
  `;
}

function renderSectionTitle(title, meta) {
  return `
    <div class="section-title">
      <h3>${title}</h3>
      <span>${meta}</span>
    </div>
  `;
}

function renderActionPanel({ title = '今日修行', meta = '每日行动' } = {}) {
  return renderPanel({
    className: 'action-section',
    title,
    meta,
    body: `
      <div class="action-grid" id="actionGrid">
        ${buildActionCards(dailyActions).map((card) => `
          <button class="action-card ${card.kind}" type="button" data-action-id="${escapeAttribute(card.id)}" data-command="${escapeAttribute(card.command)}"${card.disabled ? ' disabled aria-disabled="true"' : ''}>
            <b>${card.icon}</b>
            <span>${card.title}</span>
            <strong>${card.command}</strong>
            <em>${card.meta}</em>
          </button>
        `).join('')}
      </div>
    `
  });
}

function renderHistoryPanel(limit = 5) {
  return renderPanel({
    className: 'story-section',
    title: '历史行为',
    meta: `最近${limit}回合`,
    body: `
      <div class="log-list" id="logList">
        ${buildRecentHistory(limit).map((entry) => `
          <article class="${historyCardClass(entry)}">
            <header><strong>${entry.title}</strong><span>${entry.command}</span></header>
            <p>${entry.body}</p>
            ${entry.effectsSummary ? `<div class="effects-summary">${formatHistoryEffectSummary(entry)}</div>` : ''}
            ${entry.npcLine ? `<blockquote>${entry.npcLine}</blockquote>` : ''}
            ${entry.worldEvent ? `<em>${entry.worldEvent}</em>` : ''}
          </article>
        `).join('')}
      </div>
    `
  });
}

function buildRecentHistory(limit = 5) {
  const entries = game.log.slice(-limit).reverse();
  return streamingNarration ? [streamingNarration, ...entries] : entries;
}

function historyCardClass(entry) {
  if (entry.streaming) return 'log-card streaming is-new';
  return entry.id === highlightedHistoryEntryId ? 'log-card is-new' : 'log-card';
}

function beginStreamingNarration(action) {
  streamingNarration = {
    id: 'streaming-narration',
    streaming: true,
    title: '剧情续写中',
    command: action.title ?? action.command ?? '今日行动',
    body: '云笺已启，正在接续本回合见闻。'
  };
  renderStory();
}

function updateStreamingNarration(preview) {
  const body = String(preview ?? '').trim();
  if (!streamingNarration || !body) return;
  streamingNarration = {
    ...streamingNarration,
    body
  };
  renderStory();
}

function clearStreamingNarration() {
  streamingNarration = null;
}

function markHistoryRefreshed(targetGame) {
  highlightedHistoryEntryId = targetGame.log.at(-1)?.id ?? null;
}

function formatHistoryEffectSummary(entry) {
  const lines = normalizeEffectSummary(entry.effectsSummary);
  return lines.map((line) => `<span>${line}</span>`).join('');
}

function normalizeEffectSummary(effectsSummary) {
  if (Array.isArray(effectsSummary)) {
    return effectsSummary
      .map((line) => String(line ?? '').trim())
      .filter(Boolean);
  }

  const line = String(effectsSummary ?? '').trim();
  return line ? [line] : [];
}

function renderHomeFocus() {
  nodes.viewFocusTitle.textContent = '当前见闻';
  nodes.viewFocusMeta.textContent = '命簿摘录';
  nodes.viewFocusBody.innerHTML = [
    `<article class="focus-card"><strong>今日重心</strong><p>${buildSuggestionText()}</p></article>`,
    `<article class="focus-card"><strong>最近风声</strong><p>${game.worldEvents?.at(-1)?.detail ?? '山门风平浪静，正宜养息。'}</p></article>`
  ].join('');
}

function renderViewFocus(focusViewId = activeViewId) {
  if (focusViewId === 'bag') {
    nodes.viewFocusTitle.textContent = '行囊见闻';
    nodes.viewFocusMeta.textContent = `${(game.treasures?.length ?? 0) + countInventoryStacks(game.inventory)} 项收藏`;
    nodes.viewFocusBody.innerHTML = [
      `<section><h4>奇珍法器</h4>${renderCollectionCards(game.treasures, '暂无奇珍入囊。')}</section>`,
      `<section><h4>丹药与材料</h4>${renderCollectionCards(buildInventoryCollection(game.inventory), '行囊里仍空空如也。')}</section>`
    ].join('');
    return;
  }

  if (focusViewId === 'skills') {
    nodes.viewFocusTitle.textContent = '功法心得';
    nodes.viewFocusMeta.textContent = `${game.techniques?.length ?? 0} 门已入册`;
    nodes.viewFocusBody.innerHTML = [
      `<section><h4>已得功法</h4>${renderCollectionCards(game.techniques, '尚未习得新的功法。')}</section>`,
      renderTrainingAdvice()
    ].join('');
    return;
  }

  if (focusViewId === 'cultivation') {
    nodes.viewFocusTitle.textContent = '闭关要点';
    nodes.viewFocusMeta.textContent = '修行重心';
    nodes.viewFocusBody.innerHTML = [
      `<article class="focus-card"><strong>当前瓶颈</strong><p>${summarizeCultivationFocus()}</p></article>`,
      `<article class="focus-card"><strong>近期建议</strong><p>${buildSuggestionText()}</p></article>`
    ].join('');
    return;
  }

  if (focusViewId === 'realm') {
    nodes.viewFocusTitle.textContent = '秘境线索';
    nodes.viewFocusMeta.textContent = `${game.foreshadows?.length ?? 0} 条伏笔`;
    nodes.viewFocusBody.innerHTML = [
      `<article class="focus-card"><strong>最新异动</strong><p>${game.timeline.at(-1)?.detail ?? '山门今日平静无波。'}</p></article>`,
      `<article class="focus-card"><strong>未明征兆</strong><p>${(game.foreshadows ?? []).slice(-2).join(' ') || '尚无新的征兆。'}</p></article>`
    ].join('');
    return;
  }

  renderHomeFocus();
}

function renderCollectionCards(items, emptyCopy) {
  if (!items?.length) {
    return `<div class="empty-collection">${emptyCopy}</div>`;
  }

  return `
    <div class="collection-grid">
      ${items.map((item) => `
        <article class="collection-card">
          <div class="collection-card-head">
            <strong>${item.name}</strong>
            <span>${item.badge ?? item.rarity ?? item.grade ?? item.type ?? '所得'}</span>
          </div>
          <p>${item.description}</p>
          ${item.detail ? `<em>${item.detail}</em>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function renderTrainingAdvice() {
  const topTraits = (game.character?.traits ?? []).slice(0, 2).join('、') || '心法未定';
  return `<article class="focus-card"><strong>修习节奏</strong><p>命格偏向 ${topTraits}，宜先稳固根基，再挑一门主修功法深入打磨。</p></article>`;
}

function summarizeCultivationFocus() {
  const progress = game.player.cultivationProgress ?? 0;
  if (progress >= 80) return '破境机缘已近，先稳住气血与寿元，再择机冲关。';
  if (progress >= 40) return '修为正在积累，适合闭关与请教并行，逐步补齐短板。';
  return '境界尚浅，先养好灵气与心境，少做消耗过大的冒险。';
}

function buildSuggestionText() {
  return (game.suggestions ?? []).slice(0, 2).join('；') || '今日不妨先静坐调息，再看局势。';
}

function renderMode() {
  const isApi = game.mode === 'api';
  nodes.mockMode.classList.toggle('active', !isApi);
  nodes.apiMode.classList.toggle('active', isApi);
  nodes.apiBanner.hidden = !isApi;
  nodes.worldMode.textContent = isApi ? '云端存档' : '本地存档';
}

function openGuide() {
  guideStepIndex = 0;
  nodes.guideOverlay.hidden = false;
  renderGuide();
}

function renderGuide() {
  const step = getGuideStep(guideStepIndex);
  nodes.guideTitle.textContent = step.title;
  nodes.guideBody.textContent = step.body;
  nodes.guideProgress.innerHTML = guideSteps.map((item, index) => `
    <span class="${index === guideStepIndex ? 'active' : ''}" aria-label="${item.title}"></span>
  `).join('');
  nodes.guideNextBtn.textContent = guideStepIndex === guideSteps.length - 1 ? '开始修行' : '下一步';
}

function completeGuide() {
  markGuideCompleted(localStorage);
  nodes.guideOverlay.hidden = true;
}

async function loadGame() {
  const savedMode = localStorage.getItem(MODE_KEY) || initialMode;
  if (savedMode === 'api') {
    try {
      return hydrateHistorySummaries(await api.createGame('api'));
    } catch (error) {
      startupNotice = `云端暂不可用，已转为本地存档：${apiErrorMessage(error)}`;
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? hydrateHistorySummaries({ ...JSON.parse(raw), mode: 'mock' })
      : hydrateHistorySummaries(await api.createGame('mock'));
  } catch {
    return hydrateHistorySummaries(await api.createGame('mock'));
  }
}

async function loadDailyActionsForGame(targetGame, targetView) {
  return api.getDailyActions(targetGame, targetView);
}

async function refreshDailyActionsForView(viewId) {
  const requestId = ++actionRefreshSequence;
  const requestGame = game;
  const requestView = getView(viewId);
  const nextActions = await loadDailyActionsForGame(requestGame, requestView);

  if (
    requestId !== actionRefreshSequence ||
    activeViewId !== requestView.id ||
    !isSameGameSnapshot(game, requestGame)
  ) {
    return false;
  }

  pendingApiImmediateActions = false;
  dailyActions = nextActions;
  render();
  return true;
}

function showImmediateActionsForView(viewId) {
  pendingApiImmediateActions = game.mode === 'api';
  dailyActions = createImmediateViewActions(game, getView(viewId));
  render();
}

function isSameGameSnapshot(current, snapshot) {
  return current.turn === snapshot.turn && current.version === snapshot.version;
}

function saveGame() {
  persistHistorySummaryCache(game);
  localStorage.setItem(MODE_KEY, game.mode);
  if (game.mode === 'mock') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }
}

function showToast(message) {
  nodes.toast.textContent = message;
  nodes.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => nodes.toast.classList.remove('show'), 1800);
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(calendar) {
  return `玄历${calendar.year}年 ${calendar.season} 第${calendar.month}月`;
}

function escapeAttribute(value) {
  return String(value ?? '').replaceAll('"', '&quot;');
}

function renderHealthState() {
  const healthNow = game.player.health ?? game.player.maxHealth ?? 0;
  const healthMax = game.player.maxHealth ?? healthNow;
  const lifespanNow = game.player.lifespan ?? game.player.maxLifespan ?? 0;
  const lifespanMax = game.player.maxLifespan ?? lifespanNow;
  return [
    `<div class="state-row"><span>气血</span><strong>${healthNow}/${healthMax}</strong></div>`,
    `<div class="state-row"><span>寿元</span><strong>${lifespanNow}/${lifespanMax}</strong></div>`
  ].join('');
}

function renderKarmaState() {
  const karma = game.karma ?? { karma: 0, evil: 0, futureEventFlags: [] };
  return `
    <div class="state-row"><span>善缘</span><strong>${karma.karma ?? 0}</strong></div>
    <div class="state-row"><span>业力</span><strong>${karma.evil ?? 0}</strong></div>
    <div class="state-row"><span>伏笔</span><strong>${karma.futureEventFlags?.length ?? 0}</strong></div>
  `;
}

function renderInventoryState() {
  const inventory = game.inventory ?? { materials: {}, pills: {} };
  const materials = Object.entries(inventory.materials ?? {}).map(([name, count]) => `${name} x${count}`).join('、') || '无';
  const pills = Object.entries(inventory.pills ?? {}).map(([name, count]) => `${name} x${count}`).join('、') || '无';
  return `
    <div class="state-row"><span>材料</span><strong>${materials}</strong></div>
    <div class="state-row"><span>丹药</span><strong>${pills}</strong></div>
  `;
}

function renderSectState() {
  const sect = game.sect ?? { name: '青云宗', contribution: game.player.sectRelation ?? 0, rank: '外门弟子' };
  return `
    <div class="state-row"><span>宗门</span><strong>${sect.name}</strong></div>
    <div class="state-row"><span>身份</span><strong>${sect.rank}</strong></div>
    <div class="state-row"><span>贡献</span><strong>${sect.contribution ?? game.player.sectRelation ?? 0}</strong></div>
  `;
}

function buildActionCards(actions) {
  return actions.map((action) => ({
    ...action,
    icon: displayActionIcon(action),
    meta: formatActionMeta(action),
    kind: kindForCommand(action.command),
    disabled: shouldBlockImmediateApiAction(action)
  })).slice(0, 6);
}

function formatActionMeta(action) {
  const titleMeta = firstReadableMetaPart(action.meta);
  const riskMeta = riskLabel(action.risk);
  return [titleMeta, riskMeta].filter(Boolean).join(' · ') || '今日抉择';
}

function firstReadableMetaPart(meta) {
  return String(meta ?? '')
    .split('/')
    .map((part) => part.trim())
    .find((part) => part && !['low', 'medium', 'high'].includes(part.toLowerCase())) ?? '';
}

function riskLabel(risk) {
  return {
    low: '平稳',
    medium: '谨慎',
    high: '凶险'
  }[String(risk ?? '').toLowerCase()] ?? '';
}

function displayActionIcon(action) {
  const icon = String(action.icon ?? '').trim();
  const categoryIcon = {
    c: '修',
    e: '丹',
    h: '契',
    k: '缘',
    r: '境',
    s: '宗'
  }[icon.toLowerCase()];
  return action.source === 'event' && categoryIcon ? categoryIcon : icon || '行';
}

function shouldBlockImmediateApiAction(action) {
  return game.mode === 'api' && pendingApiImmediateActions && action.source === 'immediate';
}

function createHistorySummaryScopeId() {
  return `history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getHistorySummaryScopeId(storage = localStorage) {
  const existingScopeId = storage?.getItem?.(HISTORY_SUMMARY_SCOPE_KEY);
  if (existingScopeId) return existingScopeId;

  const nextScopeId = createHistorySummaryScopeId();
  storage?.setItem?.(HISTORY_SUMMARY_SCOPE_KEY, nextScopeId);
  return nextScopeId;
}

function rotateHistorySummaryScope(storage = localStorage) {
  const nextScopeId = createHistorySummaryScopeId();
  storage?.setItem?.(HISTORY_SUMMARY_SCOPE_KEY, nextScopeId);
  storage?.setItem?.(HISTORY_SUMMARY_KEY, JSON.stringify({
    scopeId: nextScopeId,
    entries: {}
  }));
  return nextScopeId;
}

function historyEntryCacheKey(entry = {}) {
  return JSON.stringify({
    id: entry.id ?? '',
    title: entry.title ?? '',
    command: entry.command ?? '',
    body: entry.body ?? '',
    worldEvent: entry.worldEvent ?? ''
  });
}

function readHistorySummaryCache(storage = localStorage) {
  try {
    const scopeId = getHistorySummaryScopeId(storage);
    const raw = storage?.getItem?.(HISTORY_SUMMARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    if (parsed.scopeId !== scopeId) return {};
    return parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
  } catch {
    return {};
  }
}

function persistHistorySummaryCache(targetGame, storage = localStorage) {
  if (!storage?.setItem || !targetGame?.log?.length) return {};

  const scopeId = getHistorySummaryScopeId(storage);
  const nextCache = { ...readHistorySummaryCache(storage) };
  for (const entry of targetGame.log) {
    const lines = normalizeEffectSummary(entry.effectsSummary);
    if (!lines.length) continue;
    nextCache[historyEntryCacheKey(entry)] = lines;
  }

  storage.setItem(HISTORY_SUMMARY_KEY, JSON.stringify({
    scopeId,
    entries: nextCache
  }));
  return nextCache;
}

function hydrateHistorySummaries(targetGame, storage = localStorage) {
  if (!targetGame?.log?.length) return targetGame;

  const cache = readHistorySummaryCache(storage);
  if (!Object.keys(cache).length) return targetGame;

  return {
    ...targetGame,
    log: targetGame.log.map((entry) => {
      const existing = normalizeEffectSummary(entry.effectsSummary);
      if (existing.length) {
        return { ...entry, effectsSummary: existing };
      }

      const cached = normalizeEffectSummary(cache[historyEntryCacheKey(entry)]);
      return cached.length ? { ...entry, effectsSummary: cached } : entry;
    })
  };
}

function enrichGameHistory(currentGame, previousGame) {
  if (!currentGame?.log?.length) return currentGame;

  const latestEntry = currentGame.log.at(-1);
  const effectsSummary = summarizeHistoryChanges(previousGame, currentGame);
  if (!effectsSummary.length) return currentGame;

  return {
    ...currentGame,
    log: [
      ...currentGame.log.slice(0, -1),
      {
        ...latestEntry,
        effectsSummary
      }
    ]
  };
}

function summarizeHistoryChanges(previousGame, currentGame) {
  const changes = [];
  changes.push(...summarizePlayerChanges(previousGame?.player, currentGame?.player));
  changes.push(...summarizeInventoryChanges(previousGame?.inventory, currentGame?.inventory));
  changes.push(...summarizeCollectionChanges(previousGame?.treasures, currentGame?.treasures, '获珍'));
  changes.push(...summarizeCollectionChanges(previousGame?.techniques, currentGame?.techniques, '习得'));

  if ((previousGame?.player?.realm ?? '') !== (currentGame?.player?.realm ?? '')) {
    changes.push(`境界稳入 ${currentGame.player.realm}`);
  }
  if ((previousGame?.player?.location ?? '') !== (currentGame?.player?.location ?? '')) {
    changes.push(`行止转到 ${currentGame.player.location}`);
  }

  return changes.slice(0, 5);
}

function summarizePlayerChanges(previousPlayer = {}, currentPlayer = {}) {
  return [
    describeDelta('气血', currentPlayer.health, previousPlayer.health),
    describeDelta('寿元', currentPlayer.lifespan, previousPlayer.lifespan),
    describeDelta('灵气', currentPlayer.qi, previousPlayer.qi),
    describeDelta('心境', currentPlayer.mood, previousPlayer.mood),
    describeDelta('修为', currentPlayer.cultivationProgress, previousPlayer.cultivationProgress),
    describeDelta('灵石', currentPlayer.spiritStones, previousPlayer.spiritStones),
    describeDelta('宗门声望', currentPlayer.sectRelation, previousPlayer.sectRelation)
  ].filter(Boolean);
}

function describeDelta(label, nextValue, previousValue) {
  if (!Number.isFinite(nextValue) || !Number.isFinite(previousValue)) return '';
  const delta = nextValue - previousValue;
  if (!delta) return '';
  const prefix = delta > 0 ? '+' : '';
  return `${label} ${prefix}${delta}`;
}

function summarizeInventoryChanges(previousInventory = {}, currentInventory = {}) {
  return [
    ...summarizeNamedCounts(previousInventory.materials, currentInventory.materials, '得材'),
    ...summarizeNamedCounts(previousInventory.pills, currentInventory.pills, '得丹')
  ];
}

function summarizeNamedCounts(previousEntries = {}, currentEntries = {}, label) {
  return Object.entries(currentEntries ?? {}).flatMap(([name, count]) => {
    const before = previousEntries?.[name] ?? 0;
    const delta = count - before;
    return delta > 0 ? [`${label} ${name} x${delta}`] : [];
  });
}

function summarizeCollectionChanges(previousEntries = [], currentEntries = [], verb) {
  const owned = new Set((previousEntries ?? []).map((item) => item?.name ?? item));
  return (currentEntries ?? [])
    .filter((item) => !owned.has(item?.name ?? item))
    .map((item) => `${verb} ${item.name}`);
}

function buildInventoryCollection(inventory) {
  const pills = Object.entries(inventory?.pills ?? {}).map(([name, count]) => ({
    name,
    badge: `丹药 x${count}`,
    description: `贴身所藏 ${name}，可在关键时刻调养经脉或稳住气机。`
  }));
  const materials = Object.entries(inventory?.materials ?? {}).map(([name, count]) => ({
    name,
    badge: `材料 x${count}`,
    description: `${name} 已整理入囊，可用于炼丹、交易或入秘境前备物。`
  }));
  return [...pills, ...materials];
}

function countInventoryStacks(inventory) {
  return Object.keys(inventory?.pills ?? {}).length + Object.keys(inventory?.materials ?? {}).length;
}

function resetPendingCharacterPreview() {
  pendingCharacterSeed = Number(localStorage.getItem('wendao-fusheng-character-seed') ?? Date.now());
  pendingAttributes = createDefaultAllocation();
  nodes.characterNameInput.value = '';
}

function handleApiError(error) {
  showToast(apiErrorMessage(error));
}

function apiErrorMessage(error) {
  const message = String(error?.message ?? '');
  if (message.startsWith('ATTRIBUTE_ALLOCATION_INVALID')) {
    return '天赋分配有误，请重新调整。';
  }
  return message || '云端暂不可用，请稍后重试。';
}

function kindForCommand(command) {
  if (command.includes('炼丹') || command.includes('丹') || command.includes('药')) {
    return 'alchemy';
  }
  if (command.includes('挑战') || command.includes('斗法') || command.includes('斩妖')) {
    return 'combat';
  }
  if (command.includes('林师姐') || command.includes('长老') || command.includes('打听') || command.includes('请教')) {
    return 'social';
  }
  if (command.includes('修炼') || command.includes('闭关') || command.includes('突破') || command.includes('稳固')) {
    return 'cultivate';
  }
  return 'explore';
}
