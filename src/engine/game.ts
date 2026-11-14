import type {
  ChoiceDef,
  Cond,
  EndingDef,
  EventDef,
  EventsFile,
  LocationId,
  NpcDef,
  Stats,
  StatKey,
} from '../types'

export type Phase = 'map' | 'event' | 'outcome' | 'ending'

export interface Delta {
  key: StatKey
  value: number
}

export interface LogEntry {
  id: number
  day: number
  /** 完整 i18n key，切语言时日志会跟着变 */
  key: string
  params?: Record<string, string | number>
  deltas?: Delta[]
  tone?: 'info' | 'good' | 'bad' | 'warn'
}

export interface PendingOutcome {
  eventId: string
  choiceId: string
  rollWin?: boolean
  deltas: Delta[]
  fatal: boolean
}

export interface GameState {
  version: number
  day: number
  ap: number
  stats: Stats
  morality: number
  flags: Record<string, boolean>
  /** eventId -> 触发当天的天数 */
  usedEvents: Record<string, number>
  /** 计入结局卡的关键抉择，存 i18n key */
  keyChoices: string[]
  log: LogEntry[]
  phase: Phase
  location: LocationId | null
  currentEventId: string | null
  pending: PendingOutcome | null
  endingId: string | null
  /** 本局已过去的天数，用于结局卡 */
  daysSurvived: number
}

export type Action =
  | { type: 'new' }
  | { type: 'hydrate'; state: GameState }
  | { type: 'enter'; loc: LocationId }
  | { type: 'choose'; choiceId: string }
  | { type: 'ack' }
  | { type: 'endDay' }

let logSeq = 1
const nextLogId = () => logSeq++

/** 每项数值的合法区间。money 不设上限，其余封顶 100。 */
const CLAMP: Record<StatKey, [number, number]> = {
  health: [0, 100],
  sanity: [0, 100],
  money: [0, 9999],
  favor: [0, 100],
}

export function clampStat(key: StatKey, value: number): number {
  const [lo, hi] = CLAMP[key]
  return Math.max(lo, Math.min(hi, value))
}

/** 声明式条件求值。抽事件与选项锁共用同一套规则。 */
export function evalCond(cond: Cond | undefined, state: GameState, roll = false): boolean {
  if (!cond) return true

  if (cond.flags && !cond.flags.every((f) => state.flags[f])) return false
  if (cond.notFlags && cond.notFlags.some((f) => state.flags[f])) return false
  if (cond.anyFlags && !cond.anyFlags.some((f) => state.flags[f])) return false

  if (cond.dayMin !== undefined && state.day < cond.dayMin) return false
  if (cond.dayMax !== undefined && state.day > cond.dayMax) return false

  if (cond.statMin) {
    for (const [k, v] of Object.entries(cond.statMin)) {
      if (state.stats[k as StatKey] < (v as number)) return false
    }
  }
  if (cond.statMax) {
    for (const [k, v] of Object.entries(cond.statMax)) {
      if (state.stats[k as StatKey] > (v as number)) return false
    }
  }

  if (cond.moralityMin !== undefined && state.morality < cond.moralityMin) return false
  if (cond.moralityMax !== undefined && state.morality > cond.moralityMax) return false

  if (roll && cond.chance !== undefined && Math.random() > cond.chance) return false

  return true
}

function weightedPick<T extends { weight?: number }>(items: T[]): T {
  const total = items.reduce((sum, it) => sum + (it.weight ?? 1), 0)
  let r = Math.random() * total
  for (const it of items) {
    r -= it.weight ?? 1
    if (r <= 0) return it
  }
  return items[items.length - 1]
}

/** 事件是否还有资格被抽到 */
function isEligible(ev: EventDef, state: GameState): boolean {
  if (!evalCond(ev.cond, state, true)) return false

  // 所有选项都被 requires 挡住时不能抽 —— 否则玩家会卡在一个只能退出的界面
  if (!ev.choices.some((c) => !c.requires || evalCond(c.requires, state))) return false

  const usedOn = state.usedEvents[ev.id]
  if (usedOn === undefined) return true

  // 一次性事件：用过就永久出局
  if (!ev.repeatable) return false

  // 冷却：day - usedOn <= cooldown 时不可再出（含当天）
  const cooldown = ev.cooldown ?? 0
  if (cooldown > 0 && state.day - usedOn <= cooldown) return false

  return true
}

