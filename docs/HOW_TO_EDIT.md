# 怎么改剧本（手改版）

给「想自己动笔」的人看。三分钟能上手，不用读代码。

---

## 一、加一个事件，要动 3 个文件

| 文件 | 放什么 | 必填 |
|---|---|---|
| `src/data/stories/<剧本>/packs/NN-<地点>.json` | 事件的结构：什么时候出现、有哪些选项、加减什么数值、设什么 flag | ✅ |
| `content/zh/<剧本>/<pack名>.json` | 中文：标题、正文、每个选项的文字和结果 | ✅ |
| `content/en/<剧本>/<pack名>.json` | 英文：同上 | ✅（缺了构建会失败） |

`<剧本>` 就是目录名：`sector07`（7 号闸门）或 `emperor`（大靖）。两个剧本的 id、地点、数值命名完全独立，改一个不会影响另一个。

**文件名要对上**：pack 叫 `10-gate-act2.json`，文案就叫 `content/zh/arc-gate-act2.json`（名字不必严格一致，只要在 `content/{lang}/` 下且不是 `core.json`，就会被当作事件文案合并进去）。现成的对照关系：

**SECTOR-07（`stories/sector07`）**

| pack（结构） | 文案（中/英） | 内容 |
|---|---|---|
| `01-gate.json` | `arc-gate.json` | 闸门·第一幕 |
| `02-pub.json` | `arc-pub.json` | 酒吧·第一幕 |
| `03-medbay.json` | `arc-medbay.json` | 医疗站·第一幕 |
| `04-market.json` | `arc-market.json` | 黑市·第一幕 |
| `05-dorm.json` | `arc-dorm.json` | 宿舍·第一幕 |
| `10-gate-act2.json` | `arc-gate-act2.json` | 闸门·第二三幕 |
| `11-pub-rachel.json` | `arc-pub-rachel.json` | 瑞秋线 |
| `12-medbay-chen.json` | `arc-medbay-chen.json` | 陈静线 |
| `13-market-ilya.json` | `arc-market-ilya.json` | 伊莱线 |
| `14-dorm-nadia.json` | `arc-dorm-nadia.json` | 娜迪亚线 |

**大靖（`stories/emperor`）**

| pack（结构） | 文案（中/英） | 内容 |
|---|---|---|
| `01-court.json` | `arc-court.json` | 太极殿 + 御书房 |
| `02-realm.json` | `arc-realm.json` | 内库 + 北门城楼 + 寝宫（首轮） |
| `03-dowager-shadow.json` | `arc-court.json` / `arc-realm.json` | 毒羹 / 血诏 / 水榭 |
| `04-frontier-crisis.json` | `arc-realm.json` | 黑市 / 雪灾 |
| `05-court-daily.json` | `arc-court.json` | 考成 / 巡库（可重复） |
| `06-frontier-watch.json` | `arc-frontier-watch.json` | 北门城楼·边关（9 个） |
| `07-chamber-night.json` | `arc-chamber-night.json` | 寝宫·深夜（8 个） |

> 想加新地点的事件，直接往对应 loc 的 pack 里加就行，**不要新建 pack**，除非是新的角色线。

---

## 二、抄这个模板

### 1) 结构 → `src/data/stories/sector07/packs/06-market-extra.json`（新建时）

```json
{
  "pack": "06-market-extra",
  "loc": "market",
  "bookkeeping": [],
  "events": [
    {
      "id": "market_ration_riot",
      "loc": "market",
      "npc": "ilya",
      "once": true,
      "cooldown": 0,
      "cond": { "dayMin": 8, "dayMax": 14, "notFlags": ["riot_done"] },
      "choices": [
        {
          "id": "help",
          "tone": "good",
          "effects": { "health": -8, "favor": 12, "sanity": 5 },
          "morality": 2,
          "setFlags": { "riot_done": true, "ilya_ally": true },
          "key": true
        },
        {
          "id": "walk_away",
          "tone": "neutral",
          "effects": { "sanity": -4 },
          "setFlags": { "riot_done": true }
        },
        {
          "id": "report",
          "tone": "dark",
          "effects": { "money": 45, "favor": -15 },
          "morality": -2,
          "setFlags": { "riot_done": true, "ilya_betrayed": true }
        }
      ]
    }
  ]
}
```

### 2) 中文 → `content/zh/sector07/arc-market-extra.json`

