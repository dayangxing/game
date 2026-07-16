# PC 与移动端响应式布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让问道浮生前端在常用 PC、平板和移动端尺寸下不横向溢出，并为平板/手机提供可访问的顶部折叠菜单。

**Architecture:** 保留现有单页 HTML、hash 导航和业务按钮监听。`layoutModes.js` 根据视口宽度返回 desktop/tablet/mobile 模式；CSS 负责布局重排；`app.js` 只负责移动端菜单的展开、收起和 ARIA 状态。桌面端复用现有五个业务按钮，折叠端通过同一组按钮节点提供菜单项。

**Tech Stack:** 原生 HTML、CSS、ES modules、Node.js built-in test runner、Codex in-app browser viewport verification。

## Global Constraints

- 只修改当前 `dev` 分支，不修改或推送 `main`。
- 不改动后端、API、游戏状态、存档格式和业务按钮的现有 ID。
- 保留桌面端可见的“指引 / 存档 / 传记 / 重开 / 随机”按钮。
- 在宽度 `<= 900px` 时使用“菜单”按钮承载上述次要操作。
- 主布局断点为 `1200px` 和 `768px`。
- 移动端和平板端的页面横向滚动宽度不得超过视口宽度 1px。
- 保留现有 `.idea/` 未跟踪文件，不纳入提交。

---

### Task 1: Enable width-based layout modes

**Files:**
- Modify: `frontend/src/ui/layoutModes.js`
- Test: `tests/frontend-layout.test.js`

**Interfaces:**
- Produces `getLayoutMode({ width?: number })` returning one of the entries in `layoutModes`.
- `layoutModes.enabled` becomes `['desktop', 'tablet', 'mobile']`.
- `desktop` uses `minWidth: 1200`, `tablet` uses `minWidth: 768`, and `mobile` uses `minWidth: 0`.

- [ ] **Step 1: Write the failing tests**

Add `import fs from 'node:fs';` beside the existing imports, then replace the desktop-only assertions in `tests/frontend-layout.test.js` with:

```js
test('frontend enables desktop, tablet, and mobile layout modes', () => {
  assert.deepEqual(layoutModes.enabled, ['desktop', 'tablet', 'mobile']);
  assert.deepEqual(layoutModes.planned, []);
});

test('getLayoutMode selects the mode from common viewport widths', () => {
  assert.equal(getLayoutMode({ width: 1440 }).id, 'desktop');
  assert.equal(getLayoutMode({ width: 1024 }).id, 'tablet');
  assert.equal(getLayoutMode({ width: 768 }).id, 'tablet');
  assert.equal(getLayoutMode({ width: 767 }).id, 'mobile');
  assert.equal(getLayoutMode({ width: 390 }).id, 'mobile');
});

test('layout modes expose the responsive minimum width contract', () => {
  assert.equal(layoutModes.desktop.minWidth, 1200);
  assert.equal(layoutModes.tablet.minWidth, 768);
  assert.equal(layoutModes.mobile.minWidth, 0);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/frontend-layout.test.js`

Expected: FAIL because the current implementation only returns `desktop` and does not expose tablet/mobile mode entries.

- [ ] **Step 3: Implement width-based mode selection**

Implement the mode table and selector:

```js
export const layoutModes = {
  enabled: ['desktop', 'tablet', 'mobile'],
  planned: [],
  desktop: { id: 'desktop', minWidth: 1200, shellClass: 'layout-desktop' },
  tablet: { id: 'tablet', minWidth: 768, shellClass: 'layout-tablet' },
  mobile: { id: 'mobile', minWidth: 0, shellClass: 'layout-mobile' }
};

export function getLayoutMode({ width } = {}) {
  const viewportWidth = Number.isFinite(width)
    ? width
    : (Number.isFinite(globalThis.innerWidth) ? globalThis.innerWidth : 1200);

  if (viewportWidth >= layoutModes.desktop.minWidth) return layoutModes.desktop;
  if (viewportWidth >= layoutModes.tablet.minWidth) return layoutModes.tablet;
  return layoutModes.mobile;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/frontend-layout.test.js`

Expected: all layout tests pass.

### Task 2: Add the accessible utility menu shell

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/app.js`
- Test: `tests/frontend-app-wiring.test.js`

**Interfaces:**
- Adds `#utilityMenuBtn` with `aria-controls="utilityMenuPanel"` and `aria-expanded="false"`.
- Adds `#utilityMenuPanel` with `aria-hidden="true"`.
- Adds `#utilityMenu` as the wrapper used for outside-click detection and open-state styling.
- Keeps `#guideBtn`, `#saveBtn`, `#exportBtn`, `#resetBtn`, and `#sampleBtn` unchanged.
- Adds `openUtilityMenu()` and `closeUtilityMenu()` behavior without changing business callbacks.

