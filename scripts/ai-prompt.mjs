#!/usr/bin/env node
/**
 * 生成「让 AI 写下一批事件」的提示词：node scripts/ai-prompt.mjs --theme "隔离营暴动" --loc medbay --npc chen --count 10
 *
 * 为什么要脚本生成而不是手写一段提示词：
 *   模型最大的问题不是不会写，是不知道「已经写过什么」和「有哪些坑没填」。
 *   所以这里把现有 88 个事件的 id、全部 flag 的读写关系、每个地点的日期覆盖、
 *   单选项数值预算，全部从数据里实时算出来塞进提示词。
 *   同一段提示词，任何人都能复现；改完剧本重跑一次，上下文永远是最新的。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const theme = arg('theme', '未指定主题')
const loc = arg('loc', '')
const npc = arg('npc', '')
const count = Number(arg('count', 10))
const story = arg('story', 'sector07')

const data = readJson(join(root, 'src/data/stories', story, 'events.json'))
const zh = readJson(join(root, 'content/zh', story, 'core.json'))

// ---------- 汇总现有内容 ----------
const byLoc = {}
for (const l of data.locations) byLoc[l.id] = { total: 0, once: 0, days: new Set() }
for (const ev of data.events) {
  const b = byLoc[ev.loc]
  if (!b) continue
  b.total++
  if (!ev.repeatable) b.once++
  if (ev.cond?.dayMin) b.days.add(ev.cond.dayMin)
}

const sets = new Map()
const reads = new Map()
const bump = (m, k, v) => {
  if (!m.has(k)) m.set(k, [])
  m.get(k).push(v)
}
for (const ev of data.events) {
  const c = ev.cond ?? {}
  for (const f of [...(c.flags ?? []), ...(c.notFlags ?? []), ...(c.anyFlags ?? [])]) bump(reads, f, ev.id)
  for (const ch of ev.choices) {
    for (const f of Object.keys(ch.setFlags ?? {})) if (ch.setFlags[f]) bump(sets, f, `${ev.id}.${ch.id}`)
    const r = ch.requires ?? {}
    for (const f of [...(r.flags ?? []), ...(r.notFlags ?? []), ...(r.anyFlags ?? [])]) bump(reads, f, `${ev.id}.${ch.id}`)
  }
}
for (const e of data.endings) {
  for (const f of [...(e.cond?.flags ?? []), ...(e.cond?.anyFlags ?? []), ...(e.cond?.notFlags ?? [])]) bump(reads, f, `ending:${e.id}`)
}

const bookkeeping = new Set()
const packDir = join(root, 'src/data/stories', story, 'packs')
for (const f of readdirSync(packDir)) {
  if (!f.endsWith('.json')) continue
  const pack = readJson(join(packDir, f))
  for (const x of pack.bookkeeping ?? []) bookkeeping.add(x)
}

const openThreads = [...sets.keys()].filter((f) => !reads.has(f) && !bookkeeping.has(f))
const deadFlags = [...reads.keys()].filter((f) => !sets.has(f) && !f.startsWith('ending'))

// ---------- 拼提示词 ----------
const L = []
L.push(`# SECTOR-07 剧本批次任务：${theme}`)
L.push('')
L.push(`你是这款文字生存游戏的内容编剧。游戏已完成 ${data.events.length} 个事件、${data.endings.length} 个结局，`)
L.push(`现在需要你写 **${count} 个新事件**，用 JSON 表达，追加到现有事件库。`)
L.push('')
L.push('## 世界观（不可改动）')
L.push('')
L.push(zh.ui.story.premise)
L.push('')
L.push('三幕结构：' + data.acts.map((a) => `D${a.from}+ ${a.id}`).join(' → '))
L.push(`玩家总时长 ${data.config.maxDays} 天 × ${data.config.actionsPerDay} 行动点 = ${data.config.maxDays * data.config.actionsPerDay} 次遭遇。`)
L.push('')
L.push('## 现有内容盘点')
L.push('')
L.push('| 地点 | 事件数 | 一次性 | 已用最早天数 |')
L.push('|---|---|---|---|')
for (const [id, b] of Object.entries(byLoc)) {
  L.push(`| ${id} | ${b.total} | ${b.once} | ${[...b.days].sort((x, y) => x - y).join(',') || '—'} |`)
}
L.push('')
L.push('**尚未闭合的线索（flag 已埋但没被任何事件/结局读取）**：')
L.push(openThreads.length ? openThreads.map((f) => `\`${f}\``).join('、') : '（无）')
L.push('')
if (deadFlags.length) {
  L.push(`⚠ 数据异常（别学）：${deadFlags.map((f) => `\`${f}\``).join('、')} 被读取但从未被设置。`)
  L.push('')
}
L.push('**NPC 支线**：' + data.npcs.map((n) => `${n.id}（${n.metFlag} / ${n.allyFlag} / ${n.betrayFlag}）`).join('、'))
L.push('')
L.push('**现有事件 id（严禁重名）**：')
L.push(data.events.map((e) => e.id).join(', '))
L.push('')
L.push('## 数值预算（硬性）')
L.push('')
L.push('单选项最多：money ±60、sanity ±30、health ±45、favor ±35、morality ±3。')
L.push(`一局玩家大约会遭遇 ${Math.round(data.config.maxDays * data.config.actionsPerDay * 0.9)} 次；这批 ${count} 个事件的金钱净收益总和不要超过 ${count * 12} 信用点。`)
L.push(
  `船票 ${data.config.ticketCost} 信用点（或人脉 ≥ ${data.config.ticketFavor}），配给 ${data.config.dailyUpkeep} 起每 ${data.config.upkeepRampEvery} 天 +${data.config.upkeepRampAdd}，执勤津贴 ${data.config.dailyWage}。`,
)
L.push('')
L.push('## 字段规范')
L.push('')
L.push('```jsonc')
L.push('{')
L.push('  "id": "gate_something",          // 必须 <loc>_<主题>，全局唯一')
L.push('  "loc": "gate",                    // gate | pub | medbay | market | dorm')
L.push('  "npc": "chen",                    // 可选，涉及哪个 NPC')
L.push('  "weight": 10,                     // 可选，默认 1，越大越常出')
L.push('  "priority": 0,                    // 因果链强制触发用 80~95，普通事件不写')
L.push('  "once": true,                     // 一次性事件（绝大多数）')
L.push('  "chain": true,                    // 因果链，UI 会打标记')
L.push('  "cond": {                         // 触发条件，全部是「与」关系')
L.push('    "flags": ["serum_route"],       // 这些 flag 必须为 true')
L.push('    "notFlags": ["x_done"],         // 这些必须为 false')
L.push('    "dayMin": 7, "dayMax": 12,')
L.push('    "statMin": { "money": 40 }, "statMax": { "sanity": 50 },')
L.push('    "moralityMin": 0, "chance": 0.4')
L.push('  },')
L.push('  "choices": [                      // 2~3 个，必须互相有取舍')
L.push('    {')
L.push('      "id": "take_it",')
L.push('      "effects": { "money": -20, "sanity": 10 },')
L.push('      "morality": 2,                // -3 ~ +3')
L.push('      "requires": { "statMin": { "money": 20 } },  // 有 requires 必须配 req 文案')
L.push('      "setFlags": { "took_it": true },')
L.push('      "tone": "good",               // good | neutral | dark')
L.push('      "key": true                   // 计入结局卡的关键抉择')
L.push('    }')
L.push('  ]')
L.push('}')
L.push('```')
L.push('')
L.push('## 文案要求')
L.push('')
L.push('1. 描述 60~110 字，冷、具体、有物理细节（气味、声音、温度），不要形容词堆砌。')
L.push('2. 每个选项的结果必须写出「代价」，不能只写「你成功了」。')
L.push('3. 不要出现「全球 9.2% 玩家」「命运的选择」这类解说腔。')
L.push('4. 文案里不要写死票价/配给费的具体数字，数值会调。')
L.push('5. 中文与英文同时输出，英文要母语化重写，不要直译。')
L.push('')
L.push('## 输出格式')
L.push('')
L.push('先给一个 JSON 代码块（数组，' + count + ' 个事件），再给一个 JSON 代码块（中文文案），再给一个（英文文案）。')
L.push('文案对象的 key 是事件 id，结构：')
L.push('')
L.push('```json')
L.push('{')
L.push('  "gate_something": {')
L.push('    "title": "标题",')
L.push('    "desc": "描述",')
L.push('    "choices": { "take_it": { "text": "选项文字", "req": "锁定原因（仅 requires 时）", "outcome": "结果" } }')
L.push('  }')
L.push('}')
L.push('```')
L.push('')
L.push('## 本次任务')
L.push('')
L.push(`- 主题：**${theme}**`)
if (loc) L.push(`- 地点：**${loc}**（只能写这个地点的场景）`)
if (npc) L.push(`- 关联 NPC：**${npc}**，请推进这条支线，并明确它会改变哪个 flag`)
L.push(`- 数量：${count} 个，其中至少 2 个要消费上面「尚未闭合的线索」里的 flag。`)
L.push('- 至少 1 个事件必须在 D13 之后触发（第三幕目前最薄）。')

const out = join(root, 'prompts', story)
mkdirSync(out, { recursive: true })
const existing = existsSync(out) ? readdirSync(out).filter((f) => f.startsWith('batch-')).length : 0
const file = join(out, `batch-${String(existing + 1).padStart(2, '0')}-${loc || 'mixed'}.md`)
writeFileSync(file, L.join('\n') + '\n')

console.log(`✓ 提示词已生成：${file}`)
console.log(`  事件 ${data.events.length} / 地点 ${loc || '任意'} / 数量 ${count}`)
console.log(`  未闭合线索 ${openThreads.length} 个：${openThreads.slice(0, 8).join(', ')}${openThreads.length > 8 ? ' …' : ''}`)
