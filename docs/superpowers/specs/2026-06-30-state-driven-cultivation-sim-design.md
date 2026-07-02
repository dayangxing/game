# 状态驱动修仙模拟设计

## Goal

把当前《问道浮生》前后端原型升级为单机、状态驱动的文字修仙模拟。最终产品也不做开放世界、大地图或多人联机；核心体验由“境界成长 + 回合修炼 + 随机奇遇 + 门派关系 + 剧本事件库 + 因果后果”支撑可重复游玩。

目标不是写一条固定小说主线，而是让后端用玩家状态、时间、资源、关系和因果变量从事件池中生成可选行动。前端继续负责展示和交互，后端继续负责权威状态、规则结算和 LLM 叙事润色。

## Current Context

当前仓库已经具备稳定的前后端联调基础：

- 前端入口是 `frontend/index.html`，默认以后端 API 模式启动。
- 后端入口是 `backend/src/server.js`，API 包含 `/game/state`、`/daily-actions`、`/turns`、`/turns/:turn/narration` 和 `/export-story`。
- 现有 `daily-actions` 是按五个界面返回固定 action，再由 `/turns` 推进回合。
- 现有规则引擎能更新修为、灵石、心境、NPC 记忆、世界事件和日志，但内容仍偏固定模板。
- LLM 已被限定为“表达、生成、润色”，不能决定权威数值和规则结果。

这个基础适合直接演进为事件驱动模型，不需要重写前端或推倒 API 合同。

## Product Positioning

《问道浮生》定位为一个单机状态驱动文字修仙 RPG：

> 玩家先通过固定新手序章理解青云宗、雾隐秘境、寿元压力和飞升骗局伏笔。完成新手任务后，玩家创建自己的角色；每个角色都有随机属性、随机出身和不同初始命格。正式角色在寿元、境界瓶颈、宗门关系、因果选择和随机奇遇中成长，最终导向飞升、斩天门、成魔、开宗立派或新生重修等结局。

核心体验关键词：

- 境界突破爽感。
- 随机奇遇惊喜。
- 选择留下因果。
- 新角色随机属性带来复玩价值。

第一版维持现有项目名和青云宗、雾隐秘境等设定。陆青玄保留为新手序章主角和世界观引导角色，不再作为所有玩家正式存档的固定主角。

## Approved Product Decisions

本轮 review 后确认以下产品决策：

- 保留《问道浮生》作为项目名，保留青云宗、雾隐秘境、陆青玄、林师姐和玄衡长老作为第一版叙事锚点。
- 接受“寿元压力 + 飞升骗局伏笔”作为主叙事方向，但飞升骗局必须有可解释的历史原因、可追查的线索链和可落地的多结局。
- 最终产品定位为单机游戏，不做开放世界、大地图或多人联机。
- 不做离线挂机收益、挂机设置或自动收菜。修炼只通过主动行动、回合推进、新手任务和事件结算表现。
- 第一版优先事件库；新手任务完成后解锁玩家自建角色，每个正式角色通过随机属性生成差异。

## Considered Approaches

### Recommended: Event Library First

先把 `daily-actions` 改造成事件候选系统：后端根据玩家状态筛选事件卡，每张事件卡提供 2-4 个选择，每个选择有规则效果、成功/失败文本和未来事件标记。

优点：

- 最贴合当前 `/daily-actions` 和 `/turns` API。
- 能最快从“固定按钮”变成“状态触发剧情”。
- 剧情、数值和测试都可以按事件卡增量扩展。
- 后续接角色创建、结局、新角色重开和宗门结局时都有稳定接口。

代价：

- 第一版没有离线收益，修炼反馈主要来自主动选择和按回合/月推进。
- NPC 关系网先做简化，不做复杂家族和代际模拟。

### Rejected Alternative: Idle Cultivation First

先做离线收益、修炼速度、资源产出、突破材料和挂机计时，再慢慢补事件库。

优点：