```json
{
  "market_ration_riot": {
    "title": "配给点塌了",
    "desc": "队列在第七分钟失控。铁栅栏被推倒，两箱合成食物撒进泥里。伊莱站在台阶上算账，声音很平：“踩死三个，捡走四十份。这买卖划算。”",
    "choices": {
      "help": {
        "text": "把摔倒的人拉出来",
        "outcome": "你拖出两个，第三个被压在栅栏下面，已经不动了。你手上全是别人的血，但队伍里有人开始帮你抬。"
      },
      "walk_away": {
        "text": "不管，往回走",
        "outcome": "你挤出人群。身后有人在喊编号，喊了十几遍，最后没声了。你今晚没吃东西，也不觉得饿。"
      },
      "report": {
        "text": "把带头的人报给检疫处",
        "outcome": "四十五信用点，当天到账。第二天市场清空了三分之一，伊莱把摊子挪到了你看不见的巷子里。"
      }
    }
  }
}
```

### 3) 英文 → `content/en/sector07/arc-market-extra.json`

```json
{
  "market_ration_riot": {
    "title": "The ration point comes down",
    "desc": "The line breaks at minute seven. The barrier goes over, two crates of synth food spill into the mud. Ilya stands on the step doing arithmetic, flat-voiced: “Three trampled, forty portions lifted. That's a good trade.”",
    "choices": {
      "help": {
        "text": "Pull the fallen out",
        "outcome": "You get two out. The third is under the barrier and isn't moving. Your hands are covered in someone else's blood, but people in the line start helping you lift."
      },
      "walk_away": {
        "text": "Leave it, walk back",
        "outcome": "You push out of the crowd. Behind you someone shouts a number, a dozen times, then stops. You don't eat tonight and don't feel hungry."
      },
      "report": {
        "text": "Report the ringleader to quarantine control",
        "outcome": "Forty-five credits, same day. By morning a third of the market is empty and Ilya has moved his stall to an alley you can't see."
      }
    }
  }
}
```

---

## 三、字段速查

### 事件（`stories/<剧本>/packs/*.json` 里每个 `events[]`）

| 字段 | 含义 | 常用值 |
|---|---|---|
| `id` | 全局唯一，建议 `<地点>_<主题>` | `market_ration_riot` |
| `loc` | 出现在哪个地点 | `gate` / `pub` / `medbay` / `market` / `dorm` |
| `npc` | 关联 NPC，会显示头像 | `rachel` / `chen` / `ilya` / `nadia` |
| `art` | 插画路径 | `art/ev-list.jpg` |
| `priority` | 越大越先被抽中，**因果链必用** | 普通 1~10，链式 80+ |
| `weight` | 同优先级内的权重，越大越常见 | 默认 10 |
| `once` | 全局只出现一次 | `true` |
| `cooldown` | 触发后 N 天内不再出现 | `3` |
| `repeatable` | 兜底池，可反复出现（打工/闲聊用） | `true` |
| `chain` | UI 上打「连锁」标记 | `true` |
| `cond` | 触发条件，见下 | |

### 条件 `cond`（全部是「并且」，不写就是不限制）

```json
"cond": {
  "flags":    ["took_gear"],          // 这些 flag 必须都为 true
  "notFlags": ["gate_opened"],        // 这些必须都为 false
  "anyFlags": ["chen_ally", "chen_betrayed"],  // 至少一个 true
  "dayMin": 7, "dayMax": 12,          // 天数区间
  "statMin": { "sanity": 40 },        // 数值下限
  "statMax": { "money": 100 },        // 数值上限
  "moralityMin": -2, "moralityMax": 3,// 道德区间
  "chance": 0.35                      // 每次抽取掷一次骰子
}
```

### 选项 `choices[]`

| 字段 | 含义 |
|---|---|
| `id` | 在本事件内唯一，文案按这个 id 对应 |
| `effects` | `{"health":-10,"sanity":5,"money":30,"favor":8}` |
| `morality` | 道德加减，−3 ~ +3，进结局判定 |
| `setFlags` | `{"xxx_done": true}`，给后续事件用 |
| `requires` | 选项锁定条件，不满足会置灰并显示 `req` 文案 |
| `roll` | 随机结算：`{"chance":0.5,"win":{...},"lose":{...}}`，此时 `effects` 失效 |
| `tone` | `good` / `neutral` / `dark`，只影响 hover 颜色 |
| `key` | `true` 表示计入结局卡的「关键抉择」（一局最多显示 4 条） |

### 选项有 `requires` / `roll` 时的文案要多写一个键

```json
"choices": {
  "bribe": {
    "text": "塞钱",
    "req": "需要 60 信用点",      // requires 不满足时显示这句
    "outcome": "普通结果"
  },
  "run": {
    "text": "跑",
    "win": "你冲过了闸口。",       // roll 成功
    "lose": "你被按在地上。"       // roll 失败
  }
}
```