/**
 * 抽取事件。
 * 1) 先取满足条件的池子
 * 2) 池子里若有 priority > 0 的（因果连锁），强制从最高优先级里挑 —— 保证剧情钩子一定兑现
 * 3) 否则按权重随机
 * 4) 全空则降级到可重复事件（忽略冷却），避免玩家点进一个空地点
 */
export function pickEvent(events: EventDef[], state: GameState, loc: LocationId): EventDef | null {
  const pool = events.filter((e) => e.loc === loc)
  let eligible = pool.filter((e) => isEligible(e, state))

  if (eligible.length === 0) {
    eligible = pool.filter((e) => e.repeatable && evalCond(e.cond, state, true))
  }
  if (eligible.length === 0) return null

  const maxPriority = Math.max(...eligible.map((e) => e.priority ?? 0))
  if (maxPriority > 0) {
    const top = eligible.filter((e) => (e.priority ?? 0) === maxPriority)
    return weightedPick(top)
  }

  return weightedPick(eligible)
}

export function createInitialState(data: EventsFile, keepLog = false): GameState {
  const state: GameState = {
    version: 1,
    day: 1,
    ap: data.config.actionsPerDay,
    stats: { ...data.config.startStats },
    morality: 0,
    flags: {},
    usedEvents: {},
    keyChoices: [],
    log: keepLog ? [] : [{ id: nextLogId(), day: 1, key: 'ui.log.boot', tone: 'info' }],
    phase: 'map',
    location: null,
    currentEventId: null,
    pending: null,
    endingId: null,
    daysSurvived: 1,
  }
  return state
}

function applyEffects(
  state: GameState,
  effects: Partial<Record<StatKey, number>> | undefined,
): Delta[] {
  const deltas: Delta[] = []
  if (!effects) return deltas

  for (const key of Object.keys(effects) as StatKey[]) {
    const raw = effects[key] ?? 0
    if (raw === 0) continue
    const before = state.stats[key]
    state.stats[key] = clampStat(key, before + raw)
    const applied = state.stats[key] - before
    if (applied !== 0) deltas.push({ key, value: applied })
  }
  return deltas
}

function pushLog(state: GameState, entry: Omit<LogEntry, 'id'>) {
  state.log = [{ id: nextLogId(), ...entry }, ...state.log].slice(0, 60)
}

function finishWith(state: GameState, endingId: string) {
  state.endingId = endingId
  state.phase = 'ending'
  state.daysSurvived = state.day
}

/**
 * 配给费随天数上涨：越接近撤离日，净水、合成食物、药品越贵。
 * 这是 18 天周期里唯一能把「后期压力」做出来的机制 —— 津贴是固定的，物价不是。
 */
export function upkeepFor(data: EventsFile, day: number): number {
  const every = data.config.upkeepRampEvery ?? 0
  const add = data.config.upkeepRampAdd ?? 0
  const base = data.config.dailyUpkeep
  if (!every || !add) return base
  return base + Math.floor((day - 1) / every) * add
}

