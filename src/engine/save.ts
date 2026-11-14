import type { GameState } from './game'

/**
 * 存档按剧本隔离。
 *
 * 多剧本共用一个引擎，但进度绝对不能串 —— 你在 SECTOR-07 第 12 天的存档，
 * 不该出现在「大靖」的继续游戏里。所以 key 里带上 storyId。
 * 结局档案同理：每个剧本有自己的结局收集进度。
 */
const SAVE_VERSION = 2
const LEGACY_SAVE_KEY = 'sector7.save.v1'
const PREFS_KEY = 'sector7.prefs.v1'
/**
 * 语言偏好单独存，不放进 prefs。
 *
 * 原因是一个真实事故：prefs 里 lang 的默认值是 'zh'，而玩家每点一次
 * 静音/环境音/日卡开关，savePrefs 都会把整个 prefs 写回 localStorage ——
 * 于是英文访客只要动过任何一个设置，'zh' 就被永久写进他的存档，
 * 之后无论浏览器是什么语言，界面都是中文。
 *
 * 现在只有**显式切换语言**（点地球图标、或带 ?lang= 进来）才会写这个 key。
 * 没写过 = 跟随浏览器。
 */
const LANG_KEY = 'sector7.lang.v1'

const saveKey = (storyId: string) => `sector7.save.v${SAVE_VERSION}.${storyId}`
const archiveKey = (storyId: string) => `sector7.archive.v${SAVE_VERSION}.${storyId}`

export interface Prefs {
  sound: boolean
  ambience: boolean
  /**
   * 只在玩家**显式切换**过语言时才有值。
   *
   * 绝对不要给它默认值（历史上是 'zh'）：savePrefs 会在玩家调音量、
   * 关日卡时把整个 Prefs 写盘，默认值就成了「没选过也被当成选过」，
   * 把英文访客锁死成中文。语言的实际读写走 getStoredLang/setStoredLang。
   */
  lang?: 'zh' | 'en'
  /** 上次进入的剧本，下次启动直接续上 */
  story?: string
  /** 日结算过场卡；玩家点过「不再显示」后为 false */
  dayCard?: boolean
}

export const defaultPrefs: Prefs = { sound: true, ambience: true, dayCard: true }

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function validSave(data: GameState | null): GameState | null {
  if (!data) return null
  if (!data.stats || typeof data.day !== 'number') return null
  return data
}

export function saveGame(storyId: string, state: GameState): void {
  try {
    localStorage.setItem(saveKey(storyId), JSON.stringify({ ...state, version: SAVE_VERSION }))
  } catch {
    /* 隐私模式 / 配额满，静默失败不打断游戏 */
  }
}

export function loadGame(storyId: string): GameState | null {
  const current = validSave(safeParse<GameState>(localStorage.getItem(saveKey(storyId))))
  if (current && current.version === SAVE_VERSION) return current

  // 兼容多剧本改造之前的单剧本存档：老 key 只可能属于 sector07
  if (storyId === 'sector07') {
    const legacy = validSave(safeParse<GameState>(localStorage.getItem(LEGACY_SAVE_KEY)))
    if (legacy) return legacy
  }
  return null
}

export function clearSave(storyId: string): void {
  try {
    localStorage.removeItem(saveKey(storyId))
    if (storyId === 'sector07') localStorage.removeItem(LEGACY_SAVE_KEY)
  } catch {
    /* noop */
  }
}

export interface Archive {
  runs: number
  wins: number
  endings: Record<string, number>
}

/** 已达成结局的本地档案，用来展示「你第几次达成这个结局」而不是编造全球百分比 */
export function recordEnding(storyId: string, endingId: string, win: boolean): void {
  const archive = getArchive(storyId)
  archive.runs += 1
  archive.endings[endingId] = (archive.endings[endingId] ?? 0) + 1
  if (win) archive.wins += 1
  try {
    localStorage.setItem(archiveKey(storyId), JSON.stringify(archive))
  } catch {
    /* noop */
  }
}

export function getArchive(storyId: string): Archive {
  return (
    safeParse<Archive>(localStorage.getItem(archiveKey(storyId))) ?? { runs: 0, wins: 0, endings: {} }
  )
}

export function loadPrefs(): Prefs {
  const parsed = safeParse<Record<string, unknown>>(localStorage.getItem(PREFS_KEY)) ?? {}
  // 旧版本把 lang 混在 prefs 里，且默认值是 'zh' —— 老数据里这个字段
  // 分不清「玩家选的中文」和「默认值被写盘」，一律丢掉，改由 LANG_KEY 判定
  delete parsed.lang
  return { ...defaultPrefs, ...(parsed as Partial<Prefs>) }
}

/** 用户是否显式选过语言 —— 没选过则跟随浏览器 */
export function getStoredLang(): 'zh' | 'en' | null {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'zh' || v === 'en' ? v : null
  } catch {
    return null
  }
}

/** 只在玩家显式切换语言时调用；不要在初始化时写入 */
export function setStoredLang(lang: 'zh' | 'en'): void {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* noop */
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* noop */
  }
}