---

## 四、写 flag 的三条铁律

1. **命名**：`<主题>_<状态>`，例：`riot_done`、`ilya_ally`、`list_leaked`。别用 `flag1`。
2. **设了就要有人读**。`lint` 会把「设了但没人读」的 flag 报成警告。如果它只是记录性质（结局文案里不提），把它写进该 pack 的 `bookkeeping` 数组：
   ```json
   { "pack": "...", "loc": "...", "bookkeeping": ["riot_done"], "events": [...] }
   ```
3. **一次性事件一定要用 `notFlags` 关掉自己**，否则同一个事件会在同一局里反复出现：
   ```json
   "cond": { "notFlags": ["riot_done"] }
   ```

---

## 五、改完怎么验

```bash
npm run content                  # 合并两个剧本的 events.json + 校验中英 key（缺 key 直接停）
npm run lint                     # 两个剧本都体检
npm run lint:emperor             # 只体检大靖
npm run sim                      # 两个剧本都仿真
npm run prompt -- --story emperor --loc court --count 10   # 给大靖生成写稿提示词
```

`npm run dev` 会自动先跑 `content`。改完 pack 后如果浏览器没更新，手动敲一次 `npm run content` 再刷新。

**最常见的四个报错**

| 报错 | 原因 | 怎么修 |
|---|---|---|
| `[zh] events.xxx.title missing` | 文案漏了某个键 | 补上，或检查 id 是否写错 |
| `duplicate event id: xxx` | id 撞了 | 换个 id |
| `choice "yyy" of xxx has no translation` | 选项文案的 key 和结构里的 id 不一致 | 对齐 id |
| `flag "zzz" is set but never read` | 孤儿 flag | 补一个读它的事件，或写进 `bookkeeping` |

---

## 六、往哪儿加，看这两个数

`npm run lint` 会打印每个地点的事件数：

**SECTOR-07**

| 地点 | 现有事件 | 建议 |
|---|---|---|
| gate | 25 | 够了，别再堆 |
| pub | 18 | 可以补 3~5 个日常向的 |
| medbay | 14 | **最薄，优先补** |
| market | 16 | 可以补 2~3 个 |
| dorm | 15 | 可以补，适合放「夜里想事情」的独白型事件 |

**大靖**

| 地点 | 现有事件 | 建议 |
|---|---|---|
| court | 12 | 够了 |
| study | 16 | 够了 |
| vault | 11 | 够了 |
| frontier | 14 | 够了 |
| chamber | 13 | 够了 |

大靖目前 66 个事件 / 186 个选项 / 9 个结局。一局最多 54 次遭遇，可一次性事件 62 个，
也就是说单周目必然看不到全部内容（这是设计，不是缺陷）。再往上加的价值不在「够不够看」，
而在「每条线的分支能不能互相咬住」——新事件优先挂 `cond.flags` 去接已有 flag
（例如 `land_surveyed → 田册`、`dikes_ignored → 决口`、`read_banned → 写书的人`），
比平铺一层没有因果的日常更划算。

**加事件会稀释经济**：一局 54 次遭遇是固定的，事件池从 43 涨到 66 之后，赚钱分支被摊薄，
random 策略的终局钱从 168 掉到 98、moral 线饿死率从 6.8% 涨到 43.5%。所以每次批量加事件后
都要跑一次 `npm run sim`，如果饿死率上去了，优先调 `config.json` 的 `dailyWage`（按月发钱，
不随事件数波动），而不是给单个事件加钱——后者会让「只挑赚钱选项」的策略再次失控。
这次把 `dailyWage` 从 10 调到 13 之后，random 回到 140 钱 / 饿死 1.0%，moral 线 0.6%，
zenith 3.4%。

还有一条经验：一局最多 54 次遭遇，一次性事件 76 个 —— 意味着**单周目必然看不到一半内容**。所以「感觉少」更可能是某个地点反复出同一个事件，而不是总量不够。先跑 `npm run sim`，看 `事件覆盖` 那一行的比例；如果某个地点重复率高，往那个地点补事件比全局加更有效。

---

## 七、再加一个剧本（从 2 个到 N 个）

**引擎不需要改一行代码。** `reducer(state, action, data)` 的第三个参数就是"当前剧本"，
所以加剧本是纯数据操作，五个步骤：

### 1. 建配置 `src/data/stories/<id>/config.json`

这是剧本的"宪法"，决定它和别的剧本哪儿不一样：