- 更接近传统放置游戏的留存循环。
- 数值系统清晰，短期反馈稳定。

缺点：

- 容易变成只有数值没有修仙味。
- 当前前后端 action/turn 合同不能充分发挥，需要新增时间结算接口。
- 剧情差异和可重复游玩提升慢。
- 与当前确认的单机主动事件体验冲突，因此不进入第一版，也不作为最终目标。

### Alternative: NPC Relationship First

先做 NPC 状态、仇敌、道侣、师徒、宗门派系和随机人际事件。

优点：

- 长期叙事潜力高。
- 很容易产生玩家记忆点。

缺点：

- 内容与状态复杂度高，第一版平衡风险大。
- 如果没有事件引擎承载，NPC 关系容易只是面板数字。

结论：第一版采用 Event Library First。修炼成长和 NPC 关系都进入事件引擎，但不单独扩成挂机或复杂 NPC 模拟系统。

## MVP Scope

第一版实现一个新手/角色创建门槛，以及六个核心系统。

### 0. 新手引导与角色创建

第一版必须先做一个固定新手序章。序章使用陆青玄作为教学主角，用 6-8 个短任务一步步解释世界观、剧情伏笔和核心系统。序章完成后，玩家才能创建正式角色。

新手任务顺序：

1. 山门初醒：解释青云宗、当前界面、回合行动和日志。
2. 调息入门：解释境界、修为、灵气、心境和寿元。
3. 同门问讯：解释林师姐、NPC 好感、宗门关系和门派任务。
4. 丹房试火：解释材料、丹药、行囊和突破准备。
5. 雾隐铃声：解释雾隐秘境、青铜铃、天道裂痕和长期线索。
6. 因果一念：让玩家做一个救人/夺宝/交给宗门的选择，解释善缘、业力和未来事件。
7. 天门残契：露出飞升骗局的第一层证据，但不揭开全部真相。
8. 入世立命：结束序章，解锁正式角色创建。

正式角色创建：

- 玩家可以输入角色名，也可以随机生成名字。
- 玩家不能手动分配全部数值；每个角色由后端按 seed 随机生成属性、出身、灵根、命格、寿元和初始资源。
- 创建界面允许有限次重掷，重掷只改变正式角色，不改变已完成的新手序章状态。
- 每个正式角色以独立 `game.id` 和 `characterSeed` 保存，后续事件选择必须使用该角色自己的随机属性。
- 新手序章的世界观图鉴和已读教程可以保留为本地引导状态，但不把陆青玄的数值继承给正式角色。

随机属性字段：

- `character.name`
- `character.origin`
- `character.spiritualRoot`
- `character.traits`
- `character.comprehension`
- `character.physique`
- `character.luck`
- `character.karmaAffinity`
- `character.initialLifespan`
- `character.startingResources`

随机规则：

- 属性随机要有范围和权重，不能生成无法游玩的角色。
- 每个角色至少有一个优势和一个短板，例如寿元长但悟性低，或悟性高但灵根不稳。
- 灵根、命格和出身要影响事件权重，而不是只显示在面板上。
- 第一版不做复杂捏脸、职业树或自由点数分配。

### 1. 境界系统

范围从凡人、练气、筑基到金丹。当前玩家可以继续从炼气七层开始，但规则模型要支持更明确的境界阶梯。

核心字段：

- `realm`
- `realmStage`
- `cultivation`
- `breakthroughProgress`
- `tribulationRisk`
- `bottleneck`

规则：

- 修炼、丹药和奇遇增加修为或破境进度。
- 到达瓶颈后必须通过突破事件推进境界。
- 突破需要资源、心境、丹药或宗门指点。
- 强行突破会增加雷劫、心魔或反噬风险。

### 2. 修炼系统

修炼是短循环核心，始终通过 action 选择、任务和事件推进，不做真实时间离线收益。

核心字段：

- `cultivationRate`
- `qi`
- `mood`
- `lifespan`
- `activeTechnique`
- `cultivationFocus`

