#!/usr/bin/env node
/**
 * 数值仿真：node scripts/simulate.mjs [局数]
 *
 * 18 天 × 3 行动点 = 54 次决策，人工玩一局要 20 分钟，改一个数值的影响根本感觉不出来。
 * 这里用三种策略各跑几千局，输出结局分布、死亡率和事件覆盖率，
 * 用来回答三个问题：钱够不够、理智会不会崩、有多少内容玩家一辈子见不到。
 */
import { buildSync } from 'esbuild'
import { readFileSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const story = argOf('story', 'sector07')
const RUNS = Number(argv.find((a) => /^\d+$/.test(a)) ?? 4000)

const tmp = mkdtempSync(join(tmpdir(), 's7sim-'))
const outfile = join(tmp, 'engine.mjs')
buildSync({
  entryPoints: [join(root, 'src/engine/game.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
})
const engine = await import(pathToFileURL(outfile).href)
const data = JSON.parse(readFileSync(join(root, 'src/data/stories', story, 'events.json'), 'utf8'))

const STATS = ['health', 'sanity', 'money', 'favor']

/**
 * 选项评分：同一个人，在快死的时候和状态好的时候，下决定的方式不一样。
 * 所以评分函数拿到的是 (choice, state)，而不是固定权重 —— 这才能模拟真人，
 * 而不是模拟一个只会朝一个方向走的机器人。
 */
const POLICIES = {
  random: null,
  // 只想活着离开：钱 > 健康 > 理智
  greedy: (c, st) => {
    const f = c.effects ?? {}
    const san = st.stats.sanity < 50 ? 0.9 : 0.18
    const hp = st.stats.health < 55 ? 0.75 : 0.18
    return (f.money ?? 0) + (f.sanity ?? 0) * san + (f.health ?? 0) * hp
  },
  // 只想做对的事：道德 > 理智 > 钱
  moral: (c, st) => {
    const f = c.effects ?? {}
    const san = st.stats.sanity < 50 ? 0.8 : 0.1
    const hp = st.stats.health < 55 ? 0.6 : 0.05
    return (c.morality ?? 0) * 10 + (f.sanity ?? 0) * san + (f.health ?? 0) * hp + (f.money ?? 0) * 0.12
  },
  // 只赚钱、不脏手的打工人：验证「买票离开」这条路真的走得通
  capitalist: (c, st) => {
    const f = c.effects ?? {}
    if ((c.morality ?? 0) <= -2) return -999
    const san = st.stats.sanity < 50 ? 0.9 : 0.2
    const hp = st.stats.health < 55 ? 0.8 : 0.2
    return (f.money ?? 0) * 1.2 + (f.sanity ?? 0) * san + (f.health ?? 0) * hp
  },
  // 玩过一遍的人：优先推进 NPC 线和因果链
  explorer: (c, st) => {
    const f = c.effects ?? {}
    const san = st.stats.sanity < 50 ? 0.85 : 0.2
    const hp = st.stats.health < 55 ? 0.7 : 0.2
    return (c.key ? 7 : 0) + (c.morality ?? 0) * 2 + (f.money ?? 0) * 0.4 + (f.sanity ?? 0) * san + (f.health ?? 0) * hp
  },
}

/**
 * roll 选项在数据里没有 effects（引擎只认 win / lose 两个分支），
 * 而所有策略都是按 c.effects 打分的 —— 不折算成期望值，仿真里就永远没人去赌，
 * 那这几个选项等于没被测到。风险偏好不建模，只让策略看见「平均下来值多少」。
 */
function expectedChoice(c) {
  if (!c.roll) return c
  const { chance, win, lose } = c.roll
  const q = 1 - chance
  const effects = {}
  for (const k of STATS) {
    const v = (win.effects?.[k] ?? 0) * chance + (lose.effects?.[k] ?? 0) * q
    if (Math.abs(v) > 0.01) effects[k] = v
  }
  return { ...c, effects, morality: (win.morality ?? 0) * chance + (lose.morality ?? 0) * q }
}

function pickChoice(choices, state, policyName) {
  const usable = choices.filter((c) => !c.requires || engine.evalCond(c.requires, state))
  if (!usable.length) return null
  if (policyName === 'random') return usable[Math.floor(Math.random() * usable.length)]
  const score = POLICIES[policyName]
  let best = usable[0]
  let bestScore = -Infinity
  for (const c of usable) {
    const s = score(expectedChoice(c), state)
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return best
}

/**
 * 地点职能不再写死成 dorm / gate / medbay —— 那些是 SECTOR-07 的地名，
 * 换个剧本（比如「大靖」的寝宫 / 内库）策略就完全失效，跑出来的数据是假的。
 * 这里改用事件本身的数值反推：哪个地点能回心力、能回血、能挣钱，自己算出来。
 */
const LOC_ROLE = (() => {
  const roll = {}
  for (const l of data.locations) roll[l.id] = { sanity: 0, health: 0, money: 0 }
  for (const ev of data.events) {
    const bucket = roll[ev.loc]
    if (!bucket) continue
    for (const c of ev.choices) {
      const f = c.effects ?? {}
      bucket.sanity = Math.max(bucket.sanity, f.sanity ?? 0)
      bucket.health = Math.max(bucket.health, f.health ?? 0)
      bucket.money = Math.max(bucket.money, f.money ?? 0)
    }
  }
  const best = (key) =>
    Object.entries(roll)
      .filter(([, v]) => v[key] > 0)
      .sort((a, b) => b[1][key] - a[1][key])
      .map(([id]) => id)
  return { rest: best('sanity'), heal: best('health'), earn: best('money') }
})()

/** 策略决定去哪个地点：先保命，再推进剧情，最后刷收益 */
function pickLoc(events, state, policyName) {
  const locs = data.locations.map((l) => l.id)
  const ready = locs.filter((l) => engine.hasAvailableEvent(events, state, l))
  if (!ready.length) return null

  const firstReady = (ids) => ids.find((l) => ready.includes(l))

  // 除了「随机乱点」的对照组，其他策略都该知道快死了要去睡觉 / 看病
  if (policyName !== 'random') {
    const rest = firstReady(LOC_ROLE.rest)
    const heal = firstReady(LOC_ROLE.heal)
    const earn = firstReady(LOC_ROLE.earn)
    if (state.stats.sanity <= 38 && rest) return rest
    if (state.stats.health <= 48 && heal) return heal
    // 兜里没钱就先挣钱，否则日结会把血扣光
    if (state.stats.money < 24 && policyName !== 'moral' && earn) return earn
    if (state.stats.money < 16 && policyName === 'moral' && earn) return earn
  }

  const chain = ready.find((l) => engine.hasPendingChain(events, state, l))
  if (chain && policyName !== 'random') return chain

  if (policyName === 'greedy') {
    // 没钱就去来钱的地方；有钱了就去能回心力 / 回血的地方
    const order =
      state.stats.money < data.config.ticketCost
        ? [...LOC_ROLE.earn, ...LOC_ROLE.rest, ...LOC_ROLE.heal]
        : [...LOC_ROLE.rest, ...LOC_ROLE.earn, ...LOC_ROLE.heal]
    return order.find((l) => ready.includes(l)) ?? ready[0]
  }
  if (policyName === 'moral') {
    const order = [...LOC_ROLE.heal, ...LOC_ROLE.rest, ...LOC_ROLE.earn]
    return order.find((l) => ready.includes(l)) ?? ready[0]
  }
  return ready[Math.floor(Math.random() * ready.length)]
}

/** 风险选项的胜负统计：用来验证 chance 是不是真按设定在掷，而不是永远偏一边 */
const rollTally = {}

function run(policyName) {
  let state = engine.createInitialState(data)
  let guard = 0
  while (state.phase !== 'ending' && guard++ < 500) {
    if (state.phase === 'map') {
      if (state.ap <= 0) {
        state = engine.reducer(state, { type: 'endDay' }, data)
        continue
      }
      const loc = pickLoc(data.events, state, policyName)
      if (!loc) {
        state = engine.reducer(state, { type: 'endDay' }, data)
        continue
      }
      state = engine.reducer(state, { type: 'enter', loc }, data)
      continue
    }
    if (state.phase === 'event') {
      const ev = data.events.find((e) => e.id === state.currentEventId)
      const choice = pickChoice(ev.choices, state, policyName)
      if (!choice) {
        state = { ...state, phase: 'map', currentEventId: null }
        continue
      }
      state = engine.reducer(state, { type: 'choose', choiceId: choice.id }, data)
      if (state.pending && state.pending.rollWin !== undefined) {
        const t = (rollTally[policyName] ??= { win: 0, lose: 0 })
        if (state.pending.rollWin) t.win++
        else t.lose++
      }
      continue
    }
    if (state.phase === 'outcome') {
      state = engine.reducer(state, { type: 'ack' }, data)
      continue
    }
  }
  return state
}

function report(policyName) {
  const endings = {}
  const seen = new Set()
  let days = 0
  let money = 0
  let sanity = 0
  let favor = 0
  let morality = 0
  const deathBy = { dead: 0, mad: 0, starved: 0 }
  let stuck = 0

  for (let i = 0; i < RUNS; i++) {
    const s = run(policyName)
    endings[s.endingId] = (endings[s.endingId] ?? 0) + 1
    Object.keys(s.usedEvents).forEach((k) => seen.add(k))
    days += s.daysSurvived
    money += Math.min(s.stats.money, 999)
    sanity += s.stats.sanity
    favor += s.stats.favor
    morality += s.morality ?? 0
    if (s.endingId === 'ending_dead') deathBy.dead++
    if (s.endingId === 'ending_mad') deathBy.mad++
    if (s.endingId === 'ending_starved') deathBy.starved++
    if (s.daysSurvived < 3) stuck++
  }

  const pct = (n) => ((n / RUNS) * 100).toFixed(1).padStart(5) + '%'
  const total = Object.values(endings).reduce((a, b) => a + b, 0)
  const rows = Object.entries(endings).sort((a, b) => b[1] - a[1])

  console.log(`\n━━ ${policyName.toUpperCase()}  ${RUNS} 局 ━━`)
  console.log(
    `  平均存活 ${(days / RUNS).toFixed(1)} 天 · 终局金钱 ${Math.round(money / RUNS)} · 终局理智 ${Math.round(sanity / RUNS)} · 终局人脉 ${Math.round(favor / RUNS)} · 终局道德 ${(morality / RUNS).toFixed(1)}`,
  )
  console.log(
    `  死因：健康归零 ${pct(deathBy.dead).trim()} · 理智归零 ${pct(deathBy.mad).trim()} · 饿死 ${pct(deathBy.starved).trim()} · 早夭 ${pct(stuck).trim()}`,
  )
  console.log(`  事件覆盖：${seen.size}/${data.events.length}（${((seen.size / data.events.length) * 100).toFixed(0)}%）`)
  const rt = rollTally[policyName]
  if (rt && rt.win + rt.lose > 0) {
    const n = rt.win + rt.lose
    console.log(
      `  风险选项：选了 ${n} 次 · 胜 ${rt.win} / 负 ${rt.lose} · 实际胜率 ${((rt.win / n) * 100).toFixed(1)}%`,
    )
  }
  console.log('  结局分布：')
  for (const [id, n] of rows) {
    const bar = '█'.repeat(Math.max(1, Math.round((n / total) * 34)))
    console.log(`    ${id.replace('ending_', '').padEnd(12)} ${pct(n)} ${bar}`)
  }
  return seen
}

const all = new Set()
console.log(`\n▌剧本 ${story} · ${data.events.length} 事件 · ${RUNS} 局/策略`)
for (const p of Object.keys(POLICIES)) {
  const seen = report(p)
  seen.forEach((x) => all.add(x))
}

const never = data.events.filter((e) => !all.has(e.id)).map((e) => e.id)
console.log(`\n━━ 全局 ━━`)
console.log(`  四种策略合计触达 ${all.size}/${data.events.length} 个事件`)
if (never.length) console.log(`  从未触发：${never.join(', ')}`)
const coverage = all.size / data.events.length
if (coverage < 0.9) console.log(`  ⚠ 覆盖率低于 90%，说明有事件的条件写得太窄，或优先级被其他事件长期压制`)