```json
{
  "version": 2,
  "config": {
    "maxDays": 18,              // 一共多少回合
    "actionsPerDay": 3,         // 每回合几个行动点
    "ticketCost": 240,          // 目标金额（只用于 HUD 提示文案，不参与判定）
    "ticketFavor": 60,          // 目标声望（同上）
    "dailyUpkeep": 8,           // 每回合固定支出
    "dailyWage": 10,            // 每回合固定收入
    "upkeepRampEvery": 6,       // 支出每 N 回合上涨一次
    "upkeepRampAdd": 2,
    "dailySanityRestore": 6,    // 每回合自然回复的"理智"
    "startStats": { "health": 100, "sanity": 75, "money": 45, "favor": 12 },
    "statCeiling": 100
  },
  "locations": [...],
  "npcs": [...],
  "acts": [...],
  "endings": [...]
}
```

### 2. 建 pack `src/data/stories/<id>/packs/*.json`

格式与 SECTOR-07 完全一致（见上文模板）。

### 3. 写文案 `content/zh/<id>/` 和 `content/en/<id>/`

- `core.json`：**必须包含全部 UI 文案**。因为界面文字是按剧本加载的，
  新剧本漏掉 `ui.action.start` 这种 key，界面上就会直接显示原始 key。
  最省事的做法是把 `content/zh/sector07/core.json` 复制过来再改词。
- `arc-*.json`：事件文案。

### 4. 注册到 `src/data/stories/index.json`

```json
{
  "id": "yourstory",
  "order": 3,
  "cover": "art/cover-yourstory.jpg",
  "accent": "violet",
  "tag": { "zh": "题材标签", "en": "Genre tag" },
  "title": { "zh": "主标题 · 副标题", "en": "MAIN · Subtitle" },
  "tagline": { "zh": "一句话钩子", "en": "One-line hook" }
}
```

`title` 里的 `·` 是分隔符：前半进大字号，后半进小字。
`cover` 指向 `public/` 下的图，**没有也能跑**（会退回成标题首字的印章底）。

### 5. 跑一遍

```bash
npm run content && npm run lint && npm run sim
```

打开游戏，封面页底部会出现"切换剧本"，里面就有新剧本了。

> **只对外发一个剧本时**：把 `src/data/story.ts` 的 `PUBLIC_STORY_ID` 设成那个剧本的 id。
> 封面页的「切换剧本」整行消失，线上 `?story=xxx` 和上次选择也都不再生效；
> 开发环境仍放行 `?story=xxx`，被藏起来的那个还能继续改。设回 `null` 就恢复多剧本。

### 数值三条经验

1. **四个数值是共用的轴**（health / sanity / money / favor），换的是叫法不是机制。
   大靖里它们是 龙体 / 心力 / 国库 / 朝望。
2. **三个结局 id 必须叫 `ending_dead` / `ending_mad` / `ending_starved`** ——
   引擎在这三种死法上写死了 id，改名会导致结算页拿到错误的结局文案。
3. **`dailySanityRestore` 是给"没有休息地点"的题材准备的**。
   SECTOR-07 靠宿舍和医疗站回理智，所以它是 0；大靖的损耗是结构性的，所以给了 6。
   不加这个，任何消耗理智的选项多的剧本都会 100% 走向"疯掉"结局。

---

## 八、只看某一个事件（校对长线剧情用）

第 15 天以后的高潮事件，正常玩一局要半小时才能撞到，改一次文案就看一次是不可能的。
开发模式下有三个深链，直接跳到你写的那一条：

```
?story=emperor&ev=frontier_siege&day=16          # 直接进入指定事件
?story=emperor&ev=frontier_siege&pre=wall_repaired,huo_oath   # 预置 flag（用来看"解锁后"的样子）
?story=emperor&end=ending_emperor_beloved        # 直接看某个结局页
```

`?pre=` 里用逗号分隔，只是把 flag 置成 true，不会触发任何事件。所以：

- 想看**锁定态**：不要带 `pre`，或者故意只带一部分 → 选项会置灰并显示 `.req` 里的原因
- 想看**解锁态**：把 `requires` 里要求的 flag 全写进 `pre`

三个深链都只在 `npm run dev` 下生效，`npm run build` 出来的包里会被整段摇掉，不会把剧透带上线。

> 注意：headless 截图偶尔会拍到弹窗淡入动画的第 0 帧（看起来像没打开）。
> 判断事件到底有没有渲染，用 `--dump-dom` 搜标题文字，比看截图可靠。

---

## 九、过场、数值反馈与因果提示