规则：

- 普通修炼稳定增长。
- 长期闭关消耗寿元或心境，但收益更高。
- 功法、灵根和事件 buff 影响修炼速度。
- 修炼事件会触发顿悟、走火入魔、瓶颈松动等结果。

### 3. 事件系统

事件系统是第一版技术核心。

事件不是固定任务树，而是由 trigger、choices 和 effects 组成的事件卡。后端根据当前 game state 筛选候选事件，再把事件选择包装成 daily action 返回前端。

事件类型：

- 修炼事件：闭关顿悟、走火入魔、瓶颈松动。
- 宗门事件：宗门小比、师父指点、长老内斗。
- 秘境事件：古修洞府、妖兽巢穴、残阵试炼。
- 人际事件：师姐邀约、仇敌追杀、故人报恩。
- 因果事件：救人回报、杀人反噬、夺宝追杀。
- 经济事件：坊市拍卖、黑市交易、商会委托。
- 天道事件：雷劫、心魔劫、天机泄露。

### 4. 门派系统

第一版只做青云宗的轻量门派状态。

核心字段：

- `sect.id`
- `sect.name`
- `sect.relation`
- `sect.contribution`
- `sect.rank`
- `masterNpcId`
- `sectFlags`

规则：

- 宗门任务增加贡献和关系。
- 宗门关系影响功法、丹药、秘境资格和小比事件。
- 师父或长老指点可以降低突破难度。
- 宗门事件可以产生竞争者、同门好感或仇恨。

### 5. 炼丹系统

第一版只做材料、丹药和突破辅助，不做完整炼丹小游戏。

核心字段：

- `inventory.materials`
- `inventory.pills`
- `alchemyLevel`
- `knownRecipes`

规则：

- 探索、坊市、宗门任务获得材料。
- 炼丹 choice 消耗材料，生成丹药或失败副产物。
- 聚气丹、筑基丹、疗伤丹、清心丹是第一批丹药。
- 丹药用于修炼、突破、治疗和事件选择。

### 6. 因果系统

因果让选择产生长期后果。

核心字段：

- `karma`
- `evil`
- `fate`
- `debts`
- `vendettas`
- `futureEventFlags`

规则：

- 救人、赠丹、守约增加善缘或人情。
- 杀人夺宝、欺骗、贿赂增加恶名或业力。
- 因果字段影响后续事件权重，而不是只改一条文案。
- 第一版支持“故人报恩”“冤魂索命”“正道追查”“黑市邀约”等后续事件。

## Non-Goals

第一版明确不做：

- 开放世界或大型地图，长期也不做。
- 多人联机、交易行、排行榜。
- 完整宗门战争。
- 复杂 NPC 家族谱系、婚育和代际关系。
- 几十个境界和上百件装备词条。
- 离线挂机收益、挂机设置、自动收益领取和推送通知。
- 生产级账号、数据库和支付系统。

其中开放世界、多人联机和离线挂机属于产品非目标，不作为后续阶段。其余复杂系统必须等事件系统稳定后再单独写规格。

## Core Loop

### 30 秒循环

玩家打开界面后立刻能做选择：

```text
查看状态 → 选择行动/任务 → 后端结算 → 获得叙事、资源和新事件提示
```

可选行动包括修炼、探索、采药、炼丹、宗门任务、处理奇遇。

### 10 分钟循环

玩家围绕中期目标做决策：

```text
积累修为/材料 → 选择功法/丹药 → 处理宗门或秘境事件 → 尝试突破
```

核心问题是“我现在该稳一点，还是冒险推进突破”。

### 长期循环

玩家围绕结局路线积累状态：

```text
练气 → 筑基 → 金丹 → 更高境界
善缘/恶名/宗门/秘境线索持续积累
结局、失败或寿元将尽时进入新角色创建或结局回顾
```

第一版只做到练气至金丹，但数据模型要允许后续扩展到飞升、斩天门、成魔、开宗立派和新角色重开。

