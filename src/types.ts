/**
 * 全部剧本数据结构定义。
 * 关键点：条件用「声明式 DSL」表达，而不是 JS 函数 —— 这样 events.json 才能被
 * 非程序员（编剧 / 翻译）直接编辑，也能被校验脚本静态检查。
 */

export type StatKey = 'health' | 'sanity' | 'money' | 'favor'

/**
 * 地点 id 由剧本自己定义（SECTOR-07 是 gate/pub/…，大靖是 court/study/…），
 * 引擎只按 id 匹配，不关心具体叫什么。所以这里放开成 string。
 */
export type LocationId = string

export type Accent = 'amber' | 'violet' | 'sky' | 'emerald' | 'rose'

/** 声明式触发条件。所有字段为「与」关系，省略即不限制。 */
export interface Cond {
  /** 这些 flag 必须全部为 true */
  flags?: string[]
  /** 这些 flag 必须全部为 false */
  notFlags?: string[]
  /** 至少一个 flag 为 true */
  anyFlags?: string[]
  dayMin?: number
  dayMax?: number
  statMin?: Partial<Record<StatKey, number>>
  statMax?: Partial<Record<StatKey, number>>
  moralityMin?: number
  moralityMax?: number
  /** 0~1，每次抽取时掷一次 */
  chance?: number
}

export interface OutcomeBranch {
  effects?: Partial<Record<StatKey, number>>
  morality?: number
  setFlags?: Record<string, boolean>
}

/** 随机事件分支：赌博、抽签、赌命 */
export interface RollDef {
  /** 0~1 的成功概率 */
  chance: number
  win: OutcomeBranch
  lose: OutcomeBranch
}

export interface ChoiceDef {
  id: string
  /** 数值增减，可正可负 */
  effects?: Partial<Record<StatKey, number>>
  /** 道德加减，影响结局分支 */
  morality?: number
  /** 选项锁定条件（不满足则置灰并展示原因） */
  requires?: Cond
  setFlags?: Record<string, boolean>
  /** 存在时走随机结算，effects 字段被忽略 */
  roll?: RollDef
  /** 语气色：good 善意 / neutral 中立 / dark 冷酷 */
  tone?: 'good' | 'neutral' | 'dark'
  /** 是否计入结局卡的「关键抉择」 */
  key?: boolean
}

export interface EventDef {
  id: string
  loc: LocationId
  /** 关联 NPC（关系面板会显示 TA 的状态；事件卡会显示头像） */
  npc?: string
  /** 事件插画，放 public/art/ 下，如 "art/ev-gate-mother.webp" */
  art?: string
  /** 越高越优先，用于因果链的强制触发 */
  priority?: number
  weight?: number
  /** 全局只触发一次 */
  once?: boolean
  /** 触发后 N 天内不再出现 */
  cooldown?: number
  /** 可重复事件不受 once 限制，作为兜底池 */
  repeatable?: boolean
  cond?: Cond
  /** 因果连锁事件，UI 上会打标记 */
  chain?: boolean
  choices: ChoiceDef[]
}

export interface LocationDef {
  id: LocationId
  accent: Accent
  icon: 'gate' | 'pub' | 'medbay' | 'market' | 'dorm' | 'throne' | 'scroll' | 'vault' | 'banner' | 'moon'
  apCost: number
  /** 地点背景插画 */
  art?: string
}

/**
 * 核心 NPC。关系状态不用单独存数值 —— 由 flag 推导，
 * 这样存档结构不变，编剧也能靠 flag 决定谁能出现在结局里。
 */
export interface NpcDef {
  id: string
  accent: Accent
  /** 头像，放 public/art/npc/ 下 */
  portrait?: string
  /** 见过面 */
  metFlag?: string
  /** 站到你这边 */
  allyFlag?: string
  /** 彻底翻脸 */
  betrayFlag?: string
}

/** 幕：只用于 HUD 上显示当前章节名 */
export interface ActDef {
  from: number
  id: string
}

export interface EndingDef {
  id: string
  win: boolean
  /** 1~5 星，设计上定义的稀有度（不是伪造的统计数据） */
  rarity: 1 | 2 | 3 | 4 | 5
  /** 顺序匹配，第一个命中的生效；最后一条应为无条件兜底 */
  cond?: Cond
}

export interface EventsFile {
  version: number
  config: {
    maxDays: number
    actionsPerDay: number
    ticketCost: number
    ticketFavor: number
    dailyUpkeep: number
    /** 每日执勤津贴，收工后发放 */
    dailyWage?: number
    /** 配给费每 N 天上涨一次（越接近撤离日，物资越贵） */
    upkeepRampEvery?: number
    upkeepRampAdd?: number
    /** 每天过夜自然恢复的理智（有些题材没有「睡觉」地点事件） */
    dailySanityRestore?: number
    /**
     * 日志里的日期写法。lunar = 初七 / 十二（古装题材），numeric = D7（默认）。
     * 不按剧本 id 硬编码：再加第三个剧本时，这里配一次就行。
     */
    dayLabel?: 'lunar' | 'numeric'
    startStats: Record<StatKey, number>
    statCeiling: number
  }
  locations: LocationDef[]
  npcs: NpcDef[]
  acts: ActDef[]
  events: EventDef[]
  endings: EndingDef[]
}

export interface Stats extends Record<StatKey, number> {}