function advanceDay(state: GameState, data: EventsFile) {
  const upkeep = upkeepFor(data, state.day)
  const wage = data.config.dailyWage ?? 0

  // 执勤津贴：让「不肯脏手」的玩家也能活下去，钱不再只能从坏事里来
  if (wage > 0) {
    state.stats.money += wage
    pushLog(state, {
      day: state.day,
      key: 'ui.log.wage',
      params: { n: wage },
      deltas: [{ key: 'money', value: wage }],
      tone: 'info',
    })
  }

  // 被动恢复：不是每个题材都有「睡觉回精神」的地点事件，
  // 有些世界（比如朝堂）的损耗是结构性的，只能靠每天过夜自然恢复一点。
  const restore = data.config.dailySanityRestore ?? 0
  if (restore > 0) {
    const before = state.stats.sanity
    state.stats.sanity = clampStat('sanity', before + restore)
    if (state.stats.sanity !== before) {
      pushLog(state, {
        day: state.day,
        key: 'ui.log.restore',
        params: { n: restore },
        deltas: [{ key: 'sanity', value: state.stats.sanity - before }],
        tone: 'info',
      })
    }
  }

  if (state.stats.money >= upkeep) {
    state.stats.money -= upkeep
    pushLog(state, {
      day: state.day,
      key: 'ui.log.upkeepPaid',
      params: { n: upkeep },
      deltas: [{ key: 'money', value: -upkeep }],
      tone: 'info',
    })
  } else {
    const before = state.stats.health
    state.stats.health = clampStat('health', before - 25)
    pushLog(state, {
      day: state.day,
      key: 'ui.log.upkeepFail',
      deltas: [{ key: 'health', value: state.stats.health - before }],
      tone: 'bad',
    })
    if (state.stats.health <= 0) {
      finishWith(state, 'ending_starved')
      return
    }
  }

  if (state.day >= data.config.maxDays) {
    const ending = resolveEnding(data.endings, state)
    finishWith(state, ending.id)
    return
  }

  state.day += 1
  state.ap = data.config.actionsPerDay
  state.daysSurvived = state.day
  pushLog(state, {
    day: state.day,
    key: 'ui.log.dayStart',
    params: { day: state.day, n: state.ap },
    tone: 'good',
  })
}

export function resolveEnding(endings: EndingDef[], state: GameState): EndingDef {
  for (const end of endings) {
    if (end.id === 'ending_dead' || end.id === 'ending_mad' || end.id === 'ending_starved') continue
    if (evalCond(end.cond, state)) return end
  }
  return endings[endings.length - 1]
}

export function reducer(state: GameState, action: Action, data: EventsFile): GameState {
  switch (action.type) {
    case 'hydrate':
      return action.state

    case 'new':
      return createInitialState(data)

    case 'enter': {
      if (state.phase !== 'map' || state.ap <= 0) return state

      const ev = pickEvent(data.events, state, action.loc)
      if (!ev) return state

      const next: GameState = {
        ...state,
        ap: state.ap - 1,
        phase: 'event',
        location: action.loc,
        currentEventId: ev.id,
        pending: null,
      }
      next.usedEvents = { ...state.usedEvents, [ev.id]: state.day }
      return next
    }

    case 'choose': {
      if (state.phase !== 'event' || !state.currentEventId) return state

      const ev = data.events.find((e) => e.id === state.currentEventId)
      const choice = ev?.choices.find((c) => c.id === action.choiceId)
      if (!ev || !choice) return state
      if (choice.requires && !evalCond(choice.requires, state)) return state

      const next: GameState = {
        ...state,
        stats: { ...state.stats },
        flags: { ...state.flags },
        keyChoices: [...state.keyChoices],
        phase: 'outcome',
      }

      let deltas: Delta[] = []
      let rollWin: boolean | undefined

      if (choice.roll) {
        rollWin = Math.random() < choice.roll.chance
        const branch = rollWin ? choice.roll.win : choice.roll.lose
        deltas = applyEffects(next, branch.effects)
        if (branch.morality) next.morality += branch.morality
        if (branch.setFlags) Object.assign(next.flags, branch.setFlags)
      } else {
        deltas = applyEffects(next, choice.effects)
        if (choice.morality) next.morality += choice.morality
      }

      if (choice.setFlags) Object.assign(next.flags, choice.setFlags)

      const fatal = next.stats.health <= 0 || next.stats.sanity <= 0

      if (choice.key) {
        const key = `events.${ev.id}.choices.${choice.id}.text`
        if (!next.keyChoices.includes(key)) next.keyChoices.push(key)
      }

      next.pending = {
        eventId: ev.id,
        choiceId: choice.id,
        rollWin,
        deltas,
        fatal,
      }

      pushLog(next, {
        day: state.day,
        key: `events.${ev.id}.choices.${choice.id}.outcome`,
        deltas,
        tone: deltas.some((d) => d.value < 0) ? 'warn' : 'good',
      })

      return next
    }

    case 'ack': {
      if (state.phase !== 'outcome') {
        // 兜底：万一进了「所有选项都锁着」的事件，允许退出而不是卡死
        if (state.phase === 'event') {
          return { ...state, phase: 'map', currentEventId: null, pending: null }
        }
        return state
      }
      const next: GameState = { ...state, pending: null }

      if (state.pending?.fatal) {
        const endingId = next.stats.health <= 0 ? 'ending_dead' : 'ending_mad'
        finishWith(next, endingId)
        return next
      }

      if (next.ap <= 0) {
        // 先回到地图再结算：advanceDay 只负责推进日期与数值，不会改 phase，
        // 少这一步会导致进度停在 outcome 上、结果卡空着但关不掉。
        next.phase = 'map'
        next.currentEventId = null
        advanceDay(next, data)
        return next
      }

      next.phase = 'map'
      next.currentEventId = null
      return next
    }

    case 'endDay': {
      if (state.phase !== 'map') return state
      const next: GameState = { ...state }
      advanceDay(next, data)
      return next
    }

    default:
      return state
  }
}

