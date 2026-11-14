import { useTranslation } from 'react-i18next'
import type { GameState, LogEntry } from '../engine/game'
import { hasAvailableEvent, hasPendingChain, npcStatus, upkeepFor } from '../engine/game'
import type { EventsFile, LocationId, StatKey } from '../types'
import { Icon } from './Icons'

const STAT_COLOR: Record<StatKey, string> = {
  health: 'text-cinnabar-400',
  sanity: 'text-stone-400',
  money: 'text-paper-200',
  favor: 'text-paper-300',
}

const TONE: Record<NonNullable<LogEntry['tone']>, string> = {
  info: 'text-paper-600',
  good: 'text-paper-300',
  bad: 'text-cinnabar-400',
  warn: 'text-cinnabar-300',
}

const CN_NUM = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const EN_NUM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

/** 第 7 日写成「初七」。「起居注」配一个阿拉伯数字的 D7 是出戏的；
    但科幻题材反过来，写成「初七」同样出戏。所以由 config.dayLabel 决定，不按剧本 id 硬判 */
function dayLabel(n: number, lunar: boolean) {
  if (!lunar) return `D${n}`
  const ones = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n <= 10) return `初${ones[n]}`
  if (n < 20) return `十${ones[n % 10]}`
  if (n === 20) return '二十'
  return `二十${ones[n % 10]}`
}

