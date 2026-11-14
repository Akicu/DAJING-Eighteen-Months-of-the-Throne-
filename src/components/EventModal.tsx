import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState } from '../engine/game'
import { canAfford, chainOrigin } from '../engine/game'
import type { EventsFile } from '../types'
import { Icon } from './Icons'

const CN_NUM = ['甲', '乙', '丙', '丁', '戊', '己']
const EN_NUM = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * 风险选项的胜算只说个大概，不给数字。
 * 给了精确概率，玩家就会去算期望值，剧本里那些「赌一把」的时刻就变成了算术题。
 */
function oddsKey(chance: number): 'likely' | 'even' | 'thin' | 'grim' {
  if (chance >= 0.6) return 'likely'
  if (chance >= 0.45) return 'even'
  if (chance >= 0.32) return 'thin'
  return 'grim'
}

/**
 * 落印：按住 420ms 才认。
 *
 * 为什么不直接点 —— 这一批选项的代价是收不回来的（自动存档在 choose 之后立刻写盘），
 * 加一道四分之一秒的门槛既防误触，也让「准」这个动作有点分量。
 * 松手即撤回：进度条退回 0，等于那份朱笔还没落下。
 */
function HoldSeal({ label, holdLabel, onDone }: { label: string; holdLabel: string; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const done = useRef(false)
  const raf = useRef(0)
  const t0 = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const start = () => {
    if (done.current) return
    t0.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0.current) / 420)
      setProgress(p)
      if (p >= 1) {
        done.current = true
        onDone()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const cancel = () => {
    if (done.current) return
    cancelAnimationFrame(raf.current)
    setProgress(0)
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="unselectable relative w-full overflow-hidden border border-cinnabar-600/55 bg-cinnabar-700/[0.12] py-3 font-serif text-[13px] tracking-[0.24em] text-cinnabar-200"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-cinnabar-600/45"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative flex flex-col items-center gap-1">
        <span className="text-[15px] leading-none tracking-[0.3em]">{label}</span>
        <span className="font-serif text-[9px] leading-none tracking-[0.2em] opacity-55">{holdLabel}</span>
      </span>
    </button>
  )
}

interface Props {
  state: GameState
  data: EventsFile
  onChoose: (choiceId: string) => void
  onAck: () => void
}

export function EventModal({ state, data, onChoose, onAck }: Props) {
  const { t, i18n } = useTranslation()
  const event = data.events.find((e) => e.id === state.currentEventId)
  const pending = state.pending
  const showingOutcome = state.phase === 'outcome'
  // 落笔：点选项时在指尖位置渗开的一圈墨。必须绑 choiceId，
  // 否则四五个选项会同时渗出墨点（ink 是组件级 state，不是选项级的）
  const [ink, setInk] = useState<{ x: number; y: number; id: number; choiceId: string } | null>(null)

  const choiceCount = event?.choices.length ?? 0
  const numerals = i18n.language === 'zh' ? CN_NUM : EN_NUM
  const portrait = event?.npc ? data.npcs.find((n) => n.id === event.npc)?.portrait : undefined
  const heroArt = event?.art ?? data.locations.find((l) => l.id === event?.loc)?.art ?? undefined
  // 因果链事件如果能还原出起点，就在顶部补一行「起于第 9 月 · 那些册子」
  const origin = event?.chain ? chainOrigin(data.events, state, event) : null

  useEffect(() => {
    if (!event) return
    const onKey = (ev: KeyboardEvent) => {
      if (showingOutcome) {
        // 键盘用户不走长按：Enter / 空格直接落印
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onAck()
        }
        return
      }
      const n = Number(ev.key)
      if (n >= 1 && n <= choiceCount) {
        const choice = event.choices[n - 1]
        if (canAfford(choice, state)) onChoose(choice.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [event, choiceCount, showingOutcome, onAck, onChoose, state])

  if (!event) return null
  // 兜底：结算数据丢了就别停在空白结果卡上（正常流程不会走到这里）
  if (state.phase === 'outcome' && !pending) return null

  const outcomeKey = pending
    ? pending.rollWin === undefined
      ? `events.${pending.eventId}.choices.${pending.choiceId}.outcome`
      : `events.${pending.eventId}.choices.${pending.choiceId}.${pending.rollWin ? 'win' : 'lose'}`
    : ''

  return (
    // 背景必须完全不透明。原来是 /[0.98]，98% 看起来够黑，但地图页那五个亮色地点名
    // 会透上来变成「幽灵字」，正好压在选项区后面，读起来像串行。
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-ink-950 animate-fadeIn">
      <div className="relative flex shrink-0 items-baseline justify-between gap-2 px-4 pb-2.5 pt-3">
        <span className="flex min-w-0 items-baseline gap-2 font-serif text-[10px] tracking-[0.16em] text-paper-600">
          <span className="shrink-0">{t('ui.event.tag')}</span>
          <span className="text-paper-700">·</span>
          <span className="truncate text-paper-400">
            {state.location ? t(`locations.${state.location}.name`) : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          {event.npc && (
            <span className="flex items-center gap-1.5">
              {portrait ? <img src={portrait} alt="" className="h-4 w-4 object-cover" /> : null}
              <span className="font-serif text-[10px] tracking-[0.06em] text-paper-300">
                {t(`npcs.${event.npc}.name`)}
              </span>
            </span>
          )}
          {event.chain && (
            <span className="flex items-center gap-1 font-serif text-[10px] tracking-[0.1em] text-cinnabar-400">
              <Icon name="chain" className="h-2.5 w-2.5" strokeWidth={1.6} />
              {t('ui.badge.chain')}
            </span>
          )}
        </span>
      </div>

      {origin && (
        <div className="relative flex shrink-0 items-baseline gap-2 py-1.5 pl-3.5 pr-4 bg-cinnabar-700/[0.07]">
          <span className="absolute inset-y-0 left-0 w-[2px] bg-cinnabar-600" />
          <span className="shrink-0 font-serif text-[10px] tracking-[0.08em] text-cinnabar-300">
            {t('ui.badge.chainFrom', { day: origin.day })}
          </span>
          <span className="min-w-0 truncate text-[10.5px] text-paper-600">
            {t(`events.${origin.eventId}.title`)}
          </span>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 animate-slideUp flex-col overflow-y-auto">
        {heroArt && (
          <div className="relative h-[124px] w-full shrink-0 overflow-hidden">
            <img
              src={heroArt}
              alt=""
              className="h-full w-full object-cover object-[center_38%] opacity-70"
              onError={(e) => {
                e.currentTarget.parentElement?.style.setProperty('display', 'none')
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/15" />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col px-5 py-5">
          <h2 className="font-serif text-[21px] leading-[1.4] tracking-[0.1em] text-paper-50">
            {t(`events.${event.id}.title`)}
          </h2>

          <div className="mt-1.5 h-px w-8 shrink-0 bg-cinnabar-600/50" />

          {/* 正文直接落在纸上：没有卡片框、没有底色。宋体 + 1.95 行高是这套剧本的阅读基线 */}
          <p className="mt-3.5 animate-fadeUp whitespace-pre-line font-serif text-[14px] leading-[1.95] tracking-[0.01em] text-paper-200/90">
            {t(`events.${event.id}.desc`)}
          </p>

          {showingOutcome && pending ? (
            <div
              className={`mt-5 animate-fadeUp border-l-2 py-3 pl-3.5 pr-2 ${
                pending.rollWin === true
                  ? 'border-paper-300/70 bg-paper-100/[0.04]'
                  : pending.rollWin === false
                    ? 'border-cinnabar-500 bg-cinnabar-700/[0.1]'
                    : 'border-cinnabar-600/80 bg-cinnabar-700/[0.08]'
              }`}
            >
              {pending.rollWin !== undefined && (
                <div
                  className={`mb-2 flex animate-fadeIn items-center gap-1.5 font-serif text-[10px] tracking-[0.24em] ${
                    pending.rollWin ? 'text-paper-300' : 'text-cinnabar-400'
                  }`}
                >
                  <Icon name="dice" className="h-3 w-3" strokeWidth={1.5} />
                  {t(pending.rollWin ? 'ui.roll.win' : 'ui.roll.lose')}
                </div>
              )}
              <p className="font-serif text-[13.5px] leading-[1.9] text-paper-200/85">{t(outcomeKey)}</p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {pending.deltas.length === 0 ? (
                  <span className="font-serif text-[11px] text-paper-600">
                    {t('ui.log.effectNone')}
                  </span>
                ) : (
                  // 每条错开 60ms 落下：一眼能数清这一笔付出了几项，而不是四个数字同时出现
                  pending.deltas.map((d, i) => (
                    <span
                      key={`${d.key}-${i}`}
                      style={{ animationDelay: `${60 + i * 60}ms` }}
                      className="flex animate-fadeUp items-baseline gap-1.5"
                    >
                      <span className="font-serif text-[11px] text-paper-600">{t(`ui.stat.${d.key}`)}</span>
                      <span
                        className={`font-mono text-[14px] tabular-nums ${
                          d.value > 0 ? 'text-paper-100' : 'text-cinnabar-300'
                        }`}
                      >
                        {/* 负值只靠朱色区分，不划线。
                            横线划过数字在 UI 里就是「删除线」的意思 —— 玩家读到的不是
                            「国库少了五万」，而是「这个数字作废了」。朱笔批注那层意思
                            只有写的人自己知道，看的人看到的是错字被划掉 */}
                        <span aria-hidden="true">{d.value > 0 ? '+' : '−'}</span>
                        {Math.abs(d.value)}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className={`mt-5 ${showingOutcome ? 'sticky bottom-0 z-10 -mx-5 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-5 pb-1 pt-4' : ''}`}>
            {showingOutcome ? (
              <HoldSeal
                label={t('ui.action.confirm')}
                holdLabel={t('ui.action.hold')}
                onDone={onAck}
              />
            ) : (
              <div>
                {event.choices.map((choice, i) => {
                  const unlocked = canAfford(choice, state)
                  return (
                    <button
                      key={choice.id}
                      onClick={() => unlocked && onChoose(choice.id)}
                      onPointerDown={(e) => {
                        if (!unlocked) return
                        const r = e.currentTarget.getBoundingClientRect()
                        setInk({
                          x: e.clientX - r.left,
                          y: e.clientY - r.top,
                          id: Date.now(),
                          choiceId: choice.id,
                        })
                      }}
                      disabled={!unlocked}
                      style={{ animationDelay: `${i * 45}ms` }}
                      className={`group relative flex w-full animate-fadeUp items-start gap-3 py-3.5 pl-2.5 pr-1 text-left transition-colors duration-150
                        ${
                          unlocked
                            ? 'hover:bg-paper-100/[0.025] active:bg-paper-100/[0.05]'
                            : 'cursor-not-allowed opacity-35'
                        }`}
                    >
                      {/* 悬停时从左侧压出一道朱色书签，代替整块按钮的边框高亮 */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-1.5 left-0 w-[2px] transition-opacity duration-150 ${
                          choice.tone === 'dark' && unlocked
                            ? 'bg-cinnabar-500 opacity-0 group-hover:opacity-100'
                            : 'bg-paper-300 opacity-0 group-hover:opacity-100'
                        }`}
                      />

                      {ink && ink.choiceId === choice.id && (
                        <span
                          key={ink.id}
                          aria-hidden="true"
                          className="pointer-events-none absolute h-24 w-24 animate-inkSpread rounded-full"
                          style={{
                            left: ink.x - 48,
                            top: ink.y - 48,
                            // 径向渐变代替纯色圆：边缘要化开，否则在深底上是一个硬边的暗斑，
                            // 不像墨，像污渍。上 blur 也能做，但手机上每帧重绘代价太大
                            background:
                              'radial-gradient(circle, rgba(204,101,81,0.55) 0%, rgba(204,101,81,0.28) 45%, rgba(204,101,81,0) 70%)',
                          }}
                        />
                      )}

                      <span className="mt-[3px] w-4 shrink-0 font-serif text-[11px] tracking-[0.04em] text-paper-500">
                        {numerals[i] ?? i + 1}
                      </span>

                      <span className="min-w-0 flex-1">
                        {/* 去掉选项之间的分隔线之后，可点性只能靠亮度差交代：
                            正文是 paper-200/90，选项抬到 paper-100，从段落里浮出来一格 */}
                        <span
                          className={`block font-serif text-[13.5px] leading-[1.75] tracking-[0.01em] ${
                            unlocked ? 'text-paper-100' : 'text-paper-400'
                          }`}
                        >
                          {t(`events.${event.id}.choices.${choice.id}.text`)}
                        </span>
                        {!unlocked && choice.requires && (
                          <span className="mt-1 flex items-center gap-1 font-serif text-[10.5px] text-cinnabar-400/80">
                            <Icon name="lock" className="h-2.5 w-2.5" strokeWidth={1.6} />
                            {t(`events.${event.id}.choices.${choice.id}.req`)}
                          </span>
                        )}
                        {choice.roll && unlocked && (
                          <span className="mt-1 flex items-center gap-1 font-serif text-[10.5px] text-cinnabar-400/70">
                            <Icon name="dice" className="h-2.5 w-2.5" strokeWidth={1.5} />
                            {t('ui.roll.tag')} · {t(`ui.roll.${oddsKey(choice.roll.chance)}`)}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
