import { useTranslation } from 'react-i18next'
import type { GameState } from '../engine/game'
import { Icon } from './Icons'
import { splitTitle, storyTag, storyTagline } from '../data/story'
import type { StoryMeta } from '../data/story'

interface Props {
  story: StoryMeta
  saved: GameState | null
  maxDays: number
  onStart: () => void
  onResume: () => void
  onToggleLang: () => void
  onToggleSound: () => void
  /** 不传就不画「切换剧本」那一行 —— 只发一个剧本时整个入口消失 */
  onOpenPicker?: () => void
  soundOn: boolean
}

export function TitleScreen({
  story,
  saved,
  maxDays,
  onStart,
  onResume,
  onToggleLang,
  onToggleSound,
  onOpenPicker,
  soundOn,
}: Props) {
  const { t, i18n } = useTranslation()
  const [head, tail] = splitTitle(story, i18n.language)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-6">
      <div className="absolute right-4 top-4 flex gap-1.5">
        <button
          onClick={onToggleLang}
          className="grid h-8 w-8 place-items-center text-paper-500 transition-colors hover:text-paper-100"
          aria-label={t('ui.settings.language')}
        >
          <Icon name="globe" className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={onToggleSound}
          className="grid h-8 w-8 place-items-center text-paper-500 transition-colors hover:text-paper-100"
          aria-label={t('ui.settings.sound')}
        >
          <Icon name={soundOn ? 'sound' : 'mute'} className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <img
          src={story.cover}
          alt=""
          className="h-full w-full object-cover opacity-[0.52]"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/20 via-ink-950/62 to-ink-950" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center">
        <div className="animate-fadeUp">
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-cinnabar-600/70" />
            <span className="font-serif text-[10px] tracking-[0.3em] text-paper-500">
              {storyTag(story, i18n.language)}
            </span>
          </div>

          <h1 className="mt-4 font-serif text-[42px] leading-none tracking-[0.16em] text-paper-50">
            {head}
          </h1>

          {tail && (
            <p className="mt-2.5 font-serif text-[11px] tracking-[0.28em] text-cinnabar-400/85">
              {tail}
            </p>
          )}

          <div className="mt-7 max-w-[330px] border-l-2 border-cinnabar-700/60 pl-3.5">
            <p className="font-serif text-[12.5px] leading-[2.05] text-paper-300/75">
              {storyTagline(story, i18n.language)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative space-y-2.5 pb-7">
        {saved && (
          <button
            onClick={onResume}
            className="flex w-full items-baseline justify-center gap-3 border border-cinnabar-600/70 bg-cinnabar-700/[0.14] py-3.5 font-serif text-[14px] tracking-[0.2em] text-cinnabar-200 transition-colors hover:bg-cinnabar-700/25"
          >
            {t('ui.action.continue')}
            <span className="font-mono text-[11px] tracking-normal text-cinnabar-300/70">
              {t('ui.day', { day: saved.day, max: maxDays })}
            </span>
          </button>
        )}

        <button
          onClick={onStart}
          className={`w-full py-3.5 font-serif text-[14px] tracking-[0.2em] transition-colors ${
            saved
              ? 'border border-paper-100/[0.14] text-paper-400 hover:border-paper-100/30 hover:text-paper-100'
              : 'border border-cinnabar-600/70 bg-cinnabar-700/[0.14] text-cinnabar-200 hover:bg-cinnabar-700/25'
          }`}
        >
          {saved ? t('ui.action.newGame') : t('ui.action.start')}
        </button>

        {onOpenPicker && (
          <button
            onClick={onOpenPicker}
            className="flex w-full items-center justify-center gap-2 py-2.5 font-serif text-[11.5px] tracking-[0.16em] text-paper-600 transition-colors hover:text-paper-300"
          >
            <Icon name="scroll" className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t('ui.story.switch')}
          </button>
        )}

        <p className="pt-1 text-center font-serif text-[9.5px] tracking-[0.2em] text-paper-600">
          v0.5 · 中 / EN
        </p>
      </div>
    </div>
  )
}