## Narrative Theme

第一版采用“寿元压力 + 飞升骗局伏笔”的组合。

短期主题：

- 主角灵根残缺或雷木双灵根不稳。
- 修炼能变强，但闭关、强行突破和魔道捷径都会带来寿元或心境代价。
- 玩家每次突破不是单纯升级，而是在争取活下去的时间。

长期伏笔：

- 雾隐秘境和天道裂痕有关。
- 飞升通道并非纯粹机缘；第一版所有相关线索都指向“上界以飞升制度收割下界气运”。
- 青云宗内部有人知道部分真相，但立场不一致。

这样既保留当前青云宗/雾隐秘境设定，又为后续结局分支留下空间。

## Narrative Explanation and Endings

### 飞升骗局的合理解释

飞升不是简单的假门，也不是所有飞升者都会立刻死亡。它本质上是上界在天道裂痕后建立的气运税制。

旧时代下界修士可以凭自身修为飞升。后来天道裂痕扩大，凡界、灵界和仙界之间的灵气循环失衡。仙界为了维持自身不坠，重建飞升通道，并把通道改造成“天门契”。修士渡劫飞升时，天门会抽取其命格、气运和部分因果，把这些转化为仙界续命的燃料。飞升者仍可获得仙籍，但要接受上界律令；资质弱或因果重的人会被削去记忆、拆散命魂，成为维持天门的“炉薪”。

下界宗门把飞升包装成最高荣耀，是因为顶级宗门能从天门契获得反哺：功法残卷、仙器碎片、灵脉赐封和延寿秘术。代价是下界整体气运持续变薄，灵根残缺者增多，寿元缩短，突破雷劫变得更残酷。

### 青云宗与雾隐秘境的关系

雾隐秘境不是普通古修洞府，而是旧时代“雾隐道庭”留下的观测站。雾隐道庭曾记录天门被改造的过程，并试图重建不依赖上界的轮回阵。失败后，道庭被仙界清算，只留下碎裂石门、青铜铃、天裂碑和一批能感应天门契的残魂。

青云宗建立在雾隐道庭遗址外层。宗门内部因此分成三派：

- 守序派：认为天门契不可违抗，继续向上界供奉气运，换取宗门延续。
- 破门派：相信雾隐道庭留下了斩断天门的办法，暗中寻找继承者。
- 自保派：不关心真相，只想在青云宗内斗和外部魔道压力中活下去。

林师姐接触过雾隐线索但不知道全貌；玄衡长老知道更多，却因旧誓不能直接告诉主角。玩家通过事件库逐步拿到证据，而不是靠一段说明突然揭露真相。

### 寿元压力的来源

主角的雷木双灵根不是单纯天赋，而是被天裂碑残响影响后的异常灵根。雷代表天门契的劫力，木代表下界地脉的生机。两者共存让主角修炼速度不差，也让他能感应雾隐秘境和天门裂痕；代价是寿元会被天门契提前标记。

这解释了为什么玩家每次突破都像是在争取活下去：修炼越深，天门契越早注意到他。稳扎稳打可以延缓标记，丹药和宗门指点可以护住命火，魔道捷径可以快速增长但会让天门契和业力同时反噬。

### 线索链

第一版事件库需要从一开始埋下六类真相线索：

- `lifespan_mark`：主角寿元异常流失，普通诊断只能解释为灵根反噬。
- `mist_archive`：雾隐秘境石刻记录“飞升者名录”与下界灾年同步出现。
- `bronze_bell`：青铜铃只回应雷木双息，能短暂听见飞升者残魂。
- `sect_elder_split`：青云宗长老对秘境处理意见分裂，有人想封门，有人想开门。
- `ascension_contract`：古修残卷写明飞升前必须签下天门契。
- `heaven_gate_key`：多个秘境碎片可以组合成进入天门核心的钥匙。

第一版不需要揭开全部真相，但事件和伏笔必须服务这些线索，避免后续结局没有根。

