# 连续剧情导演模式设计

## Goal

把《问道浮生》的主页推进方式从“固定每日行动卡”升级为“连续剧情导演模式”：

- 玩家在主页大多数时候只点击 `继续`，由大模型根据角色状态和剧情上下文续写连续剧情。
- 当剧情进入关键节点时，由大模型生成 2-4 个行动选项。
- 行动选项也由大模型生成，但模型只给出模糊影响判断，不决定最终数值。
- 后端规则层根据角色属性、状态、功法、宝物、NPC 关系和剧情阶段计算具体数值变化。
- 前端只展示剧情、玩家可读选择和结算结果，不展示接口字段、事件 id、调试参数或模型内部判断。

这版目标是让玩家感到“这一局人生正在连续发生”，而不是每回合抽一张互不关联的事件卡。

## Current Context

当前项目已经具备适合演进的基础：

- 前端有顶部选项卡和主页视图，主页可以成为连续剧情主舞台。
- 后端已有权威状态、事件结算、突破规则和行动推进能力。
- 项目已接入大模型，并要求叙事内容保持流式输出。
- 当前已有 `storyMemory` / 天机录方向，用于记录本局摘要、近期回合、人物记忆和伏笔。
- 现有每日行动系统能作为兜底和迁移参考，但主页不再以固定行动卡为核心交互。

当前短板：

- 每日行动选项仍然带有固定池痕迹，玩家容易看到重复事件。
- 行动之间的剧情承接不足，像“回合任务列表”而不是连续人生。
- NPC 台词和事件影响还不够依赖上下文。
- 如果让模型直接决定数值，会导致寿元、境界、物品和好感度失控。

## Product Decision

采用“模型生成选择 + 后端结算数值”的混合方案。

大模型负责：

- 续写剧情正文。
- 判断是否进入关键节点。
- 生成关键节点的行动选项。
- 判断每个选项的大致影响方向。
- 判断 NPC 是否需要出场、说话或改变关系。
- 推进青云宗、雾隐秘境、寿元压力和飞升骗局伏笔。

后端负责：

- 校验模型输出结构。
- 过滤非法目标、非法方向和非法强度。
- 根据规则计算具体数值变化。
- 判断物品、功法、境界、伏笔和 NPC 关系是否允许改变。
- 写入权威 game state。
- 为天机录生成可读摘要。

前端负责：

- 展示流式剧情。
- 展示 `继续` 或模型生成的选择按钮。
- 展示玩家可理解的状态变化摘要。
- 保持选项卡导航和页面布局稳定。

## Non Goals

第一版不做以下内容：

- 不做开放世界、大地图或离线挂机。
- 不让大模型直接写入最终数值。
- 不让大模型直接授予任意高阶功法、宝物或境界。
- 不在前端暴露 JSON、prompt、内部枚举、事件 id 或调试字段。
- 不重写全部事件库；现有事件和规则可作为兜底与数值参考。
- 不做复杂战斗系统。
- 不做多存档云同步。

## Player Flow

主页流程：

```text
进入洞府主页
↓
显示当前场景、最近剧情和角色状态摘要
↓
玩家点击继续
↓
前端进入 STORY_STREAMING
↓
后端整理上下文并调用剧情导演
↓
模型流式返回剧情正文
↓
后端校验模型的模式、选项和模糊影响
↓
后端规则层结算具体状态变化
↓
前端展示本轮结果
↓
如果没有关键节点，恢复继续按钮
↓
如果出现关键节点，展示 2-4 个选择
```

选择流程：

```text
玩家点击某个剧情选择
↓
前端发送 choiceId
↓
后端读取该选择绑定的 effectHints 和叙事意图
↓
后端把选择、当前状态、近期摘要再次传给模型
↓
模型流式续写选择结果
↓
后端规则层结算具体变化
↓
历史行为和天机录更新
↓
页面回到继续或新的选择节点
```

## Frontend State Model

主页只需要三种交互状态：

```text
CONTINUE_READY
玩家可以点击继续。

STORY_STREAMING
剧情正在流式输出，按钮禁用或显示推演中。

CHOICE_PENDING
当前剧情进入关键节点，等待玩家选择。
```

显示规则：