这三层都是纯 UI，不碰事件数据；但**两个地方需要文案，一个地方有写作前提**。

### 1. 换日 / 换月的那一拍（`ui.dayCard`）

每次进入新的第 N 天，地图区会压下一层黑幕，显示「第 N 月 + 本月账面」，
1.3 秒后自动淡出，点一下也能跳过。右上角「不再显示过场」会写进本地 prefs，之后不再弹。

```json
"dayCard": {
  "day": "第 {day} 月",        // 单位跟着剧本走：天/月/年都行
  "income": "税银 +{n}",       // 对应 config.dailyWage；为 0 时这一行不显示
  "spend": "内廷 -{n}",        // 对应 config.dailyUpkeep（含涨价）
  "hint": "轻触继续",
  "off": "不再显示过场"
}
```

这层**只盖地图、不盖 HUD**。因为 HUD 上此刻正在做数字滚动和 `+13 / -14` 的上浮，
盖住就等于把反馈吃掉了。

### 2. 幕间卡（`ui.interlude.<幕id>`）

`config.acts` 里每跨一幕（第 2 幕、第 3 幕），会插一张全屏卡：幕名 + 一句题记，点一下继续。

```json
"interlude": {
  "faction": "第七个月，帘后那把椅子空了半寸。他们开始试着不看你。",
  "reckoning": "第十三个月。所有人都知道你要做什么了，只有你还没决定。"
}
```

**key 必须等于 `config.acts[].id`**（大靖是 `faction` / `reckoning`，SECTOR-07 是 `fault` / `list`）。
新增一幕就必须补一条；漏了不会崩，只是那张卡上只有幕名没有题记。

第一幕不用写 —— 开局不插卡。

### 3. 因果来源条（自动推导，零配置）

带 `chain: true` 的事件，卡片顶部会多一行「起于第 4 月 · 少掉的四成田」。

这行字是引擎从 `usedEvents` 反推出来的：顺着事件的 `cond.flags` 往回找，看哪个已触发事件的
`setFlags` 里出现过这个 flag，取最早的那一天。**所以有写作前提**：

- ✅ 因果链用 flag 咬：`"cond": { "flags": ["land_surveyed"] }` → 能推出起点
- ❌ 只靠 `dayMin` 排期：`"cond": { "dayMin": 12 }` → 推不出来，顶部就只有「因果连锁」徽章，没有来源行

推不出来不会报错，是设计上的优雅降级。想让玩家看见"这事是几月埋下的"，就得让前后两条事件
共享一个 flag。

### 4. 属性变动的反馈

- 事件结果卡：每条增减错开 60ms 落下，前面带 `↑ / ↓` 箭头（方向优先于颜色，避免"掉钱也是绿的"）
- HUD：数字在 320ms 内滚到新值，旁边浮出 `+13 / -5`；掉值时整格抖一下；
  数值过低时标签前亮起一个朱点缓慢呼吸（大靖：龙体/心力/朝望 < 26，国库 < 30）

这三样都由 `state.stats` 的变化自动触发，不需要在事件里写任何东西。

> 动效全部只改 `opacity` / `transform`，没有引入动画库（主包只涨了约 6KB）。
> 系统开了「减少动态效果」时会整体降级成静帧。

---

## 十、风险选项（`roll`）：怎么加一个「赌一把」

引擎本来就有双分支结算，只是大靖一开始一个都没用。现在有 4 个：

| 事件 | 选项 | 赌什么 | 胜算 |
|---|---|---|---|
| 禁军换防 `court_guard_rotation` | `rush_gate` 今夜就去东门 | 抢在换防之前 | 0.55 |
| 薄了一线的钱 `vault_private_mint` | `stake_it_out` 放三天线 | 钓出背后的人 | 0.45 |
| 带着刀的人 `chamber_wang_knife` | `turn_back` 把后背留给他 | 他会不会动手 | 0.50 |
| 城下 `frontier_siege` | `ride_out` 单骑出城 | 谈判能不能成 | 0.40 |

### 数据怎么写

```json
{
  "id": "rush_gate",
  "tone": "dark",
  "roll": {
    "chance": 0.55,
    "win":  { "effects": { "money": -8, "favor": 11, "health": -5 }, "setFlags": { "rotation_done": true } },
    "lose": { "effects": { "money": -8, "health": -15, "favor": -7 }, "setFlags": { "rotation_done": true } }
  },
  "key": true
}
```

