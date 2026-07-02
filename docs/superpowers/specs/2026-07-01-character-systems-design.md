# 角色构筑与突破系统设计

## Goal

把《问道浮生》从“随机角色 + 事件卡推进”的 MVP，升级为更完整的单机文字修仙循环：

- 创建角色时支持玩家手动分配五维属性，也支持随机分配。
- 行囊界面显示已获得材料、丹药、宝物和装备加成。
- 功法界面显示已学功法、品阶、类型和当前加成。
- 奇遇事件能获得功法和宝物，并通过规则系统影响属性、生命、寿元和突破成功率。
- 主界面显示历史行为，玩家能看见最近行动、收益、损失和长期伏笔。
- 每次行动消耗寿元，境界越高消耗越高。
- 新增生命值和最大寿限，剧情、战斗、突破失败和宝物都会影响这些状态。
- 突破存在成功率，受角色属性、状态、装备、功法和境界影响。
- 大模型正式接入保持现有边界：只润色已结算结果，不决定规则。

第一版仍是单机游戏，不做开放世界、不做离线挂机、不做复杂装备穿戴栏、不做主动技能战斗。

## Current Context

当前代码已经具备：

- 后端权威状态：`backend/src/app.js`
- 角色随机生成：`backend/src/domain/characterCreation.js`
- 事件库：`backend/src/domain/events/eventCatalog.js`
- 事件结算：`backend/src/domain/events/effectResolver.js`
- LLM 叙事边界：`backend/src/llm/prompts/narrationPrompt.js`
- 前端五个入口：洞府、修炼、功法、秘境、行囊
- 本地 `.env.local` 模型配置与 `GET /api/v1/model-health`

现有短板：

- 角色创建只能随机，不能手动分配。
- 角色属性仍是 `comprehension`、`physique`、`luck` 等旧字段，和参考图里的根骨/悟性/气运/心性/命元不一致。
- `inventory` 只有 materials / pills，没有宝物、装备和加成汇总。
- 功法界面只是行动入口，没有显示已学功法。
- 事件 effect 不支持获得功法、宝物、生命值、最大寿限和五维属性变化。
- 每回合没有统一寿元消耗。
- 突破只是普通事件，没有成功率和失败代价。

## Product Model

### Five Attributes

正式角色使用五维属性：

- `rootBone` / 根骨：最大生命、伤害减免、突破失败代价减免。
- `comprehension` / 悟性：修炼收益、功法领悟、突破成功率。
- `fortune` / 气运：奇遇概率、稀有奖励概率、突破小幅加成。
- `willpower` / 心性：心魔风险、暗伤概率、突破稳定性。
- `lifeSeed` / 命元：最大寿限、寿元损耗缓冲、寿元事件收益。

每项范围 1 到 10。初始可分配总点数为 25。创建时必须全部分配完。

### Creation Flow

角色创建界面参考第一张图：

- 每个属性一张分配卡。
- 卡片显示图标、名称、当前数值和解释。
- 支持 `-` / `+` 调整。
- 显示剩余点数。
- `随机分配` 会在 25 点总量内重新分配，保证每项 1 到 10。
- `开始新生` 把姓名和属性分配发给后端。

后端仍保留 seed，可用于出身、灵根、命格、初始资源、初始功法和宝物抽取。

### Derived Stats

从五维属性推导：

- `maxHealth = 80 + rootBone * 8 + lifeSeed * 2`
- `health = maxHealth`
- `maxLifespan = initialLifespan + lifeSeed * 8`
- `lifespan = maxLifespan`
- `cultivationProgress` 保留现有 0-100 形式。
- `qi` 和 `mood` 继续保留，但 UI 上改为“灵力”和“心境”。

### Lifespan Cost

每次正式行动都会消耗寿元。序章不消耗正式角色寿元。

基础消耗按境界：

- 炼气：1
- 筑基：2
- 金丹：4
- 元婴及以后预留：8

最终消耗：

```text
lifespanCost = max(1, realmBaseCost - floor(lifeSeed / 4) - equipmentLifespanSave)
```

如果寿元降到 0，第一版先进入 `dying` 状态并禁止普通行动，只允许未来添加的续命/结局行动。第一版实现可以先返回结局提示，不做完整结局树。

### Health

生命值代表短期生存状态：

- 战斗、秘境、突破失败扣生命。
- 丹药、宝物、部分奇遇恢复生命。
- 根骨越高，事件伤害减免越高。
- 生命降到 0 时进入 `wounded` 状态，本次行动仍记录，但后续高风险行动会被过滤。

### Inventory And Treasures

`inventory` 扩展为：

```js
{
  materials: {},
  pills: {},
  treasures: [
    {
      id: 'calm_lotus_incense',
      name: '静心莲香',
      rarity: '良品',
      description: '点燃后可令识海宁静，突破时更易定神。',
      bonuses: { breakthroughChance: 3 }
    }
  ],
  equipment: {
    treasureIds: []
  }
}
```

第一版宝物默认生效，不做装备槽限制。后续可以再引入“随身储物袋上限”和穿戴槽。

行囊界面显示：

- 当前总加成：生命恢复、伤害减免、突破成功率等。
- 材料。
- 丹药。
- 宝物列表。

### Techniques

功法模型：

