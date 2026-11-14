import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * 两层「幕间」遮罩，共用一份克制的美学：黑幕、一句话、点一下就走。
 *
 * DayCard  —— 每次换日（月）时的一拍。自动消失，可点掉，可永久关掉。
 * ActCard  —— 第 2 / 3 幕开场。不自动消失，因为题记是要读的。
 *
 * 都不做入场位移动画：这两层的作用是「停一下」，不是「演一段」。
 */

interface DayCardProps {
  day: number
  act: string
  income: number
  spend: number
  onDone: () => void
  onDisable: () => void
}

export function DayCard({ day, act, income, spend, onDone, onDisable }: DayCardProps) {
  const { t } = useTranslation()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), 1300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(onDone, 300)
    return () => clearTimeout(timer)
  }, [leaving, onDone])

  return (
    <div
      onClick={() => setLeaving(true)}
      className={`absolute inset-0 z-[35] flex cursor-pointer flex-col items-center justify-center bg-ink-950 transition-opacity duration-300 animate-fadeIn ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <button
        onClick={(ev) => {
          ev.stopPropagation()
          onDisable()
        }}
        className="absolute right-3 top-3 px-2 py-1 font-serif text-[9.5px] tracking-[0.14em] text-paper-700 transition-colors hover:text-paper-400"
      >
        {t('ui.dayCard.off')}
      </button>

      <span className="font-serif text-[10px] tracking-[0.34em] text-cinnabar-400/80">
        {t(`ui.act.${act}`)}
      </span>

      <div className="mt-4 font-serif text-[40px] leading-none tracking-[0.1em] text-paper-50">
        {t('ui.dayCard.day', { day })}
      </div>

      <div className="mt-5 h-px w-14 bg-cinnabar-700/70" />

      <div className="mt-4 flex items-baseline gap-2.5 font-serif text-[11px] tracking-[0.06em]">
        {income !== 0 && <span className="text-paper-300/80">{t('ui.dayCard.income', { n: income })}</span>}
        {income !== 0 && <span className="text-paper-700">·</span>}
        <span className="text-cinnabar-400/80">{t('ui.dayCard.spend', { n: spend })}</span>
      </div>

      <span className="mt-11 font-serif text-[9.5px] tracking-[0.26em] text-paper-700">
        {t('ui.dayCard.hint')}
      </span>
    </div>
  )
}

interface ActCardProps {
  act: string
  onDone: () => void
}

export function ActCard({ act, onDone }: ActCardProps) {
  const { t } = useTranslation()
  const epigraph = t(`ui.interlude.${act}`, { defaultValue: '' })

  return (
    <div
      onClick={onDone}
      className="absolute inset-0 z-[35] flex cursor-pointer flex-col items-center justify-center bg-ink-950/[0.98] px-10 animate-fadeIn"
    >
      <div className="h-5 w-px bg-cinnabar-700/60" />

      <h2 className="mt-6 animate-fadeUp font-serif text-[26px] leading-none tracking-[0.26em] text-paper-50">
        {t(`ui.act.${act}`)}
      </h2>

      <div className="mt-5 h-px w-8 bg-cinnabar-600/60" />

      {epigraph && (
        <p
          style={{ animationDelay: '140ms' }}
          className="mt-7 max-w-[280px] animate-fadeUp text-center font-serif text-[12.5px] leading-[2.15] tracking-[0.02em] text-paper-300/70"
        >
          {epigraph}
        </p>
      )}

      <span className="mt-12 font-serif text-[9.5px] tracking-[0.26em] text-paper-700">
        {t('ui.dayCard.hint')}
      </span>
    </div>
  )
}