### 长期结局

后续主线可以收束到六个结局。第一版只需要在数据模型和事件旗标中为它们留接口。

#### 顺天飞升

玩家接受天门契，献上一部分气运和因果，换取仙籍。结局不是失败，而是带苦味的成功：主角活下来并进入仙界体系，但下界继续衰败，曾经的人情与宗门大多被天门契抹平。

适合条件：宗门守序派好感高、业力低、选择多次维护秩序。

#### 逆斩天门

玩家集齐雾隐道庭遗物，联合破门派和下界势力，在渡劫时反向斩断天门契。下界气运停止流失，但短期灵气秩序崩塌，玩家可能牺牲境界、寿元或肉身。

适合条件：雾隐线索完整、青云宗破门派支持、因果债较少。

#### 重铸轮回

玩家不直接毁掉天门，而是用雾隐道庭的轮回阵重写飞升通道，让飞升者必须返还部分气运给下界。这个结局牺牲小，最难达成，需要平衡善缘、宗门、秘境和轮回线索。

适合条件：善缘高、救人因果多、轮回阵线索完整。

#### 人间立宗

玩家放弃飞升，留在下界建立新宗门或改革青云宗，用秘境遗物保护一方灵脉。下界不会立刻改变，但玩家留下传承，后续可接宗门经营和弟子系统。

适合条件：宗门贡献高、弟子/同门关系高、没有走极端善恶。

#### 魔道补天

玩家认定天道不公，转而用众生气血和仇敌命格重铸自己的仙路。此结局能打破天门，但会让下界进入更残酷的新秩序，是高收益高代价的黑暗路线。

适合条件：恶名高、杀夺事件多、魔道功法或黑市事件链深入。

#### 新生寻真

玩家在寿元耗尽、失败或主动放弃当前人生后，进入新角色创建。新角色由玩家命名并随机生成属性；上一角色不会把数值直接继承给新角色，只会把已经解锁的世界观图鉴、真相线索和结局记录留在本地收藏中。这样保留“轮回寻真”的修仙味，但实现上仍是单机新角色重开。

适合条件：寿元耗尽、关键线索未集齐，或玩家主动选择新生重修。

### 第一版落点

第一版不实现终局战或完整飞升选择，只做三件事：

- 让事件库持续产出与寿元、雾隐秘境、青云宗分裂和天门契有关的证据。
- 让玩家的善恶、宗门关系、秘境线索和寿元选择影响后续事件权重。
- 让 game state 保存结局相关 flags，后续主线可以自然接上，而不是重写存档。

## Event Card Contract

事件定义使用 JS 对象或 JSON-compatible 数据。第一版可以先放在 `backend/src/domain/events/`，不引入外部叙事工具。

```ts
type EventDefinition = {
  id: string;
  title: string;
  category: 'cultivation' | 'sect' | 'realm' | 'social' | 'karma' | 'economy' | 'heaven';
  priority: number;
  weight: number;
  cooldownTurns?: number;
  trigger: EventTrigger;
  entryText: string;
  choices: EventChoice[];
  tags?: string[];
};

type EventChoice = {
  id: string;
  label: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
  check?: RuleCheck;
  success: ChoiceOutcome;
  fail?: ChoiceOutcome;
};

type ChoiceOutcome = {
  text: string;
  effects: RuleEffect[];
  futureFlags?: string[];
};
```

Trigger 示例：

```json
{
  "realmMin": "练气后期",
  "viewIds": ["realm", "home"],
  "sectRelationMin": 30,
  "karmaMax": 80,
  "requiresFlags": ["mist_gate_seen"],
  "forbidFlags": ["sect_trial_completed"]
}
```

Effect 示例：

```json
[
  { "type": "stat", "path": "player.cultivationProgress", "delta": 16 },
  { "type": "resource", "id": "spiritStones", "delta": -20 },
  { "type": "item", "id": "筑基丹", "delta": 1 },
  { "type": "relation", "npcId": "lin_shijie", "delta": 8 },
  { "type": "flag", "id": "saved_injured_cultivator", "value": true },
  { "type": "futureEvent", "id": "old_friend_returns" }
]
```