```js
techniques: [
  {
    id: 'qingmu_jue',
    name: '青木诀',
    grade: '凡品',
    type: '心法',
    level: 1,
    description: '以木息滋养经脉。',
    bonuses: { cultivationGain: 6, maxHealth: 6 }
  }
]
```

功法界面显示：

- 已学功法。
- 当前加成。
- 功法类型：心法、术法、身法、秘术。
- 未来可扩展等级，但第一版只展示和提供被动加成。

### Encounter Rewards

奇遇事件可以通过新 effect 获得：

- `treasure`
- `technique`
- `vitality`
- `maxHealth`
- `lifespan`
- `maxLifespan`
- `attribute`

示例事件：

- 雾隐残匣：获得宝物“静心莲香”，突破加成 +3。
- 石壁悟法：获得功法“雾隐步”，心性 +1，秘境伤害减免。
- 命灯回照：恢复寿元，命元 +1。
- 古修试炼：扣生命，成功后获得“青雷诀”。

### Breakthrough

突破不是普通 stat 增加，而是专门规则：

输入：

- 当前境界。
- 修炼进度。
- 五维属性。
- 当前生命 / 寿元 / 心境。
- 功法加成。
- 宝物加成。
- 暗伤状态。

成功率：

```text
base = realmBaseChance
attributeBonus = comprehension * 2 + rootBone + willpower + floor(fortune / 2)
stateBonus = floor(mood / 20) + floor(qi / 25)
bonus = technique.breakthroughChance + treasure.breakthroughChance
penalty = woundPenalty + lifespanPressurePenalty + realmPenalty
chance = clamp(base + attributeBonus + stateBonus + bonus - penalty, 5, 95)
```

第一版 realmBaseChance：

- 炼气小层：35
- 炼气到筑基：25
- 筑基小层：22
- 筑基到金丹：15

突破结果：

- 成功：提升境界，进度清零，生命/灵力上限刷新，记录世界事件。
- 失败：进度回退到 40-60，扣生命和寿元，按心性/根骨降低暗伤概率。

突破 action 显示：

- 目标境界。
- 成功率。
- 失败代价。
- 选择“尝试突破”或“继续磨炼”。

### History

主界面增加“历史行为”：

- 展示最近 8-10 条行动。
- 每条包含年份/回合、标题、简短文本和效果摘要。
- 效果摘要来自 `turnResult.ruleResult`，不是 LLM 自己编。

现有 `log` 可以继续作为历史源，但需要补充 `effectsSummary` 或从 ruleResult 生成展示。

### LLM Boundary

继续使用现有大模型接入：

- `.env.local` 配置 DashScope compatible-mode。
- `BailianClient` 请求 `/chat/completions`。
- `StoryGraph` 先规则结算，再 LLM 润色。

需要扩展 prompt 的 context：

- 五维属性。
- 当前生命 / 最大生命。
- 当前寿元 / 最大寿限。
- 已学功法。
- 已获宝物。
- 突破结果和成功率。

禁止项同步扩展：

- 不得新增功法。
- 不得新增宝物。
- 不得改变突破成功/失败。
- 不得改变生命、寿元、五维属性。

## API Changes

### `POST /api/v1/game/new`

请求体扩展：

```js
{
  name: '顾清河',
  rerollSeed: 52,
  attributes: {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  }
}
```

后端校验：

- 每项必须为整数。
- 每项 1 到 10。
- 总和必须为 25。
- 不传 attributes 时仍可走后端随机分配，保持兼容。

### `GET /api/v1/game/state`

返回 game state 增加：

- `character.attributes`
- `player.health`
- `player.maxHealth`
- `player.lifespan`
- `player.maxLifespan`
- `inventory.treasures`
- `inventory.equipment`
- `techniques`
- `derivedBonuses`

### `/daily-actions`

突破条件满足时，修炼页优先出现突破 action。

事件 action 的内部对象可以携带：

- `breakthrough`
- `rewardPreview`

前端显示时仍不展示内部 id 或调试字段。

## UI Design

整体继续沿用当前水墨纸张风格，不做移动端重构。

角色创建：

- 中央主舞台显示 5 张属性卡。
- 底部固定操作：随机分配 / 开始新生。
- 剩余点数清晰显示。

洞府：

- 左侧角色卡增加五维小面板。
- 显示生命和寿元进度条。
- 中央日志改名为历史行为，保留天机札记叙事。

功法：

- 主区域展示已学功法卡。
- 右侧或资源区显示功法总加成。

行囊：

- 主区域展示材料、丹药、宝物。
- 宝物卡格式参考第二张图：名称、品阶、描述、被动效果。

修炼：

- 修炼进度满时显示突破卡，格式参考第三张图：目标、成功率、失败代价、两个选择。

## Testing Strategy

新增或扩展测试：

- 角色属性分配校验。
- 随机分配总点数和范围。
- 手动 attributes 能写入正式角色。
- 派生生命/寿限计算。
- 每次行动扣寿元，境界越高扣越多。
- effect 支持 treasure、technique、vitality、attribute。
- 行囊/功法 UI 不显示内部字段。
- 突破成功率可复现，成功/失败路径都覆盖。
- LLM prompt 包含新状态并禁止模型改写新规则结果。
- 真实模型 smoke test 仍能返回 generated。

## Out Of Scope For This Iteration

- 离线挂机收益。
- 开放世界地图。
- 多人或排行榜。
- 装备槽、主动技能、完整战斗系统。
- 轮回货币和付费重掷。
- 完整死亡结局树。