- 有 `roll` 时 `effects` 字段**完全失效**，数值只能写在两个分支里。想在两边都扣的钱（比如养死士的八万两）就在两个分支里各写一遍。
- `morality` 同理，分别写在 `win` / `lose` 里。
- 文案：`text` + `win` + `lose`，**不需要 `outcome`**（`build-content` 已经按 `roll` 分支校验）。
- `setFlags` 两边都要写「这件事已经发生过」的标记（如 `rotation_done`），否则这个事件会重复触发；胜负各自独有的 flag 再单独加。

### 三条写作原则

1. **只放在不可回滚的节点**。自动存档在 `choose` 之后立刻写盘，刷新回到的是结果页而不是选项页，所以玩家没法靠刷新重掷——这是机制给的保险。但反过来说，赌的代价是**真的收不回来**，所以别把赌注放在开局第 2 天的小事上，要放在玩家已经投入了十几天的位置。
2. **输的那一边必须真的疼**。四个赌局的 `lose` 都至少掉 14 点，最狠的 `turn_back` 是 −24 龙体——血不够就是当场崩。如果输了只是「少赚一点」，这个赌就没有意义，玩家只会无脑点。
3. **不要给精确概率**。UI 只显示分档：

   | `chance` | 中文 | 英文 |
   |---|---|---|
   | ≥ 0.60 | 多半能成 | likely |
   | ≥ 0.45 | 五五之数 | even odds |
   | ≥ 0.32 | 三分胜算 | thin odds |
   | < 0.32 | 凶多吉少 | long odds |

   分档写在 `EventModal.tsx` 的 `oddsKey()`，文案在 `ui.roll.*`。给了数字，玩家就会去算期望值，剧本里那些「赌一把」的时刻就退化成算术题。

### 结果卡

赢 → 绿框 + `得手`；输 → 红框 + `失手`。由 `state.pending.rollWin` 驱动，不需要额外配置。

### 怎么验

```bash
node scripts/simulate.mjs --story emperor
```

每个策略下面会多一行：

```
风险选项：选了 2606 次 · 胜 1208 / 负 1398 · 实际胜率 46.4%
```

- 所有策略**不建模风险偏好**，`scripts/simulate.mjs` 里的 `expectedChoice()` 会把 `roll` 折成期望值再打分。否则策略看到 `effects` 是空的一律给 0 分，仿真里永远没人去赌，这几个选项等于没被测到。
- `random` 的实际胜率应该接近四个 `chance` 的加权平均；如果偏得离谱，说明 `Math.random()` 那段或者数据写错了。
---

## 十一、界面风格：为什么是现在这个样子

这一节不是教你怎么写代码，是**别把已经定下来的视觉基线又改回去**。之前那一版是标准的
SaaS 后台模板风（玻璃拟态卡片 + 五种强调色 + 圆角 + Inter 无衬线），放在清宫戏里一眼能看出是套的。

### 四条规则，改任何界面都先过一遍

**1. 颜色只有三个，多一个就开始像模板**

| 色 | 用途 | 定义在 |
|---|---|---|
| `cinnabar` 朱砂 | **唯一的强调色**：批红、印、危险线、因果链、损失 | `tailwind.config.js` |
| `paper` 纸白 | 正文、边框、次级文字。从 50 到 700 一共 7 级 | 同上 |
| `stone` 石青 | 只给「已接触」这类中性状态用 | 同上 |
| `ink` 暖墨 | 底色。**不能用冷蓝黑**（`#080b12` 那类），清宫戏里出现冷蓝底最露馅 | 同上 |

新加组件时**不要**再引入 `rose / sky / emerald / violet / amber`。这五个色系在 Tailwind 里
太顺眼了，一用就回到模板。要表达「好 / 坏」，用纸白和朱砂的明暗差，不要用红绿。

**2. 圆角是 0**

除了印章和墨点（这两个本来就是圆的），所有卡片、按钮、格子都是直角，靠 1px 细线和
留白分层，不靠圆角 + 底色。

**3. 字体分工**

| 用途 | 类名 | 说明 |
|---|---|---|
| 正文、标题、按钮、选项 | `font-serif` | 落到 Songti SC / 思源宋体 / SimSun。英文会落到 Georgia，效果比无衬线更好 |
| 数字（属性、月份、编号） | `font-mono` | 宋体的数字难对齐，这里只能用等宽 |
| 英文全大写小标签 | `font-serif` + `tracking` | **不要用 mono + uppercase + 大字距**，那是科技感符号 |

正文最小 13px（宋体在 12px 以下会糊），行高 1.9 起。

**4. 线条：一个区块最多一条**