Rule effects must be explicit and deterministic. LLM output can describe them but cannot create additional effects.

## Backend Design

### New Domain Modules

Add an event domain under backend:

```text
backend/src/domain/events/
  eventCatalog.js
  triggerMatcher.js
  eventSelector.js
  effectResolver.js
  eventResult.js
```

Responsibilities:

- `eventCatalog.js` exports event definitions.
- `triggerMatcher.js` checks whether an event is legal for current game state and view.
- `eventSelector.js` ranks eligible events by priority, weight, cooldown and category mix.
- `effectResolver.js` validates and applies effects to produce the next game state.
- `eventResult.js` converts resolved outcomes into the existing turn result shape.

### API Fit

Keep the current event-loop API paths and add one endpoint for formal character creation.

`POST /api/v1/game/new`:

- Starts a new formal single-player run after onboarding.
- Accepts `{ name?: string, rerollSeed?: number }`.
- Backend generates `characterSeed`, random attributes, starting resources and opening state.
- Returns `{ game, character }`.
- Does not copy tutorial protagonist stats into the formal character.

`POST /api/v1/daily-actions`:

- Input stays `{ viewId, gameVersion }`.
- Backend selects eligible events for that view.
- Each event choice becomes one action card.
- Action IDs stay backend-owned `act_...`.
- Pending action stores `eventId`, `choiceId`, `turn`, `expiresAt` and resolved preview metadata.

`POST /api/v1/turns`:

- Finds pending action.
- Rechecks turn and expiry.
- Resolves the selected event choice.
- Applies deterministic effects.
- Creates a rule entry.
- Passes rule entry to story graph for narration.
- Returns updated game state and turn result.

The event loop keeps the existing API contract. The only new first-version endpoint is `POST /api/v1/game/new`, used to create a formal random character after the onboarding sequence.

### State Changes

Extend `GameState` while preserving existing fields used by the frontend:

```ts
type GameState = {
  id: string;
  version: number;
  turn: number;
  calendar: Calendar;
  onboarding: OnboardingState;
  characterSeed: number;
  character: CharacterState;
  player: PlayerState;
  sect: SectState;
  inventory: InventoryState;
  karma: KarmaState;
  flags: Record<string, boolean | number | string>;
  cooldowns: Record<string, number>;
  npcs: NpcState[];
  worldEvents: WorldEvent[];
  foreshadows: string[];
  timeline: TimelineItem[];
  log: TurnLogEntry[];
};
```

```ts
type OnboardingState = {
  completed: boolean;
  stepId: string;
  completedStepIds: string[];
  unlockedCharacterCreation: boolean;
};

type CharacterState = {
  name: string;
  origin: string;
  spiritualRoot: string;
  traits: string[];
  comprehension: number;
  physique: number;
  luck: number;
  karmaAffinity: number;
  initialLifespan: number;
  startingResources: Record<string, number>;
};
```

Existing `player.sectRelation`, `spiritStones`, `cultivationProgress`, `npcs`, `worldEvents` and `foreshadows` remain available so current UI does not break.

## Frontend Design

The frontend has three first-run stages:

1. 新手任务：固定陆青玄序章，逐步解释世界观、剧情伏笔和核心系统。
2. 创建角色：序章完成后展示角色创建界面，玩家输入或随机姓名，后端生成随机属性。
3. 正式游戏：进入现有 dashboard，使用玩家自己的角色状态和事件池。

The formal game keeps the current five top-level views:

- 洞府：状态总览、短循环行动、因果提示。
- 修炼：闭关、吐纳、破境、心魔/雷劫风险。
- 功法：心法、术法、身法、修炼路线。
- 秘境：探索、战斗、奇遇、线索。
- 行囊：材料、丹药、法器、交易。

