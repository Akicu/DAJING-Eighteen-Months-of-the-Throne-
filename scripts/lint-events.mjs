#!/usr/bin/env node
/**
 * 剧本体检：node scripts/lint-events.mjs [--strict]
 *
 * 这是「AI 批量产剧本」能成立的前提。模型写出来的片段单看都通顺，
 * 但合起来常见四类硬伤，人工逐条读根本查不过来：
 *   1. 死条件  —— 条件里读了一个没有任何选项会置 true 的 flag，事件永远不出现
 *   2. 数值暴力 —— 单个选项给 +60 信用点，经济系统当场失效
 *   3. 断链    —— chain 事件挖了坑，但后面没有事件去收
 *   4. 过度重复 —— 某地点的事件数少于该地点会发生的遭遇次数
 * 所以每次合入新批次后跑一遍，比事后玩十局更能发现问题。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const story = argOf('story', 'sector07')
const data = JSON.parse(readFileSync(join(root, 'src/data/stories', story, 'events.json'), 'utf8'))
const strict = process.argv.includes('--strict')

const errors = []
const warnings = []
const notes = []

const STAT_KEYS = ['health', 'sanity', 'money', 'favor']
const CEIL = { health: 100, sanity: 100, favor: 100, money: 9999 }

// ---------- 1. flag 图 ----------
// 有些 flag 只用来记录「玩家做过什么」（结局卡、埋点、后续 DLC 用），不参与任何判定。
// 这类必须在 pack 里显式声明 bookkeeping，否则一律当成「挖了坑没填」告警。
const bookkeeping = new Set()
const packDir = join(root, 'src/data/stories', story, 'packs')
for (const file of readdirSync(packDir)) {
  if (!file.endsWith('.json')) continue
  const pack = JSON.parse(readFileSync(join(packDir, file), 'utf8'))
  for (const f of pack.bookkeeping ?? []) bookkeeping.add(f)
}

const sets = new Map() // flag -> [eventId]
const reads = new Map() // flag -> [eventId]
const bump = (map, k, v) => {
  if (!map.has(k)) map.set(k, [])
  map.get(k).push(v)
}

for (const ev of data.events) {
  const cond = ev.cond ?? {}
  for (const f of [...(cond.flags ?? []), ...(cond.notFlags ?? []), ...(cond.anyFlags ?? [])]) {
    bump(reads, f, ev.id)
  }  for (const c of ev.choices) {
    for (const f of Object.keys(c.setFlags ?? {})) {
      if (c.setFlags[f]) bump(sets, f, `${ev.id}.${c.id}`)
    }
    for (const f of [...(c.requires?.flags ?? []), ...(c.requires?.notFlags ?? []), ...(c.requires?.anyFlags ?? [])]) {
      bump(reads, f, `${ev.id}.${c.id}`)
    }
    if (c.roll) {
      for (const br of [c.roll.win, c.roll.lose]) {
        for (const f of Object.keys(br.setFlags ?? {})) {
          if (br.setFlags[f]) bump(sets, f, `${ev.id}.${c.id}`)
        }
      }
    }
  }
}

// 结局条件也算「读」，否则会误报「挖了坑没填」
for (const end of data.endings ?? []) {
  for (const f of [...(end.cond?.flags ?? []), ...(end.cond?.anyFlags ?? []), ...(end.cond?.notFlags ?? [])]) {
    bump(reads, f, `ending:${end.id}`)
  }
}

for (const [flag, where] of reads) {
  if (!sets.has(flag)) errors.push(`死条件：flag "${flag}" 被 ${where.join(', ')} 读取，但没有任何选项会置 true`)
}for (const [flag, where] of sets) {
  if (bookkeeping.has(flag)) continue
  if (!reads.has(flag)) warnings.push(`孤立 flag："${flag}" 被 ${where.join(', ')} 设置，但没人读它（挖了坑没填）`)
}

// ---------- 2. 条件可达性 ----------
for (const ev of data.events) {
  const c = ev.cond ?? {}
  if (c.dayMin !== undefined && c.dayMin > data.config.maxDays) {
    errors.push(`${ev.id}: dayMin=${c.dayMin} 超过全局 ${data.config.maxDays} 天，永不触发`)
  }
  if (c.dayMax !== undefined && c.dayMax < 1) errors.push(`${ev.id}: dayMax=${c.dayMax} 不可能满足`)
  if (c.dayMin !== undefined && c.dayMax !== undefined && c.dayMin > c.dayMax) {
    errors.push(`${ev.id}: dayMin(${c.dayMin}) > dayMax(${c.dayMax})`)
  }
  for (const [k, v] of Object.entries(c.statMin ?? {})) {
    if (v > CEIL[k]) errors.push(`${ev.id}: statMin.${k}=${v} 超过上限 ${CEIL[k]}，永不触发`)
  }
  for (const [k, v] of Object.entries(c.statMax ?? {})) {
    if (v < 0) errors.push(`${ev.id}: statMax.${k}=${v} 不可能满足`)
  }
  // 链式事件必须有 dayMin 或 flag 门槛，否则第一局开局就会连爆
  if (ev.chain && !c.flags && !c.anyFlags && c.dayMin === undefined) {
    warnings.push(`${ev.id}: chain 事件没有任何前置，会在第 1 天就触发，破坏因果感`)
  }
  if (ev.priority && ev.priority >= 100 && !ev.chain) {
    warnings.push(`${ev.id}: priority=${ev.priority} 但没标 chain，UI 不会显示因果标记`)
  }
}

// ---------- 3. 数值暴力 ----------
// 金钱预算随票价缩放：单个选项最多相当于 1/4 张船票，再多经济就崩
const LIMIT = { health: 45, sanity: 30, favor: 35, money: Math.max(50, Math.round(data.config.ticketCost / 4)) }
for (const ev of data.events) {
  for (const c of ev.choices) {
    // 标了 key 的是一次性 pivots（卖名单、卖配方），金额天然大，不算数值暴力
    if (c.key) continue
    const branches = c.roll ? [c.roll.win, c.roll.lose] : [c]
    for (const b of branches) {
      for (const [k, v] of Object.entries(b.effects ?? {})) {
        if (Math.abs(v) > LIMIT[k]) {
          warnings.push(`${ev.id}.${c.id}: ${k} ${v > 0 ? '+' : ''}${v} 超过单选项预算 ±${LIMIT[k]}`)
        }
      }
      if (Math.abs(b.morality ?? 0) > 3) {
        warnings.push(`${ev.id}.${c.id}: morality ${b.morality} 超过单选项预算 ±3`)
      }
    }
  }
}

// ---------- 4. 覆盖与重复 ----------
const encounters = data.config.maxDays * data.config.actionsPerDay
const perLoc = {}
for (const loc of data.locations) {
  const pool = data.events.filter((e) => e.loc === loc.id)
  const unique = pool.filter((e) => !e.repeatable).length
  const repeatable = pool.length - unique
  // 玩家不会均匀分配行动点，按「单一地点被反复进入」的最坏情况估算
  perLoc[loc.id] = { unique, repeatable, pool: pool.length }
  if (pool.length === 0) errors.push(`地点 ${loc.id} 没有任何事件`)
  else if (unique + repeatable < 4) {
    warnings.push(`地点 ${loc.id} 只有 ${pool.length} 个事件，玩家第 2 天就会开始重复`)
  }
}

// 单局最多 54 次遭遇，全局 non-repeatable 事件数决定「一周目能见多少新内容」
const onceEvents = data.events.filter((e) => !e.repeatable).length
if (onceEvents < encounters * 0.8) {
  warnings.push(
    `可一次性事件 ${onceEvents} 个，单局最多 ${encounters} 次遭遇 —— 会撞重复，建议补到 ${Math.ceil(encounters * 0.9)} 个以上`,
  )
}

// ---------- 5. 经济体检 ----------
const { ticketCost, dailyUpkeep, maxDays } = data.config
const wage = data.config.dailyWage ?? 0
const rampEvery = data.config.upkeepRampEvery ?? 0
const rampAdd = data.config.upkeepRampAdd ?? 0
// 与引擎 upkeepFor 同口径，逐日累加（第 1…maxDays-1 天要付配给）
let totalUpkeep = 0
for (let day = 1; day <= maxDays - 1; day++) {
  const ramp = rampEvery && rampAdd ? Math.floor((day - 1) / rampEvery) * rampAdd : 0
  totalUpkeep += dailyUpkeep + ramp
}
const totalWage = wage * (maxDays - 1)
const bestMoney = data.events.reduce((sum, ev) => {
  const best = Math.max(0, ...ev.choices.flatMap((c) => [c.effects?.money ?? 0, c.roll?.win.effects?.money ?? 0]))
  return sum + best
}, 0)
notes.push(
  `经济：船票 ${ticketCost} + 配给合计 ${totalUpkeep} − 执勤津贴 ${totalWage} = 需自己净赚 ${ticketCost + totalUpkeep - totalWage}`,
)
notes.push(`经济：所有事件都选最赚钱分支的理论上限 ${bestMoney}（实际只能覆盖约 ${Math.round((encounters / data.events.length) * 100)}% 的事件）`)

// 每个地点平均每次遭遇的金钱期望，用于判断「钱是否可得」
const moneyPerEvent = {}
for (const loc of data.locations) {
  const pool = data.events.filter((e) => e.loc === loc.id)
  const vals = pool.map((ev) => {
    const m = ev.choices.map((c) => c.effects?.money ?? c.roll?.win.effects?.money ?? 0)
    return m.reduce((a, b) => a + b, 0) / m.length
  })
  moneyPerEvent[loc.id] = Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1))
}

// ---------- 6. 结局可覆盖 ----------
for (const end of data.endings) {
  const c = end.cond
  if (!c) continue
  for (const f of c.flags ?? []) {
    if (!sets.has(f)) errors.push(`结局 ${end.id}: 依赖的 flag "${f}" 从未被设置，该结局不可达`)
  }
  if (c.statMin?.money && c.statMin.money > bestMoney + data.config.startStats.money) {
    warnings.push(`结局 ${end.id}: 要求 money ≥ ${c.statMin.money}，可能超出理论收入上限`)
  }
}

// ---------- 输出 ----------
console.log(`\n剧本体检 —— ${data.events.length} 事件 / ${data.endings.length} 结局 / ${encounters} 次遭遇上限\n`)
console.log('地点              事件  一次性  可重复')
for (const [id, s] of Object.entries(perLoc)) {
  console.log(`  ${id.padEnd(14)} ${String(s.pool).padStart(4)} ${String(s.unique).padStart(6)} ${String(s.repeatable).padStart(6)}`)
}
console.log('\n平均金钱期望/次: ' + Object.entries(moneyPerEvent).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('   '))
notes.forEach((n) => console.log('  · ' + n))

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} 条警告：`)
  warnings.forEach((w) => console.log('   ' + w))
}
if (errors.length) {
  console.log(`\n✗ ${errors.length} 条错误：`)
  errors.forEach((e) => console.log('   ' + e))
}

if (errors.length || (strict && warnings.length)) {
  process.exit(1)
}
console.log('\n✓ 通过')
