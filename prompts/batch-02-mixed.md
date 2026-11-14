# SECTOR-07 剧本批次任务：未指定主题

你是这款文字生存游戏的内容编剧。游戏已完成 88 个事件、16 个结局，
现在需要你写 **10 个新事件**，用 JSON 表达，追加到现有事件库。

## 世界观（不可改动）

灰烬症越过第三道封锁线已经第九十天。你是 7 号闸门的检疫员，手里一枚章，决定谁能过去。最后一班撤离潜艇在十八天后离港，四百个座位，闸门外有六万人。

三幕结构：D1+ gate → D7+ fault → D13+ list
玩家总时长 18 天 × 3 行动点 = 54 次遭遇。

## 现有内容盘点

| 地点 | 事件数 | 一次性 | 已用最早天数 |
|---|---|---|---|
| gate | 25 | 22 | 2,3,4,5,6,7,8,9,10,13,14,16,17 |
| pub | 18 | 16 | 2,5,6,7,8,10,12,13,14,15 |
| medbay | 14 | 12 | 2,3,4,6,9,10,11,14,15,16 |
| market | 16 | 13 | 2,5,6,8,10,12,15 |
| dorm | 15 | 13 | 2,3,6,7,8,10,12,13,16 |

**尚未闭合的线索（flag 已埋但没被任何事件/结局读取）**：
（无）

**NPC 支线**：rachel（met_rachel / rachel_ally / rachel_betrayed）、chen（met_chen / chen_ally / chen_betrayed）、ilya（met_ilya / ilya_ally / ilya_betrayed）、nadia（met_nadia / nadia_ally / nadia_betrayed）

**现有事件 id（严禁重名）**：
gate_mother_child, gate_mother_revenge, gate_pharma_convoy, gate_pharma_audit, gate_inspector, gate_deserter, gate_body_cart, gate_riot, gate_children, gate_new_order, gate_bribe_small, gate_quiet_night, gate_overtime, pub_rachel_deal, pub_mechanic_gift, pub_rachel_test, pub_ticket_cash, pub_bounty, pub_rachel_farewell, pub_drunk, pub_bet, pub_song, medbay_routine, medbay_triage, medbay_theft, medbay_doctor, medbay_painkiller, medbay_last_patient, market_forger, market_organs, market_pawn_gun, market_thief, market_fake_medicine, market_dice, market_rumor, market_ration, dorm_rest, dorm_radio, dorm_nightmare, dorm_journal, dorm_neighbor, dorm_mirror, dorm_letter, gate_queues, gate_deserter_return, gate_guard_grudge, gate_audit_return, gate_rifle, gate_lockdown_blame, gate_tunnel, gate_press, gate_evac_list, gate_last_night, gate_list_use, gate_tunnel_escape, pub_rachel_trust, pub_rachel_crew, pub_rachel_offer, pub_rachel_arrest, pub_smuggle_run, pub_bounty_after, pub_rota_use, pub_list_rumor, pub_last_smoke_variant, medbay_chen_intro, medbay_chen_raid, medbay_chen_daughter, medbay_trial, medbay_chen_choice, medbay_ward_round, medbay_quarantine_break, medbay_stay_with_chen, market_ilya_intro, market_ilya_papers, market_ilya_arrest, market_ilya_debt, market_ilya_choice, market_militia, market_child_return, market_fence_seal, dorm_nadia_intro, dorm_nadia_parts, dorm_nadia_broadcast, dorm_nadia_raid, dorm_nadia_choice, dorm_guard_search, dorm_letter_reply, dorm_rooftop

## 数值预算（硬性）

单选项最多：money ±60、sanity ±30、health ±45、favor ±35、morality ±3。
一局玩家大约会遭遇 49 次；这批 10 个事件的金钱净收益总和不要超过 120 信用点。
船票 220 信用点（或人脉 ≥ 55），配给 8 起每 6 天 +2，执勤津贴 12。

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

先给一个 JSON 代码块（数组，10 个事件），再给一个 JSON 代码块（中文文案），再给一个（英文文案）。
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
- 数量：10 个，其中至少 2 个要消费上面「尚未闭合的线索」里的 flag。
- 至少 1 个事件必须在 D13 之后触发（第三幕目前最薄）。