- [ ] **Step 1: Write the failing structural tests**

Append to `tests/frontend-app-wiring.test.js`:

```js
test('frontend exposes an accessible utility menu while preserving utility button ids', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.match(html, /id="utilityMenuBtn"/);
  assert.match(html, /aria-controls="utilityMenuPanel"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="utilityMenuPanel"/);
  assert.match(html, /aria-hidden="true"/);

  for (const id of ['guideBtn', 'saveBtn', 'exportBtn', 'resetBtn', 'sampleBtn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('frontend wires utility menu state and escape dismissal', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /utilityMenuBtn:\s*document\.querySelector\('#utilityMenuBtn'\)/);
  assert.match(source, /utilityMenuPanel:\s*document\.querySelector\('#utilityMenuPanel'\)/);
  assert.match(source, /function openUtilityMenu\(\)/);
  assert.match(source, /function closeUtilityMenu\(\)/);
  assert.match(source, /utilityMenuBtn\.addEventListener\('click'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /closeUtilityMenu\(\)/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/frontend-app-wiring.test.js`

Expected: FAIL because the HTML and app module do not yet expose the menu nodes or handlers.

- [ ] **Step 3: Add the menu markup without changing business IDs**

Inside `.top-actions`, keep `.mode-toggle` and wrap the five existing buttons with:

```html
<div class="utility-menu">
  <button
    id="utilityMenuBtn"
    class="utility-menu-toggle"
    type="button"
    aria-controls="utilityMenuPanel"
    aria-expanded="false"
  >
    菜单
  </button>
  <div id="utilityMenuPanel" class="utility-menu-panel" aria-hidden="true">
    <button id="guideBtn" type="button">指引</button>
    <button id="saveBtn" type="button">存档</button>
    <button id="exportBtn" type="button">传记</button>
    <div class="utility-menu-divider" role="separator"></div>
    <button id="resetBtn" class="is-danger" type="button">重开</button>
    <button id="sampleBtn" type="button">随机</button>
  </div>
</div>
```

- [ ] **Step 4: Add menu state handlers**

Add `utilityMenu`, `utilityMenuBtn`, and `utilityMenuPanel` to the existing `nodes` map and wire these behaviors:

```js
function setUtilityMenuOpen(isOpen) {
  nodes.utilityMenuBtn.setAttribute('aria-expanded', String(isOpen));
  nodes.utilityMenuPanel.setAttribute('aria-hidden', String(!isOpen));
  nodes.utilityMenu.classList.toggle('is-open', isOpen);
}

function openUtilityMenu() {
  setUtilityMenuOpen(true);
}

function closeUtilityMenu() {
  setUtilityMenuOpen(false);
}

nodes.utilityMenuBtn.addEventListener('click', () => {
  const isOpen = nodes.utilityMenuBtn.getAttribute('aria-expanded') === 'true';
  setUtilityMenuOpen(!isOpen);
});

nodes.utilityMenuPanel.addEventListener('click', (event) => {
  if (event.target.closest('button')) closeUtilityMenu();
});

document.addEventListener('click', (event) => {
  if (!nodes.utilityMenu.contains(event.target)) closeUtilityMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeUtilityMenu();
});
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `node --test tests/frontend-app-wiring.test.js`

Expected: all frontend wiring tests pass.

### Task 3: Remove fixed desktop width and add responsive CSS

**Files:**
- Modify: `frontend/src/styles.css`
- Test: `tests/frontend-layout.test.js`

**Interfaces:**
- The base document must allow `width: 100%` and `min-width: 0`.
- Desktop keeps the existing visual language and card density.
- Tablet/mobile use one-column content and a top-right utility menu.

- [ ] **Step 1: Add CSS contract tests**

Append to `tests/frontend-layout.test.js`:

```js
test('responsive stylesheet removes fixed page minimums and defines common breakpoints', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /body\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(css, /\.app\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(css, /@media\s*\(max-width:\s*1199px\)/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /\.utility-menu\.is-open\s+\.utility-menu-panel/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/frontend-layout.test.js`

Expected: FAIL because the stylesheet has fixed 1180px/1144px minimums and no responsive media queries or menu styles.

- [ ] **Step 3: Implement base menu styles and responsive layout overrides**

Change the base `body` and `.app` minimum widths to `0`, then append rules with this behavior:

```css
.utility-menu {
  position: relative;
}

.utility-menu-toggle {
  display: none;
}

.utility-menu-panel {
  display: contents;
}

.utility-menu-divider {
  display: none;
}

@media (max-width: 1199px) {
  .app {
    width: min(100%, calc(100% - 24px));
    padding: 12px;
  }

  .topbar {
    grid-template-columns: minmax(180px, auto) minmax(0, 1fr);
    align-items: start;
  }

  .top-actions {
    grid-column: 1 / -1;
    justify-content: space-between;
  }

  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .top-actions {
    align-items: center;
  }

  .utility-menu-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 72px;
    min-height: 44px;
  }

  .utility-menu-panel {
    position: absolute;
    z-index: 10;
    top: calc(100% + 8px);
    right: 0;
    display: none;
    min-width: 190px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--paper-light);
    box-shadow: var(--shadow);
  }

  .utility-menu.is-open .utility-menu-panel {
    display: grid;
    gap: 4px;
  }

  .utility-menu-panel button {
    width: 100%;
    min-height: 44px;
    text-align: left;
  }

  .utility-menu-divider {
    display: block;
    height: 1px;
    margin: 4px 0;
    background: var(--line);
  }

  .utility-menu-panel .is-danger {
    color: var(--cinnabar);
  }

  .top-actions > .utility-menu > .utility-menu-panel > button {
    padding: 0 12px;
  }
}

@media (max-width: 767px) {
  body {
    overflow-x: hidden;
  }

  .app {
    width: 100%;
    padding: 8px;
  }

  .topbar {
    grid-template-columns: 1fr auto;
    gap: 10px;
    margin-bottom: 12px;
    padding: 10px;
  }

  .brand {
    min-width: 0;
  }

  .brand h1 {
    font-size: 20px;
  }

  .top-tabs {
    grid-column: 1 / -1;
    justify-content: stretch;
    width: 100%;
    min-width: 0;
    gap: 6px;
  }

  .top-tabs button {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
  }

  .top-actions {
    grid-column: 2;
    grid-row: 1;
    justify-content: flex-end;
  }

  .layout,
  .dashboard-content,
  .active-view-content,
  .view-grid,
  .view-grid.compact,
  .view-grid.split,
  .action-grid,
  .status-overview,
  .attribute-summary,
  .ending-summary,
  .personal-sections,
  .personal-attribute-grid,
  .personal-status-grid,
  .personal-relation-list,
  .personal-technique-list,
  .profile-grid,
  .profile-meter-grid,
  .state-npc-list,
  .archive-grid,
  .archive-context-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .character-panel,
  .personal-sheet {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero-scroll {
    padding: 14px;
  }

  .hero-scroll h2 {
    font-size: 24px;
  }

  .paper-card {
    padding: 14px;
  }

  .allocation-card,
  .archive-recent-list article,
  .archive-thread-list article,
  .personal-relation-list article {
    grid-template-columns: minmax(0, 1fr);
  }

  .toast {
    right: 12px;
    bottom: 12px;
    left: 12px;
    max-width: none;
  }
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/frontend-layout.test.js`

Expected: all layout mode and CSS contract tests pass.

### Task 4: Run the full regression suite and browser viewport checks

**Files:**
- Inspect: `frontend/index.html`
- Inspect: `frontend/src/app.js`
- Inspect: `frontend/src/ui/layoutModes.js`
- Inspect: `frontend/src/styles.css`

- [ ] **Step 1: Run the complete Node test suite**

Run: `node --test`

Expected: exit code `0` with zero failed tests.

- [ ] **Step 2: Start the project using the project startup command**

Run: `npm run start:all`

Expected: backend responds on `http://127.0.0.1:8787` and frontend responds on `http://127.0.0.1:5173/frontend/`. Use the existing project environment resolution in `scripts/start-dev.sh`; do not switch to a base environment.

- [ ] **Step 3: Verify common viewports in the in-app browser**

For each viewport `{ width: 390, height: 844 }`, `{ width: 768, height: 1024 }`, `{ width: 1280, height: 800 }`, and `{ width: 1440, height: 900 }`, reload `http://127.0.0.1:5173/frontend/` and read:

```js
({
  viewport: { width: window.innerWidth, height: window.innerHeight },
  scrollWidth: document.documentElement.scrollWidth,
  utilityMenuVisible: getComputedStyle(document.querySelector('#utilityMenuBtn')).display !== 'none',
  desktopUtilityVisible: getComputedStyle(document.querySelector('#guideBtn')).display !== 'none'
})
```

Expected: scroll width is at most viewport width plus 1px; menu button is visible at widths <= 900px; original utility buttons are directly visible at widths > 900px.

- [ ] **Step 4: Verify menu interaction**

At the 390px viewport, click `#utilityMenuBtn`, assert `aria-expanded="true"`, assert the panel has class `.is-open`, then press `Escape` and assert `aria-expanded="false"`. Click one original menu button and verify the panel closes without removing the button from the DOM.

- [ ] **Step 5: Review the diff and working tree**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors; only the responsive implementation files and plan/spec documents are changed, and `.idea/` remains untracked and unstaged.