- `CONTINUE_READY`：显示一个主按钮 `继续`。
- `STORY_STREAMING`：显示流式正文，不允许重复点击。
- `CHOICE_PENDING`：隐藏 `继续`，展示 2-4 个选择。
- 如果模型失败或结构无效，恢复 `继续` 并展示安全兜底剧情。

主页不再展示固定行动卡列表。其他选项卡仍然负责对应信息：

- `个人面板`：角色属性、状态、功法、关系、资源汇总。
- `天机录`：本局上下文、近期经历、伏笔、人物记忆、世界线索。
- `行囊`：物品、丹药、宝物、材料。
- 其他选项卡继续保持轻量，不放主页行动入口。

## LLM Director Output

模型输出包含两层内容：

1. 玩家可见内容：剧情正文和选择文本。
2. 后端内部内容：模式、选择 id、模糊影响、人物关系影响和伏笔推进。

推荐结构：

```json
{
  "scene": "你在闭关第三日察觉命火忽明忽暗，识海深处似有钟声回荡。",
  "mode": "choice",
  "npcLines": [
    {
      "npcId": "lin_shijie",
      "speaker": "林师姐",
      "line": "你近日气息不稳，莫非又听见了那道雾中钟声？"
    }
  ],
  "choices": [
    {
      "id": "inspect_lifefire",
      "text": "强行内观命火，追查异常源头",
      "tone": "risk",
      "effectHints": [
        {
          "target": "lifespan",
          "direction": "down",
          "intensity": "medium"
        },
        {
          "target": "insight",
          "direction": "up",
          "intensity": "small"
        },
        {
          "target": "foreshadow",
          "direction": "advance",
          "topic": "飞升骗局"
        }
      ]
    },
    {
      "id": "ask_lin_shijie",
      "text": "向林师姐询问雾隐秘境旧事",
      "tone": "social",
      "effectHints": [
        {
          "target": "npc_affinity",
          "npcId": "lin_shijie",
          "direction": "up",
          "intensity": "small"
        },
        {
          "target": "foreshadow",
          "direction": "reveal",
          "topic": "雾隐秘境"
        }
      ]
    }
  ],
  "memoryHints": [
    "命火异常与雾隐秘境钟声有关",
    "林师姐似乎知道旧事但有所隐瞒"
  ]
}
```

前端只展示：

- `scene`
- `npcLines.speaker`
- `npcLines.line`
- `choices.text`

前端不展示：

- `id`
- `tone`
- `effectHints`
- `memoryHints`
- `target`
- `direction`
- `intensity`

## Allowed Effect Hint Contract

后端只接受有限枚举，防止模型乱写。

### target

```text
lifespan
health
spirit
cultivation
rootBone
comprehension
fortune
willpower
lifeSeed
mind
fate
npc_affinity
item
technique
foreshadow
sect_reputation
injury
karma
```

### direction

```text
up
down
advance
reveal
consume
gain
lose
stable
```

### intensity

```text
tiny
small
medium
high
critical
```

### tone

```text
safe
risk
social
explore
cultivate
breakthrough
mystery
sect
```

校验规则：

- 未知 `target` 直接丢弃。
- 未知 `direction` 降级为 `stable`。
- 未知 `intensity` 降级为 `small`。
- `critical` 只能用于后端允许的剧情阶段。
- `item.gain` 和 `technique.gain` 必须经过掉落池或剧情授权。
- `foreshadow.advance` 必须匹配已有伏笔或允许创建的新伏笔。
- NPC 影响必须匹配已知 NPC，否则只记录为普通路人互动。

## Backend Resolution Rules

新增或扩展一个规则结算层，将 `effectHints` 转成具体状态变化。

输入：

- 当前 game state。
- 本轮 mode。
- 玩家选择的 choice。
- 模型输出的 effectHints。
- 当前 storyMemory 摘要。
- 当前可用事件、物品、功法和 NPC 数据。

输出：

- 权威状态变化 delta。
- 玩家可读结算摘要。
- 需要写入天机录的长期记忆。
- 下一步前端状态：`CONTINUE_READY` 或 `CHOICE_PENDING`。

### 数值基准

第一版使用稳定、可测试的区间：