/** 地点是否还有可抽的事件（用于 UI 置灰） */
export function hasAvailableEvent(events: EventDef[], state: GameState, loc: LocationId): boolean {
  return events.some((e) => e.loc === loc && isEligible(e, state))
}

/** 该地点是否有一条因果连锁事件正在等着玩家 —— 用来打红点 */
export function hasPendingChain(events: EventDef[], state: GameState, loc: LocationId): boolean {
  return events.some((e) => e.loc === loc && e.chain && isEligible(e, state))
}

/**
 * 反推一条因果链「起于哪一天」。
 *
 * events.json 里的 chain 只是个布尔标记，没有指回来源事件；但来源一定设置了某个 flag，
 * 而这个 flag 又被本事件的 cond 读取 —— 顺着 flag 往回找，再查 usedEvents 里那次触发的日期，
 * 就能还原出起点。纯推导，不改数据也不改存档；推不出来就返回 null（UI 会优雅降级）。
 */
export function chainOrigin(
  events: EventDef[],
  state: GameState,
  ev: EventDef,
): { day: number; eventId: string } | null {
  const wanted = [...(ev.cond?.flags ?? []), ...(ev.cond?.anyFlags ?? [])]
  if (wanted.length === 0) return null

  let best: { day: number; eventId: string } | null = null
  for (const flag of wanted) {
    for (const src of events) {
      if (src.id === ev.id) continue
      const day = state.usedEvents[src.id]
      if (day === undefined) continue
      const setsFlag = src.choices.some(
        (c) =>
          c.setFlags?.[flag] ||
          c.roll?.win.setFlags?.[flag] ||
          c.roll?.lose.setFlags?.[flag],
      )
      if (!setsFlag) continue
      // 取最早的那次 —— 一条链的起点，不是最近一次回响
      if (!best || day < best.day) best = { day, eventId: src.id }
    }
  }
  return best
}

export function canAfford(choice: ChoiceDef, state: GameState): boolean {
  if (!choice.requires) return true
  return evalCond(choice.requires, state)
}

/** 当前属于哪一幕（HUD 上显示章节名） */
export function actOf(data: EventsFile, day: number): string {
  let id = data.acts?.[0]?.id ?? ''
  for (const a of data.acts ?? []) if (day >= a.from) id = a.id
  return id
}

export type NpcStatus = 'unknown' | 'met' | 'ally' | 'betray'

/** 关系状态完全由 flag 推导，不需要往存档里加新字段 */
export function npcStatus(npc: NpcDef, state: GameState): NpcStatus {
  if (npc.betrayFlag && state.flags[npc.betrayFlag]) return 'betray'
  if (npc.allyFlag && state.flags[npc.allyFlag]) return 'ally'
  if (npc.metFlag && state.flags[npc.metFlag]) return 'met'
  return 'unknown'
}