第一版几乎每样东西都描了一道线 —— HUD 四格之间的竖线、每格下面的刻度条、地点列表五条、
选项四条、结局页数值区上下双线 —— 一屏能数出二十几根，看起来像 Excel 而不是奏折。

| 位置 | 现在 |
|---|---|
| 区块之间（HUD / 内容、地图 / 日志） | **留一条**，这是真的分界 |
| 列表内部（地点、选项、关键决断、联系人） | **不画线**，靠 `py-3.5` 以上的留白分组 |
| 同一方向、相距不到 20px 的两条平行线 | **必删一条**。HUD 原来底边和内上边就是这种 |
| 按钮、朱印、头像状态框 | **保留**，这是信息不是装饰 |

判断标准只有一句：**删掉这条线，信息丢不丢？** 不丢就删。

删完要用别的东西补上原来的职责：

- **可点性**靠亮度差 —— 正文 `paper-200/90`，选项抬到 `paper-100`，从段落里浮出一格
- **未接触的头像**从「细边框」改成「极淡底色」（`bg-paper-100/[0.03]` + 透明边框），
  否则四个框并排会读成一张待填的表
- **数值的紧张感**靠低值变色 + 小朱点，不靠四条刻度条

### 三个交互各自在哪

| 交互 | 文件 | 改了会影响什么 |
|---|---|---|
| **落笔墨点**：点选项时指尖渗开一圈朱色 | `EventModal.tsx` 的 `setInk` + `animate-inkSpread` | 纯视觉。`ink` 必须绑 `choiceId`，否则所有选项会同时渗出墨点 |
| **长按批红**：按住 420ms 才落印 | `EventModal.tsx` 的 `HoldSeal` | 影响所有剧本的确认键。键盘 Enter / 空格仍然是直接确认，长按只针对触屏 |
| **朱印落印**：结局页末尾砸下一枚印 | `EndingScreen.tsx` 的 `sealed` + `animate-sealSlam` | 印文在四个 `core.json` 的 `ui.ending.sealLine1/2` 里配 |
| **濒死暗角**：心力 < 15 时外框内暗红呼吸 | `App.tsx` 的 `dying` + `index.css` 的 `.vignette-pulse` | 阈值写死在 `sanity < 15`，和 `ending_mad` 的触发线对齐 |

**音效分工别搞反**：点选项是「落笔」，播 `click`；长按 420ms 按到底是「落印」，播 `stamp`。
反过来的话，最重的那一声会落在最轻的动作上，整套仪式感就漏气了（`App.tsx` 的 `handleChoose` / `handleAck`）。

**长按按钮需要一条新文案 `ui.action.hold`**（中文「按住」/ 英文「press and hold」），
四个 `core.json` 里都有。漏了会渲染成空。

### 一条经验

> 这套剧本的卖点是文本量。任何"氛围装饰"（粒子、背景音、飘雪、发光、飞入动画）
> 在这个项目里都是负收益 —— 已经砍过两次了（背景音、赛博网格）。要加东西，加在
> **信息反馈**上（这个决定让我付出了什么、这条线从哪开始的），不要加在"演一段"上。

**不要用横线划过数字来表示损失**（结果卡里以前做过「朱笔划数」，已删）。
横线划字在 UI 里只有一个含义：删除线。玩家读到的是"这个数字作废了"，不是"国库少了五万"。
想强调损失就用颜色和位置，别动字形本身。同类不要试的还有：数字抖动（已保留，但只在 HUD 掉值时抖一次）、
数字变红加粗加底色（三重强调等于没有强调）。

### 语言默认值：别给「用户偏好」设默认值（v0.5 的真实事故）

语言是**推断**出来的，不是**存**出来的。判定分三层，只有第一层是持久的：

```ts
// src/i18n/index.ts
const fallbackLang = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
const initialLang = getStoredLang() ?? fallbackLang   // 只有显式切换过才有第一项
```

事故经过：原来的 `defaultPrefs` 里写了 `lang: 'zh'`。玩家每点一次静音、环境音、
"不再显示日卡"，`savePrefs` 都会把**整个** `Prefs` 写盘 —— 包括那个默认的 `'zh'`。
于是英文访客只要动过任何设置，`'zh'` 就进了他的 localStorage，从此无论浏览器什么语言都是中文。
表面上像"默认语言写错了"，实际是**默认值被当成了用户选择存下来**。

规则：**任何"用户偏好"字段，默认值必须是"没有值"（`undefined`），不能是一个具体选项。**
读写走独立的 key（`sector7.lang.v1`），只有真正的用户动作（点地球图标、带 `?lang=` 进）才写。
`loadPrefs()` 里还要 `delete parsed.lang` —— 老数据里那一条分不清是选的还是默认写进去的，一律丢。

