import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState } from '../engine/game'
import { track } from '../engine/analytics'
import type { EventsFile, StatKey } from '../types'
import { Icon } from './Icons'
import { renderShareCard, shareOrDownload } from '../utils/shareCard'
import { audio } from '../audio/audio'

const STAT_ORDER: StatKey[] = ['health', 'sanity', 'money', 'favor']

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 评语一句一句落，中间停顿均匀。句子长度差得多，所以不按字数加权 */
const LINE_STEP = 180
const LINE_BASE = 140

/**
 * 按句切分评语。
 *
 * 优先用 Intl.Segmenter：中英文的断句规则完全不同（中文看句末标点、英文还要避开
 * 「Mr.」「Sgt.」这类缩写），手写正则一定会切错其中一边。Segmenter 不可用时
 * 退回整段 —— 少一层动画，但文案不会被打断成碎片。
 */
function splitSentences(text: string, lang: string): string[] {
  const src = text.trim()
  if (!src) return []
  try {
    const Seg = (
      Intl as unknown as {
        Segmenter?: new (
          l: string,
          o: { granularity: 'sentence' },
        ) => { segment: (s: string) => Iterable<{ segment: string }> }
      }
    ).Segmenter
    if (Seg) {
      const seg = new Seg(lang, { granularity: 'sentence' })
      const out = Array.from(seg.segment(src), (s) => s.segment.trim()).filter(Boolean)
      if (out.length) return out
    }
  } catch {
    /* 老 Safari 没有 Segmenter */
  }
  return [src]
}

interface Props {
  state: GameState
  data: EventsFile
  /** 本机累计达成该结局的次数，由 App 在写入档案后传入 */
  timesReached: number
  onRestart: () => void
}

/**
 * 结局页：一份史官写的结语，末尾盖一枚印。
 *
 * 这一页是玩家唯一会截图带走的东西，所以按「卷宗」排版而不是按「结算面板」：
 * 评语逐句淡入（读它，不是扫它），全部落定之后朱印砸下来，然后按钮才出现。
 * 顺序反了就成了「有动画的弹窗」。
 */