```text
tiny: 1 个单位或极轻微变化
small: 2-4 个单位
medium: 5-8 个单位
high: 9-14 个单位
critical: 15 个单位以上或剧情级影响
```

单位按 target 映射：

- `lifespan`：年。
- `health`：气血点。
- `spirit`：灵力点。
- `cultivation`：修炼进度。
- `npc_affinity`：好感度。
- `sect_reputation`：宗门声望。
- 五维属性：第一版只允许 `tiny` 或剧情授权的 `small`。

### 属性修正

后端根据角色属性修正影响：

- 根骨高：降低气血损失和受伤概率。
- 悟性高：提高修炼、领悟、功法相关收益。
- 气运高：提高奇遇收益，降低坏结果强度。
- 心性高：降低心魔、暗伤和突破失败代价。
- 命元高：降低寿元消耗，提高续命收益。

### 状态修正

当前状态会放大或减轻结果：

- `wounded`：高风险选择额外增加气血损失。
- `lifespanPressure`：寿元相关事件更容易推进飞升骗局伏笔。
- `mindDemon`：心性不足时更容易触发负面记忆。
- `sectTrusted`：宗门相关选择收益提高。
- 拥有相关宝物：可抵消部分损失或提高收益。

### 结果封顶

必须有硬边界：

- 寿元不能低于 0。
- 气血不能低于 0。
- 灵力不能超过上限。
- 境界不能由模型直接提升。
- 功法和宝物不能重复获得。
- NPC 好感度必须在允许范围内。
- 主线伏笔不能跳过必要线索。

## Context Package

每次调用模型前，后端组装一个压缩上下文包。上下文应让模型知道足够剧情，但不能传整个原始状态。

内容：

- 角色摘要：姓名、境界、寿元、气血、灵力、五维属性。
- 当前地点：青云宗、洞府、秘境入口或具体剧情地点。
- 当前目标：修炼、突破、宗门任务、秘境线索或寿元异常。
- 近期经历：最近 8-12 条历史行为。
- 长期摘要：本局总纲和已确认真相。
- 未解伏笔：飞升骗局、雾隐秘境、命火异常等。
- NPC 关系：林师姐、玄衡长老、宗门同门等主要人物。
- 资源摘要：关键宝物、丹药、功法，不传完整调试结构。
- 本轮输入：继续推进，或玩家刚选择的选项文本。

模型提示词必须明确：

- 生成连续剧情，不要写成互不相关的任务列表。
- 可以生成选择，但选择必须与当前上下文有关。
- effectHints 只能使用允许枚举。
- 不要输出具体数值。
- 不要让玩家获得未授权的高阶奖励。
- NPC 没有剧情必要时不要强行出场。

## Streaming Strategy

用户体验要求正文尽快出现：

- 后端收到模型正文增量后直接转发给前端。
- 前端剧情区域按字或按短段刷新。
- 结构化选择可以在正文完成后稳定出现。
- 如果模型供应商只能完整返回结构，则第一版可以让正文模拟分段显示，但后端接口仍保留流式传输形态。

事件顺序：

```text
narration.delta
narration.delta
narration.delta
resolution.summary
choices.ready
state.patch
memory.updated
```

前端不依赖事件名称展示调试信息，只根据事件更新 UI。

## Story Memory And 天机录

每轮结束后，后端更新 storyMemory：

- `recentTurns`：本轮发生了什么。
- `summary`：长期摘要是否需要压缩。
- `foreshadows`：伏笔推进、揭示或新增。
- `npcMemory`：NPC 是否改变看法。
- `worldFacts`：已经确认的世界事实。

天机录展示玩家可读版本：

- 本局总纲。
- 近期经历。
- 未解伏笔。
- 已知真相。
- 人物关系。
- 重要因果。
- 当前主线目标。

天机录不展示：

- 原始 prompt。
- 原始 JSON。
- token、模型名、base_url、接口字段。
- 内部枚举名。

## API Shape

第一版优先保持现有 `/turns` 推进模型，减少重写。

建议后端支持两类输入：

```json
{
  "type": "continue"
}
```

```json
{
  "type": "choice",
  "choiceId": "inspect_lifefire"
}
```