同类别再犯：`dayCard` 现在默认 `true`，风险是"玩家没选过"和"选了显示"存下来一样。
哪天它出问题，就是同一个病。

### 纪日写法（`config.dayLabel`）

日志左边的日期有两套写法，读 `config.json` 里的 `dayLabel`：

| 值 | 效果 | 用在 |
|---|---|---|
| `lunar` | 初一 / 初七 / 十二 | 大靖 |
| `numeric` | D1 / D7（默认，不填就是它） | SECTOR-07 |

**不要按剧本 id 判断**。加第三个剧本时在 `config.config.dayLabel` 里配一次就行 ——
注意是 `config` 对象**内部**，写到 `config.json` 顶层不会生效（`build-events` 只透传 `config` 那一段）。

---

## 十二、结局页：一份结语加一枚印

结局页（`src/components/EndingScreen.tsx`）不是结算面板，是**卷宗**。玩家整个流程里唯一会
截图带走的就是这一页，所以它的时间轴比其它页面都长：

```
评语逐句淡入（每句间隔 180ms）→ 停半拍 → 朱印砸下来（stamp 音效）→ 按钮才出现
```

**顺序不能改**。先给按钮、后放动画，就变成「一个有动画的弹窗」，玩家会直接点掉。
落印之前按钮区留一块 `h-[92px]` 的空白占位，否则按钮出现时会把上面的评语顶上去。

| 改什么 | 在哪儿 |
|---|---|
| 印面文字（两行，竖看是一方印） | 四个 `core.json` 的 `ui.ending.sealLine1` / `sealLine2` |
| 落印时机 | `EndingScreen.tsx` 的 `sealAt`，默认 `max(1200, 140 + 句数×180 + 520)` |
| 印的大小 | 固定 `54px` 见方，**不要按内容自适应** |

**印必须是方的。** 让内容撑开宽度，它就从印章变成标签了 —— 中文两字按 17px 排、英文
按 7.5px 排，都在同一个 54px 格子里居中。中文版本能改 3 字（`第七區`），英文改 7 个字母
（`ARCHIVE`）也不会溢出：

```
┌──────┐        ┌──────┐
│ 大靖 │        │SECTOR│
│ 實錄 │        │ARCHIV│
└──────┘        └──────┘
```

印是 `absolute` 钉在右下角、不随内容滚动的，所以滚动区给了 `pb-24` —— 内容滚到底时必须能
滚过印，否则最后一条「关键决断」永远压在印下面。

想跳过动画：点页面任何空白处直接落印（`skip()`）。别做「跳过」按钮，那是在提示玩家可以不等。

---

## 十三、心力濒死：两层暗角，只能满一层

`body::after` 本来就有一层静态暗角（`--vignette-a`，默认 0.42），让纸的边自然沉下去。
心力掉到 15 以下时，外框内再挂一层**会呼吸的暗红**（`.vignette-pulse`，8 秒一个周期）。

**两层不能同时给满。** 0.42 + 0.62 叠在 430px 宽的框里会糊成一块纯黑，看起来像渲染失败。
所以低心力时 `App.tsx` 把 `--vignette-a` 降到 0.16，让位给会动的那层：

```ts
document.documentElement.style.setProperty('--vignette-a', dying ? '0.16' : '0.42')
```

三条经验：

1. **只压外框，不压浏览器窗口。** 桌面端外框只有 430px 居中，全屏暗角会把窗口背景一起压黑。
   暗角层挂在 `frame` 里面，不是 `body` 上。
2. **「暗」要多过「红」。** 颜色用 `rgba(74,13,10,...)`（偏黑的红），不是 `cinnabar`。
   用朱砂色会变成警报灯。渐变起点在 52%，再往里推就是一张红纱。
3. **周期 8 秒，只动 opacity。** 快了像心跳监测仪。`prefers-reduced-motion` 下在
   `index.css` 里单独给一个静态亮度（0.82）—— 全局降级规则会把循环动画停在第 0 帧
   （opacity 0.55），等于把暗角划掉了。

### 校对濒死状态：`?sanity=N`

正常玩一局到不了 15 以下，所以加了一个只在 dev 生效的口子：

```
/?story=emperor&play=1&loc=study&sanity=8    # 御书房，心力 8，看暗角
/?story=emperor&play=1&end=ending_emperor_zenith&sanity=8   # 结局页 + 暗角叠加
```

`import.meta.env.DEV` 为 false 时整段会被摇掉，上线不带这个入口。