export function EndingScreen({ state, data, timesReached, onRestart }: Props) {
  const { t, i18n } = useTranslation()
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 落印之后才放按钮出来。reduced-motion 下不等，直接给终端状态
  const [sealed, setSealed] = useState(REDUCED)

  const ending = data.endings.find((e) => e.id === state.endingId) ?? data.endings[data.endings.length - 1]
  const times = timesReached

  const desc = t(`endings.${ending.id}.desc`)
  const sentences = useMemo(() => splitSentences(desc, i18n.language), [desc, i18n.language])
  // 时间轴：最后一句淡入完 → 停半拍 → 落印。下限 1.2s，
  // 否则两句话的结局会在玩家刚看清标题时就盖章，仪式感全无
  const sealAt = REDUCED
    ? 200
    : Math.max(1200, LINE_BASE + sentences.length * LINE_STEP + 520)

  useEffect(() => {
    if (sealed) return
    const timer = setTimeout(() => {
      setSealed(true)
      audio.play('stamp')
    }, sealAt)
    return () => clearTimeout(timer)
  }, [sealed, sealAt])

  const code = useMemo(() => {
    const n = Math.abs(
      [...(state.endingId ?? 'x')].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7),
    )
    return `#S7-${String((n + state.daysSurvived * 137) % 10000).padStart(4, '0')}`
  }, [state.endingId, state.daysSurvived])

  async function handleShare() {
    if (busy) return
    setBusy(true)
    track('share_click', { ending: ending.id })
    try {
      const choices = state.keyChoices.slice(0, 4).map((key) => t(key))
      const { dataUrl } = renderShareCard({
        label: t('ui.share.label'),
        win: ending.win,
        winText: t('ui.ending.win'),
        loseText: t('ui.ending.lose'),
        title: t(`endings.${ending.id}.title`),
        desc: t(`endings.${ending.id}.desc`),
        rarity: ending.rarity,
        rarityLabel: t(`ui.rarity.${ending.rarity}`),
        statsLabel: t('ui.share.stats'),
        stats: STAT_ORDER.map((k) => ({ label: t(`ui.stat.${k}`), value: state.stats[k] })),
        daysLabel: t('ui.ending.days', { n: state.daysSurvived }),
        choicesLabel: t('ui.ending.trajectory'),
        choices,
        codeLabel: t('ui.share.code'),
        code,
        footer: t('ui.share.footer'),
      })
      setPreview(dataUrl)
      track('share_done', { ending: ending.id })
    } catch {
      // 极少数浏览器禁用 canvas 编码
      alert(t('ui.ending.shareFail'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!preview) return
    await shareOrDownload(preview, `sector7-${ending.id}-${i18n.language}.png`)
  }

  // 不想等就走：点一下页面上任何空白处，直接落印
  function skip() {
    if (sealed) return
    setSealed(true)
    audio.play('stamp')
  }

  const zh = i18n.language.startsWith('zh')
  const sealLine = [t('ui.ending.sealLine1'), t('ui.ending.sealLine2')]

  return (
    <div
      onClick={skip}
      className="absolute inset-0 z-30 flex animate-fadeIn flex-col overflow-hidden bg-ink-950 px-5 py-4"
    >
      <div className="flex shrink-0 items-baseline justify-between border-b border-paper-100/[0.1] pb-2.5">
        <span className="font-serif text-[10px] tracking-[0.22em] text-paper-600">
          {t('ui.ending.archive')}
        </span>
        {/* 品级用五个方格，不用★：星号在深色底上偏亮，抢结局名的视线 */}
        <span className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 border ${
                i < ending.rarity ? 'border-cinnabar-500 bg-cinnabar-500' : 'border-paper-100/20'
              }`}
            />
          ))}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* pb 留给右下角那枚印：它固定不动，内容滚到底时要能滚过它，
            否则最后一条关键决断永远压在印下面 */}
        <div className="my-auto pb-24 pt-6">
          <div className="text-center">
            {/* 成败不套框：包一个方框就变成仪表盘上的状态徽章。一行小字、拉开字距，够了 */}
            <span
              className={`font-serif text-[10px] tracking-[0.32em] ${
                ending.win ? 'text-paper-400' : 'text-cinnabar-300'
              }`}
            >
              {ending.win ? t('ui.ending.win') : t('ui.ending.lose')}
            </span>

            <h2
              className={`mt-4 font-serif text-[25px] leading-tight text-paper-50 ${
                // 中文两个字的标题靠字距撑开才立得住；英文单词之间已经有空格，
                // 再给 0.2em 会散成一排字母
                zh ? 'tracking-[0.2em]' : 'tracking-[0.05em]'
              }`}
            >
              {t(`endings.${ending.id}.title`)}
            </h2>

            <div className="mx-auto mt-3 h-px w-10 bg-cinnabar-600/60" />
          </div>

          {/* 评语逐句落。一句一行、左对齐 —— 史书不居中，居中就成了贺卡 */}
          <div className="mt-4 space-y-1">
            {sentences.map((s, i) => (
              <p
                key={`${i}-${s.slice(0, 6)}`}
                style={{ animationDelay: `${LINE_BASE + i * LINE_STEP}ms` }}
                className="animate-fadeUp font-serif text-[13px] leading-[2] tracking-[0.01em] text-paper-300/80"
              >
                {s}
              </p>
            ))}
          </div>

          <div
            style={{ animationDelay: `${LINE_BASE + sentences.length * LINE_STEP + 60}ms` }}
            className="mt-5 animate-fadeUp"
          >
            <div className="flex items-stretch border-t border-paper-100/[0.12] pt-3">
              {STAT_ORDER.map((k) => (
                <div
                  key={k}
                  className="min-w-0 flex-1 border-l border-paper-100/[0.08] pl-2.5 first:border-l-0 first:pl-0"
                >
                  <div className="font-mono text-[14px] leading-none tabular-nums text-paper-100">
                    {state.stats[k]}
                  </div>
                  <div className="mt-1 truncate font-serif text-[10px] tracking-[0.08em] text-paper-600">
                    {t(`ui.stat.${k}`)}
                  </div>
                </div>
              ))}
            </div>

            {times > 1 && (
              <p className="mt-2 text-center font-serif text-[10px] tracking-[0.12em] text-paper-700">
                {zh ? `本机第 ${times} 次达成` : `Reached ${times}× on this device`}
              </p>
            )}

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-[10px] tracking-[0.2em] text-paper-600">
                  {t('ui.ending.trajectory')}
                </span>
                <span className="font-mono text-[9.5px] text-paper-700">{code}</span>
              </div>
              <ul className="mt-2">
                {state.keyChoices.length === 0 ? (
                  <li className="py-2 text-[11.5px] leading-relaxed text-paper-700">
                    {t('ui.ending.noChoice')}
                  </li>
                ) : (
                  state.keyChoices.slice(0, 4).map((key, i) => (
                    <li
                      key={key}
                      style={{ animationDelay: `${LINE_BASE + sentences.length * LINE_STEP + 160 + i * 90}ms` }}
                      className="flex animate-fadeUp gap-2 py-2 text-[11.5px] leading-relaxed text-paper-400"
                    >
                      <span className="shrink-0 text-cinnabar-600">—</span>
                      <span>{t(key)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 朱印：压在右下角，不随内容滚动。
          固定 54px 见方 —— 印章是方的，宽度让内容撑开就会变成标签。
          加一圈极淡的红光，模拟刚按下去的印泥还没干。 */}
      {sealed && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[112px] right-5 z-10 animate-sealSlam"
        >
          <div className="grid h-[54px] w-[54px] place-items-center border-[3px] border-cinnabar-500/90 bg-cinnabar-700/30 shadow-[0_0_20px_rgba(178,58,46,0.24),inset_0_0_10px_rgba(178,58,46,0.3)]">
            <div className="flex flex-col items-center gap-[2px]">
              {sealLine.map((line, i) => (
                <span
                  key={i}
                  className="block font-serif leading-none text-cinnabar-300"
                  style={{
                    fontSize: zh ? '17px' : '8px',
                    letterSpacing: zh ? '0' : '0.08em',
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 space-y-2 pt-3">
        {sealed ? (
          <>
            <button
              onClick={handleShare}
              disabled={busy}
              className="flex w-full animate-fadeUp items-center justify-center gap-2.5 border border-cinnabar-600/70 bg-cinnabar-700/[0.14] py-3 font-serif text-[13px] tracking-[0.22em] text-cinnabar-200 transition-colors hover:bg-cinnabar-700/25 disabled:opacity-50"
            >
              <Icon name="share" className="h-4 w-4" strokeWidth={1.6} />
              {t('ui.action.share')}
            </button>
            <button
              onClick={onRestart}
              style={{ animationDelay: '80ms' }}
              className="flex w-full animate-fadeUp items-center justify-center gap-2 py-2.5 font-serif text-[12px] tracking-[0.16em] text-paper-500 transition-colors hover:text-paper-200"
            >
              <Icon name="restart" className="h-3.5 w-3.5" strokeWidth={1.6} />
              {t('ui.action.restart')}
            </button>
          </>
        ) : (
          // 占位：按钮突然出现会把上面的评语顶上去，所以在它该在的位置先留白
          <div className="h-[92px]" />
        )}
      </div>

      {preview && (
        <div className="absolute inset-0 z-40 flex flex-col bg-ink-950/[0.98] p-4 animate-fadeIn">
          <img
            src={preview}
            alt=""
            className="mx-auto min-h-0 w-auto max-w-full flex-1 object-contain"
          />
          <p className="mt-3 text-center font-serif text-[10px] leading-relaxed text-paper-600">
            {t('ui.ending.shareHint')}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-1.5 border border-cinnabar-600/70 bg-cinnabar-700/[0.14] py-2.5 font-serif text-[12px] tracking-[0.14em] text-cinnabar-200"
            >
              <Icon name="download" className="h-4 w-4" strokeWidth={1.6} />
              {t('ui.action.share')}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="flex-1 border border-paper-100/15 py-2.5 font-serif text-[12px] tracking-[0.14em] text-paper-500"
            >
              {t('ui.action.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