返回或流式事件包含：

```json
{
  "mode": "continue",
  "visibleText": "你收束心神，命火渐渐平稳。",
  "statePatch": {
    "lifespan": 151,
    "health": 136
  },
  "summary": "寿元轻微消耗，命火异常伏笔推进。",
  "choices": []
}
```

或：

```json
{
  "mode": "choice",
  "visibleText": "雾中钟声再次响起，你意识到今夜必须做出选择。",
  "summary": "雾隐秘境线索出现。",
  "choices": [
    {
      "id": "follow_bell",
      "text": "循着钟声前往后山"
    },
    {
      "id": "report_to_elder",
      "text": "先向玄衡长老禀报"
    }
  ]
}
```

前端只使用 `visibleText`、`summary` 和 `choices.text`。

## Fallback Behavior

模型失败时：

- 使用本地安全剧情句子，例如“你调息片刻，今日气机虽无大变，却更清楚地感到寿元压力。”
- 不触发重大剧情跳跃。
- 不发放宝物、功法或主线真相。
- 可以结算一次基础寿元消耗。
- 保持前端可继续点击 `继续`。

结构无效时：

- 保留模型正文中可读部分。
- 丢弃非法 effectHints。
- 如果没有合法 choices，就回到 `CONTINUE_READY`。

重复剧情时：

- 后端把近期主题传入上下文，要求模型避开最近 3-5 轮已发生的核心事件。
- 后端也可以记录最近 choice tone，避免连续多轮都是同一种选择。

## First Version Scope

第一版交付以下能力：

1. 主页固定行动卡下线，改为 `继续` / `选择` 交互。
2. 后端提供连续剧情推进入口。
3. 模型根据上下文生成剧情正文。
4. 模型根据剧情生成行动选项。
5. 模型为选项提供模糊 effectHints。
6. 后端校验 effectHints。
7. 后端根据规则计算具体数值。
8. 前端流式展示剧情。
9. 历史行为记录每轮剧情和状态变化。
10. 天机录展示本局摘要、近期经历、伏笔和人物关系。
11. 模型失败时可以安全兜底。

## Testing Strategy

后端测试：

- 模型输出合法 effectHints 时，resolver 产生确定状态变化。
- 模型输出非法 target 时，非法项被丢弃。
- 模型输出具体数值时，后端忽略具体数值。
- 五维属性能修正寿元、气血、修炼和 NPC 好感变化。
- 高阶奖励没有剧情授权时不会写入状态。
- 选择节点能保存 choiceId，并在玩家选择后正确读取。
- 模型失败时返回安全兜底。

前端测试：

- `CONTINUE_READY` 只显示 `继续`。
- `STORY_STREAMING` 禁用重复点击。
- `CHOICE_PENDING` 显示模型生成的选择文本。
- 前端不渲染 id、target、direction、intensity 等内部字段。
- 天机录只显示玩家可读摘要。
- 历史行为在新剧情出现时有刷新反馈。

集成测试：

- 连续点击 `继续` 三轮，剧情上下文递进。
- 触发选择后，选择结果能更新状态。
- NPC 台词只在模型输出时出现。
- 寿元、气血、灵力不会越界。
- 流式输出路径不等待完整响应才更新正文。

## Acceptance Criteria

完成后应满足：

- 主页不再像固定任务列表，而是像连续叙事场景。
- 行动选项来自模型，并明显依赖当前剧情。
- 模型只给模糊方向，不决定最终数值。
- 后端数值变化可测试、可复现、不会失控。
- 玩家能在历史行为和天机录中看出剧情因果。
- NPC 台词不固定重复。
- 页面不出现调试字段、接口字段或模型内部枚举。
- 模型失败时游戏仍可继续。

## Open Implementation Notes

实现计划应优先拆成小任务：

1. 定义 effectHints schema 和校验测试。
2. 扩展后端 resolver，把模糊影响转成状态变化。
3. 新增剧情导演 prompt 和上下文组装。
4. 新增 continue / choice 推进入口。
5. 改造主页 UI 状态机。
6. 改造历史行为和天机录展示。
7. 增加流式和兜底测试。

每个任务都应能单独测试，避免一个 agent 长时间卡住。