Daily action cards become event choice cards:

- Title comes from event or choice.
- Meta shows category, reward hint, risk or requirement.
- Story hook includes event category, trigger reason and resolved rule boundaries.
- If a choice has unmet visible requirements, backend should not return it in first version. Later versions can show locked choices.

Additional UI requirements:

- New onboarding UI must behave like task steps, not a long lore article. Each task teaches one system and unlocks the next action.
- Character creation must show random attributes in a readable card: 出身、灵根、命格、悟性、体魄、气运、寿元、初始资源.
- Character creation may allow reroll, but the UI must make clear that reroll changes the formal character seed.
- Add compact sections for `因果`, `门派贡献`, `丹药/材料`, `寿元压力`.
- Log entries should distinguish rule outcome and narration text.
- Timeline should show future-event hints without revealing all hidden triggers.
- Error handling stays as current toast + retry pattern.

No visual redesign is required in this spec. The current dashboard can carry the first event-system MVP.

## LLM Boundary

LLM remains downstream of deterministic rules.

Allowed:

- Rewrite event outcome into stronger prose.
- Generate NPC voice from resolved relationship state.
- Suggest flavor text for event cards after deterministic selection.
- Summarize accumulated memory and foreshadowing.

Not allowed:

- Add rewards, items, realm progress or relationship changes.
- Decide success/failure of checks.
- Invent new flags or future events.
- Override cooldowns, action legality or expiry.

If LLM fails, backend returns deterministic event text and still advances the turn.

## Data Flow

```text
First launch
  → fixed tutorial game uses 陆青玄
  → onboarding task chain teaches world, UI, cultivation, sect, alchemy, karma and heaven-gate clues
  → onboarding.completed unlocks character creation
  → POST /api/v1/game/new { name?, rerollSeed? }
  → backend rolls formal character attributes and returns a new game
Formal game view tab
  → POST /api/v1/daily-actions { viewId, gameVersion }
  → backend event selector filters event catalog
  → action cards returned with backend action IDs
  → player clicks one action
  → POST /api/v1/turns { actionId, clientTurn }
  → backend validates pending action
  → effect resolver applies deterministic outcome
  → story graph narrates resolved outcome
  → frontend renders state, log, timeline and next actions
```

The existing immediate frontend action fallback may remain for responsiveness, but API-mode submission must still resolve to backend action IDs before turn submission.

## Error Handling

- No eligible events: backend returns safe fallback actions for the current view, such as 静坐调息、整理行囊、拜会同门.
- Invalid view: keep `UNKNOWN_VIEW`.
- Stale game version: keep `GAME_VERSION_MISMATCH`.
- Expired or consumed action: keep `ACTION_EXPIRED`.
- Stale turn: keep `TURN_MISMATCH`.
- Event no longer legal at submit time: return `EVENT_NOT_AVAILABLE` with refresh guidance.
- Missing item/resource for selected choice: return `CHOICE_REQUIREMENT_FAILED`.
- Character creation before onboarding completion: return `ONBOARDING_REQUIRED`.
- Invalid character name: return `CHARACTER_NAME_INVALID`.
- Character roll produces an out-of-range value: fail closed with `CHARACTER_ROLL_INVALID` and do not start the run.
- Effect resolver detects unsupported effect: fail closed with `RULE_EFFECT_INVALID` and do not advance the turn.
- LLM unavailable: advance deterministic state and return fallback narration with retry metadata.

## Testing Strategy

Backend tests:

- Tutorial completion unlocks formal character creation.
- Character creation returns seeded random attributes within playable ranges.
- Different character seeds produce different origins, traits or stat spreads.
- Event trigger matcher includes and excludes events correctly.
- Event selector returns category-appropriate actions for each view.
- Turn resolution applies stat, resource, item, relation, flag and future-event effects.
- Stale turn, expired action and no-longer-legal event do not advance state.
- LLM failure still preserves resolved rule state.

Frontend tests:

