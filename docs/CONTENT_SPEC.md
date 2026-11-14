# 内容生产规范（多剧本）

> 这份文档是「AI 批量写剧本」的合同。给模型写提示词时，把 `npm run prompt` 生成的
> `prompts/batch-XX-*.md` 丢过去即可；这里是人工维护的版本，用于查漏。

## 1. 文件结构

```
src/data/stories/<id>/config.json   世界观参数、地点、NPC、结局表（每个剧本一个，策划独占）
src/data/stories/<id>/packs/*.json  事件包，一包 8~15 个事件（一条支线 / 一个地点 / 一次 AI 批次）
src/data/stories/<id>/events.json   构建产物，勿手改
src/data/stories/index.json         剧本清单（封面 / 标题 / 题材标签），决定选择页显示什么
content/zh|en/<id>/*.json           分语言文案，文件名必须和 pack 同名
scripts/build-events.mjs config + packs → events.json
scripts/build-content.mjs 文案合并 + 完整性校验（缺 key / TODO 占位符直接中断构建）
scripts/lint-events.mjs  死条件、断链、数值越界、覆盖度体检
scripts/simulate.mjs     五种策略各跑 N 局，输出结局分布与事件覆盖率
```

一条流水线：

```bash
npm run prompt -- --story sector07 --theme "隔离营清算" --loc gate --npc chen --count 10
# 把提示词发给模型，得到 JSON
npm run batch -- ./batch.json        # 校验并落成新 pack + 文案骨架
npm run content                      # 合并 + 校验（TODO 会报错）
npm run lint                         # 静态体检（两套剧本）
npm run sim -- 2000                  # 数值回归（两套剧本）
# 只跑其中一个：加 --story emperor
```

## 2. 事件字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | `<loc>_<主题>`，全局唯一。改名等于删档兼容，别随意改 |
| `loc` | `gate\|pub\|medbay\|market\|dorm` | 触发地点 |
| `npc` | string | 可选。关联 `config.npcs[].id`，事件卡会显示头像与姓名 |
| `art` | string | 可选。`art/ev-xxx.jpg`，事件卡顶部插画 |
| `weight` | number | 默认 1。越大越常出；一次性事件里 8~14 属正常 |
| `priority` | number | 80~95。有 priority 的事件会**压过所有普通事件强制触发**，只用于因果链收口 |
| `once` | bool | 一次性。绝大多数事件都该是 true |
| `repeatable` | bool | 兜底池。一个地点至少 2 个，防止行动点打空 |
| `cooldown` | number | 可重复事件的冷却天数 |
| `chain` | bool | UI 打「因果连锁」标记，且要求必须有 `flags`/`dayMin` 前置 |
| `cond` | object | 见下 |

### cond（声明式条件，全部为「与」）

```jsonc
{
  "flags":    ["a", "b"],   // 必须全部为 true
  "notFlags": ["c"],        // 必须全部为 false
  "anyFlags": ["d", "e"],   // 至少一个为 true
  "dayMin": 7, "dayMax": 12,
  "statMin": { "money": 40 }, "statMax": { "sanity": 50 },
  "moralityMin": 0, "moralityMax": -2,
  "chance": 0.4             // 每次抽取掷一次
}
```

## 3. 选项字段

| 字段 | 说明 |
|---|---|
| `id` | 事件内唯一 |
| `effects` | `{ health, sanity, money, favor }`，可正可负 |
| `morality` | -3 ~ +3。只影响结局判定，不显示为数值 |
| `requires` | 锁定条件；**有 requires 就必须有 `req` 文案**，否则玩家只看到一个灰按钮 |
| `setFlags` | 设置 flag，可写 `false` 用于「撤销」 |
| `roll` | 赌博分支 `{ chance, win:{effects,...}, lose:{...} }` |
| `tone` | `good\|neutral\|dark`，只影响按钮悬停色 |
| `key` | 计入结局卡「关键抉择」，同时豁免单选项数值预算 |

## 4. Flag 命名与生命周期

- 命名：`过去式动词_对象`，如 `saved_mother`、`rota_stolen`、`samples_lost`。
- 收口：`xxx_done` 用来「关门」，防止同一事件反复触发。
- 每写一个新 flag，必须回答：**谁会读它？** 如果答案是「结局」，写进 `config.endings[].cond`；
  如果只是记录玩家做过什么，写进 pack 顶层的 `bookkeeping` 数组，否则 `npm run lint` 会报「挖了坑没填」。
- 反向同样成立：`cond` 里读到的 flag 必须有人会设置，否则报「死条件」——这类事件永远不会出现，
  是整个流水线里最容易漏、也最难靠试玩发现的问题。

## 5. 数值预算

| 项目 | 上限 |
|---|---|
| 单选项 money | ±55（`key:true` 的 pivots 不受限） |
| 单选项 sanity | ±30 |
| 单选项 health | ±45 |
| 单选项 favor | ±35 |
| 单选项 morality | ±3 |

经济基线（18 天）：

- 船票 220，人脉替代线 55
- 配给费 8 起，每 6 天 +2（D13 起 12，封顶 12）
- 执勤津贴 12/天 —— 刚好与后期配给持平
- 结论：**只干活饿不死但也买不起票（走人脉线），想买票必须脏手（走金钱线）**。两条线都要能通到结局。

## 6. 文案要求

1. 描述 60~110 字，冷、具体、有物理细节。禁止「命运的齿轮开始转动」这类解说腔。
2. 每个结果必须写出代价，不能只有收益。
3. 不要写死票价、配给费的具体数字。
4. 英文是重写不是直译：`Sector`、`cordon`、`quarantine control` 这些词要统一。
5. 同一个 NPC 的语气要跨事件一致：瑞秋短句、陈医生用完整的医学表述、伊莱爱用数字、娜迪亚句子很轻。

## 7. 结局表

`config.endings` 是**顺序匹配，第一个命中生效**，最后一条必须无 `cond` 作兜底。
把最稀有、最具体的放前面，最泛的放后面。新增结局必须同时补 `content/*/core.json` 的 `endings.<id>`。

## 8. 上线前的三个门

```bash
npm run content   # 少一条翻译 / 留下一个 TODO 就中断
npm run lint      # 死条件、断链、数值越界、地点覆盖不足
npm run sim 3000  # 结局分布与 95% 以上事件覆盖率
```

`sim` 看三个数：
- **早夭率**（3 天内结束）应为 0；高于 5% 说明有必死开局。
- **事件覆盖率**应 ≥ 95%；低于 90% 说明某些事件的条件写太窄或被高优先级事件长期压制。
- **单一结局占比**：任一策略下超过 85% 就要检查是不是判定顺序把它前面的结局全吃掉了。
