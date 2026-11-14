# SECTOR-07 剧本批次任务：未指定主题

你是这款文字生存游戏的内容编剧。游戏已完成 19 个事件、9 个结局，
现在需要你写 **8 个新事件**，用 JSON 表达，追加到现有事件库。

## 世界观（不可改动）

先帝在秋猎途中暴崩，没有留下遗诏。你十九岁，坐上那把还没坐热的椅子。太后垂帘，首辅拟旨，边将在外拥兵十万。十八个月后是亲政大典——在那之前，你得让这座朝堂认你。

三幕结构：D1+ regency → D7+ faction → D13+ reckoning
玩家总时长 18 天 × 3 行动点 = 54 次遭遇。

## 现有内容盘点

| 地点 | 事件数 | 一次性 | 已用最早天数 |
|---|---|---|---|
| court | 5 | 5 | 4,7,10,15 |
| study | 4 | 3 | 6,8,9 |
| vault | 4 | 4 | 3,5,7,9 |
| frontier | 3 | 3 | 6,11,14 |
| chamber | 3 | 2 | 5,12 |

**尚未闭合的线索（flag 已埋但没被任何事件/结局读取）**：
（无）

**NPC 支线**：shen（met_shen / shen_ally / shen_betrayed）、dowager（met_dowager / dowager_ally / dowager_betrayed）、huo（met_huo / huo_ally / huo_betrayed）、wang（met_wang / wang_ally / wang_betrayed）

**现有事件 id（严禁重名）**：
court_first_court, court_salt_tax, court_impeach_huo, court_empty_seat, court_grand_audience, study_memorial_stack, study_forged_edict, study_secret_memorial, study_history, vault_empty, vault_famine, vault_merchant, vault_eunuch_cut, frontier_tribute, frontier_general_ask, frontier_defect, chamber_dowager, chamber_insomnia, chamber_poison

## 数值预算（硬性）

单选项最多：money ±60、sanity ±30、health ±45、favor ±35、morality ±3。
一局玩家大约会遭遇 49 次；这批 8 个事件的金钱净收益总和不要超过 96 信用点。
船票 240 信用点（或人脉 ≥ 60），配给 8 起每 6 天 +2，执勤津贴 10。

## 字段规范

```jsonc
{
  "id": "gate_something",          // 必须 <loc>_<主题>，全局唯一
  "loc": "gate",                    // gate | pub | medbay | market | dorm
  "npc": "chen",                    // 可选，涉及哪个 NPC
  "weight": 10,                     // 可选，默认 1，越大越常出
  "priority": 0,                    // 因果链强制触发用 80~95，普通事件不写
  "once": true,                     // 一次性事件（绝大多数）
  "chain": true,                    // 因果链，UI 会打标记
  "cond": {                         // 触发条件，全部是「与」关系
    "flags": ["serum_route"],       // 这些 flag 必须为 true
    "notFlags": ["x_done"],         // 这些必须为 false
    "dayMin": 7, "dayMax": 12,
    "statMin": { "money": 40 }, "statMax": { "sanity": 50 },
    "moralityMin": 0, "chance": 0.4
  },
  "choices": [                      // 2~3 个，必须互相有取舍
    {
      "id": "take_it",
      "effects": { "money": -20, "sanity": 10 },
      "morality": 2,                // -3 ~ +3
      "requires": { "statMin": { "money": 20 } },  // 有 requires 必须配 req 文案
      "setFlags": { "took_it": true },
      "tone": "good",               // good | neutral | dark
      "key": true                   // 计入结局卡的关键抉择
    }
  ]
}
```

## 文案要求

1. 描述 60~110 字，冷、具体、有物理细节（气味、声音、温度），不要形容词堆砌。
2. 每个选项的结果必须写出「代价」，不能只写「你成功了」。
3. 不要出现「全球 9.2% 玩家」「命运的选择」这类解说腔。
4. 文案里不要写死票价/配给费的具体数字，数值会调。
5. 中文与英文同时输出，英文要母语化重写，不要直译。

## 输出格式

先给一个 JSON 代码块（数组，8 个事件），再给一个 JSON 代码块（中文文案），再给一个（英文文案）。
文案对象的 key 是事件 id，结构：

```json
{
  "gate_something": {
    "title": "标题",
    "desc": "描述",
    "choices": { "take_it": { "text": "选项文字", "req": "锁定原因（仅 requires 时）", "outcome": "结果" } }
  }
}
```

## 本次任务

- 主题：**未指定主题**
- 地点：**frontier**（只能写这个地点的场景）
- 数量：8 个，其中至少 2 个要消费上面「尚未闭合的线索」里的 flag。
- 至少 1 个事件必须在 D13 之后触发（第三幕目前最薄）。