function LogLine({ entry, lunar }: { entry: LogEntry; lunar: boolean }) {
  const { t } = useTranslation()
  const text = t(entry.key, entry.params as Record<string, string | number>)
  return (
    <div className="flex gap-2 leading-relaxed">
      <span className="shrink-0 font-serif text-[10px] text-paper-700">{dayLabel(entry.day, lunar)}</span>
      <span className={TONE[entry.tone ?? 'info']}>
        {text}
        {entry.deltas && entry.deltas.length > 0 && (
          <span className="ml-1.5 font-mono text-[10px]">
            {entry.deltas.map((d) => (
              <span key={d.key} className={`mr-1 ${STAT_COLOR[d.key]}`}>
                {d.value > 0 ? '+' : ''}
                {d.value}
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  )
}

interface Props {
  state: GameState
  data: EventsFile
  onEnter: (loc: LocationId) => void
  onEndDay: () => void
  onOpenContacts: () => void
}

/* 关系档的几个格子。未接触的那种不画框 —— 四个细框并排会读成一张待填的表，
   用一块几乎看不见的暗底占位就够；有关系的才给彩色边框 */
const NPC_RING = {
  unknown: 'border-transparent bg-paper-100/[0.03]',
  met: 'border-stone-500/60',
  ally: 'border-paper-300/70',
  betray: 'border-cinnabar-500/65 grayscale opacity-55',
} as const

export function MapScreen({ state, data, onEnter, onEndDay, onOpenContacts }: Props) {
  const { t, i18n } = useTranslation()
  const noAp = state.ap <= 0
  const numerals = i18n.language === 'zh' ? CN_NUM : EN_NUM
  const lunar = data.config.dayLabel === 'lunar'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-3.5">
        <div className="pb-1">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            {/* 不截断：中文的目标句短，英文同义句会长一倍（"Fill the treasury to 240k
                taels before accession"），truncate 会把后半截吃掉，而这一行是玩家唯一
                能看到的通关条件 */}
            <span className="min-w-0 flex-1 font-serif leading-snug tracking-[0.04em] text-paper-400">
              {t('ui.goal.money', { money: data.config.ticketCost })}
            </span>
            <span className="shrink-0 font-mono text-[9.5px] text-paper-600">
              {t('ui.ap.upkeep', {
                n: upkeepFor(data, state.day),
                every: data.config.upkeepRampEvery ?? 0,
              })}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 font-serif text-[11px] leading-snug tracking-[0.04em] text-paper-600">
              {t('ui.goal.favor', { favor: data.config.ticketFavor })}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="font-serif text-[10px] tracking-[0.1em] text-paper-500">
                {t('ui.ap.label')}
              </span>
              <span className="flex gap-1">
                {Array.from({ length: data.config.actionsPerDay }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-1 ${i < state.ap ? 'bg-paper-300' : 'bg-paper-100/15'}`}
                  />
                ))}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-1">
          {data.locations.map((loc, idx) => {
            const available = hasAvailableEvent(data.events, state, loc.id)
            const chain = hasPendingChain(data.events, state, loc.id)
            const disabled = noAp || !available
            const mark = chain && !disabled

            return (
              <button
                key={loc.id}
                onClick={() => onEnter(loc.id)}
                disabled={disabled}
                className={`group relative flex w-full items-baseline gap-2.5 py-3.5 pl-2.5 pr-1 text-left transition-colors duration-150
                  ${disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-paper-100/[0.025] active:bg-paper-100/[0.045]'}`}
              >
                {/* 有因果链在等：左侧一道朱色书签，代替原来的红点与呼吸边框 */}
                {mark && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-[2px] animate-breathe bg-cinnabar-500"
                  />
                )}

                <span
                  className={`w-4 shrink-0 font-serif text-[11px] leading-none tracking-[0.04em] ${
                    mark ? 'text-cinnabar-400' : 'text-paper-700'
                  }`}
                >
                  {numerals[idx] ?? idx + 1}
                </span>

                <span className="h-9 w-9 shrink-0 self-center overflow-hidden">
                  {loc.art ? (
                    <img
                      src={loc.art}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover ${disabled ? 'grayscale' : ''}`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1 self-center">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate font-serif text-[13.5px] tracking-[0.08em] text-paper-100">
                      {t(`locations.${loc.id}.name`)}
                    </span>
                    {mark && (
                      <span className="flex shrink-0 items-center gap-0.5 font-serif text-[9.5px] tracking-[0.08em] text-cinnabar-400">
                        <Icon name="chain" className="h-2.5 w-2.5" strokeWidth={1.6} />
                        {t('ui.badge.chainPending')}
                      </span>
                    )}
                  </span>
                  {/* 两行封顶，不用 truncate。英文地点描述平均比中文长 1.7 倍，
                      单行截断会把五个地点全部切成 "Money is where loyalty i…" 这种断句 ——
                      一行字读不完整，玩家就判断不出该去哪个地点 */}
                  <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-paper-600">
                    {t(`locations.${loc.id}.desc`)}
                  </span>
                </span>

                <span className="shrink-0 font-serif text-[10.5px] tracking-[0.06em] text-paper-600">
                  {t('ui.event.apCost', { n: loc.apCost })}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="font-serif text-[10px] tracking-[0.16em] text-paper-600">
            {t('ui.contacts.open')}
          </span>
          <div className="flex gap-1.5">
            {data.npcs.map((npc) => {
              const st = npcStatus(npc, state)
              return (
                <button
                  key={npc.id}
                  onClick={onOpenContacts}
                  aria-label={
                    st === 'unknown' ? t('ui.contacts.status.unknown') : t(`npcs.${npc.id}.name`)
                  }
                  className={`relative h-8 w-7 overflow-hidden border transition active:opacity-70 ${NPC_RING[st]}`}
                >
                  {st === 'unknown' || !npc.portrait ? (
                    <span className="grid h-full w-full place-items-center font-serif text-[11px] text-paper-600">
                      ?
                    </span>
                  ) : (
                    <img src={npc.portrait} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={onEndDay}
          disabled={state.ap <= 0}
          className={`mt-3 flex w-full items-center justify-center gap-2 border py-2.5 font-serif text-[12px] tracking-[0.22em] transition-colors duration-200
            ${
              state.ap <= 0
                ? 'border-cinnabar-600/60 bg-cinnabar-700/15 text-cinnabar-300'
                : 'border-paper-100/[0.12] text-paper-500 hover:border-paper-100/25 hover:text-paper-200'
            }`}
        >
          {state.ap <= 0 && (
            <span aria-hidden="true" className="h-1 w-1 animate-breathe bg-cinnabar-500" />
          )}
          {t('ui.action.endDay')}
        </button>
      </div>

      <div className="shrink-0 border-t border-paper-100/[0.09] bg-ink-950/70 px-4 py-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-serif text-[9.5px] tracking-[0.2em] text-paper-600">
            {t('ui.log.title')}
          </span>
          <span className="font-mono text-[9px] text-paper-700">
            {String(state.log.length).padStart(2, '0')}
          </span>
        </div>
        <div className="h-[72px] space-y-1 overflow-y-auto pr-1 text-[10.5px]">
          {state.log.map((entry) => (
            <LogLine key={entry.id} entry={entry} lunar={lunar} />
          ))}
        </div>
      </div>
    </div>
  )
}