- Onboarding renders step-by-step tasks instead of one long explanation.
- Character creation is hidden before onboarding completion and available after completion.
- Random character attributes render clearly before starting a formal run.
- Action cards can render event choice metadata.
- Existing immediate-action-to-backend-ID resolution still works.
- New state fields render without breaking older game states.
- API errors remain visible and do not get covered by onboarding.

Integration tests:

- Completing onboarding then creating a character returns a formal game whose protagonist is not fixed to 陆青玄 unless the player explicitly uses that name.
- A sect event can be selected from `/daily-actions` and resolved through `/turns`.
- A choice can set a future flag, and a later `/daily-actions` call can surface the follow-up event.
- A breakthrough-related event can change realm/progress only through deterministic effects.

## Acceptance Criteria

The first event-system MVP is accepted when:

- New players complete a step-by-step onboarding task chain that explains 青云宗、雾隐秘境、寿元压力、因果 and the first 天门契 clue.
- Formal character creation is locked until onboarding completion.
- Formal character creation generates random playable attributes from a backend seed.
- At least three generated characters can differ in origin, spiritual root, trait or stat spread.
- `POST /api/v1/daily-actions` returns state-dependent event choices, not only fixed view actions.
- At least 18 event definitions exist across the six MVP systems.
- Each of the five frontend views can receive at least three relevant choices.
- At least one event chain demonstrates long-term cause and effect, such as 救人 → 故人报恩 or 夺宝 → 追杀.
- At least one breakthrough flow reaches 筑基 or advances a clearly modeled breakthrough state.
- At least one alchemy flow consumes material and creates a pill.
- At least one sect flow changes contribution/rank/relation.
- The event catalog seeds the six truth flags: `lifespan_mark`, `mist_archive`, `bronze_bell`, `sect_elder_split`, `ascension_contract` and `heaven_gate_key`.
- No implementation path adds offline idle rewards, offline timers, auto-claim resources or open-world map navigation.
- Existing API contract tests continue to pass.
- LLM failure does not prevent deterministic turn advancement.

## Implementation Phases

### Phase 1: Onboarding and Character Creation Skeleton

Create onboarding state, fixed tutorial task definitions, random character generation, and `POST /api/v1/game/new`. Add tests for tutorial gating and playable random attribute ranges.

### Phase 2: Event Engine Skeleton

Create event catalog, trigger matcher, selector and effect resolver. Keep frontend changes minimal. Add tests around pure event functions.

### Phase 3: API Integration

Make `/daily-actions` source actions from event selector, store event metadata in pending actions, and make `/turns` resolve selected choices through effect resolver.

### Phase 4: State Surface

Expose onboarding, character, sect, inventory, karma, flags and cooldowns in game state. Update frontend panels to show the new fields.

### Phase 5: Content Seed

Add a small but varied event library:

- 4 cultivation/breakthrough events.
- 3 sect events.
- 3 realm/secret-realm events.
- 3 social/NPC events.
- 3 karma/future consequence events.
- 2 alchemy/economy events.

### Phase 6: Narrative Polish

Update story graph prompts so LLM receives event ID, choice ID, deterministic effects and forbidden additions. Add fallback narration for every event outcome.

## Decomposition Boundary

This spec covers only the first state-driven single-player event-system MVP. It intentionally does not specify production persistence, account systems, open-world navigation, offline idle calculation, large NPC simulation or turn-based combat. Open-world navigation and offline idle calculation are product non-goals; the other complex systems need their own later spec after the event system proves the core loop.

## Current Review State

- The current approved direction keeps 《问道浮生》、青云宗和雾隐秘境.
- The current approved theme is “寿元压力 + 飞升骗局伏笔”, with the concrete explanation and ending structure above.
- The current approved product target is a single-player game, not an open-world game.
- The current approved implementation excludes offline idle rewards and offline idle settings.
- The current approved onboarding flow uses 陆青玄 to teach worldbuilding and plot, then unlocks random player-created formal characters.
