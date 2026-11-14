import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState } from '../engine/game'
import { actOf } from '../engine/game'
import type { EventsFile, StatKey } from '../types'
import { Icon } from './Icons'

const ORDER: StatKey[] = ['health', 'sanity', 'money', 'favor']

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 数字滚动：只为了让「刚刚发生了 +9」这件事有重量。
 * 用 rAF 逐帧取整，不做缓动库 —— 40 行的东西不值得拉依赖。
 */
function useAnimatedNumber(target: number, animate: boolean): number {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)

  useEffect(() => {
    if (!animate) {
      shownRef.current = target
      setShown(target)
      return
    }
    const from = shownRef.current
    if (from === target) return

    let raf = 0
    const start = performance.now()
    const dur = 320
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = Math.round(from + (target - from) * eased)
      shownRef.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, animate])

  return shown
}

interface CellProps {
  k: StatKey
  value: number
  pop?: { v: number; id: number }
}

function StatCell({ k, value, pop }: CellProps) {
  const { t } = useTranslation()
  const shown = useAnimatedNumber(value, !REDUCED)
  // 钱的下限参考线和其余三项不同：国库 30 万两以下基本等于这个月什么都办不成
  const low = k === 'money' ? value < 30 : value < 26

  return (
    <div className="relative min-w-0 flex-1 pl-3 first:pl-0">
      <div className="flex items-center gap-1">
        {/* 危险线不用彩色格子表示：一个小朱点就够了，多一个色块就多一分模板感 */}
        {low && <span aria-hidden="true" className="h-1 w-1 shrink-0 animate-breathe bg-cinnabar-500" />}
        <span
          className={`truncate font-serif text-[10.5px] leading-none tracking-[0.08em] ${
            low ? 'text-cinnabar-400' : 'text-paper-500'
          }`}
        >
          {t(`ui.stat.${k}`)}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <span
          // key 变化会重挂载，从而让 shake 每次都重播（同名 animation 在 React 里不会自动重跑）
          key={pop?.id ?? 0}
          className={`font-mono text-[16px] leading-none tabular-nums ${
            low ? 'text-cinnabar-400' : 'text-paper-100'
          } ${pop && pop.v < 0 ? 'animate-shake' : ''}`}
        >
          {shown}
        </span>
        {pop && (
          <span
            key={`p-${pop.id}`}
            className={`animate-floatUp font-mono text-[9.5px] leading-none ${
              pop.v > 0 ? 'text-paper-200' : 'text-cinnabar-400'
            }`}
          >
            {pop.v > 0 ? '+' : ''}
            {pop.v}
          </span>
        )}
      </div>
    </div>
  )
}

interface Props {
  state: GameState
  data: EventsFile
  onToggleSound: () => void
  onToggleLang: () => void
  onOpenContacts: () => void
  soundOn: boolean
}

export function Hud({
  state,
  data,
  onToggleSound,
  onToggleLang,
  onOpenContacts,
  soundOn,
}: Props) {
  const { t, i18n } = useTranslation()
  const zh = i18n.language === 'zh'
  const act = actOf(data, state.day)

  const [pops, setPops] = useState<Partial<Record<StatKey, { v: number; id: number }>>>({})
  const prevStats = useRef(state.stats)
  const seq = useRef(0)

  useEffect(() => {
    const before = prevStats.current
    prevStats.current = state.stats
    if (before === state.stats) return

    const fresh: Partial<Record<StatKey, { v: number; id: number }>> = {}
    for (const k of ORDER) {
      const d = state.stats[k] - before[k]
      if (d !== 0) fresh[k] = { v: d, id: ++seq.current }
    }
    if (Object.keys(fresh).length === 0) return

    setPops(fresh)
    const timer = setTimeout(() => {
      // 只清掉自己这批，避免把中途新进来的一批也抹掉
      setPops((cur) => {
        const next = { ...cur }
        for (const k of ORDER) if (next[k]?.id === fresh[k]?.id) delete next[k]
        return next
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [state.stats])

  // 有 NPC 处于「可推进」状态时给个朱点，提示玩家别只刷同一个地方
  const allyCount = data.npcs.filter(
    (n) => state.flags[n.allyFlag ?? ''] && !state.flags[n.betrayFlag ?? ''],
  ).length

  const iconBtn =
    'relative grid h-7 w-7 place-items-center text-paper-500 transition-colors duration-150 hover:text-paper-100'

  return (
    <header className="relative shrink-0 border-b border-paper-100/[0.1] bg-ink-950/95 px-4 pb-2.5 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2.5">
          {/* 0.34em 是给两字中文标题（大靖）的字距；套到 9 个字母的 SECTOR-07 上
              会把副标题挤没（"Evacuation Cou…"）。拉丁标题收窄到 0.2em */}
          <span
            className={`shrink-0 font-serif text-[18px] leading-none text-paper-50 ${
              zh ? 'tracking-[0.34em]' : 'tracking-[0.2em]'
            }`}
          >
            {t('ui.appTitle')}
          </span>
          {/* 英文副标题比中文长一倍，不截断会顶到右边三个图标上 */}
          <span className="min-w-0 truncate font-serif text-[10.5px] tracking-[0.12em] text-paper-600">
            {t('ui.appSubtitle')}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={onOpenContacts} className={iconBtn} aria-label={t('ui.contacts.title')}>
            <Icon name="users" className="h-[15px] w-[15px]" strokeWidth={1.5} />
            {allyCount > 0 && (
              <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-cinnabar-500" />
            )}
          </button>
          <button onClick={onToggleLang} className={iconBtn} aria-label={t('ui.settings.language')}>
            <Icon name="globe" className="h-[15px] w-[15px]" strokeWidth={1.5} />
          </button>
          <button onClick={onToggleSound} className={iconBtn} aria-label={t('ui.settings.sound')}>
            <Icon name={soundOn ? 'sound' : 'mute'} className="h-[15px] w-[15px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-stretch">
        {ORDER.map((key) => (
          <StatCell key={key} k={key} value={state.stats[key]} pop={pops[key]} />
        ))}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-serif text-[10.5px] tracking-[0.14em] text-paper-500">
          {t(`ui.act.${act}`)}
        </span>
        <span className="font-mono text-[10px] tracking-[0.06em] text-paper-600">
          {t('ui.day', { day: state.day, max: data.config.maxDays })}
        </span>
      </div>
    </header>
  )
}
