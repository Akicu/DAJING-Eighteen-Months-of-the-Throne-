import { useTranslation } from 'react-i18next'
import { STORIES, splitTitle, storyTag, storyTagline } from '../data/story'
import { loadGame } from '../engine/save'
import { Icon } from './Icons'

interface Props {
  current: string
  lang: string
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * 剧本选择面板。
 *
 * 这层存在的意义不是"多一个功能"，而是让世界观变成可增量的资产：
 * 每加一个剧本，这里就多一张卷宗，引擎、存档、音效、分享图全部复用。
 */
export function StoryPicker({ current, lang, onSelect, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-ink-950/[0.99] animate-fadeIn">
      <div className="flex shrink-0 items-baseline justify-between border-b border-paper-100/[0.1] px-4 py-3">
        <div>
          <p className="font-serif text-[9.5px] tracking-[0.26em] text-paper-600">
            {t('ui.story.pickerTag')}
          </p>
          <h2 className="mt-1 font-serif text-[16px] tracking-[0.18em] text-paper-50">
            {t('ui.story.title')}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center text-paper-500 transition-colors hover:text-paper-100"
          aria-label={t('ui.story.close')}
        >
          <Icon name="close" className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {STORIES.map((s) => {
          const [head, tail] = splitTitle(s, lang)
          const isCurrent = s.id === current
          const save = loadGame(s.id)
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`relative flex w-full gap-3.5 border-b border-paper-100/[0.07] py-3.5 pl-2.5 text-left transition-colors ${
                isCurrent ? 'bg-cinnabar-700/[0.07]' : 'hover:bg-paper-100/[0.025] active:bg-paper-100/[0.045]'
              }`}
            >
              {isCurrent && (
                <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[2px] bg-cinnabar-500" />
              )}

              <div className="relative h-[76px] w-[58px] shrink-0 overflow-hidden border border-paper-100/[0.12] bg-ink-900">
                {/* 没有插画时露出来的底：标题首字当印章用，好过一块空白 */}
                <span className="absolute inset-0 grid place-items-center font-serif text-[22px] text-paper-700">
                  {head.slice(0, 1)}
                </span>
                <img
                  src={s.cover}
                  alt=""
                  className="relative h-full w-full object-cover opacity-85"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-serif text-[9.5px] tracking-[0.2em] text-paper-600">
                    {storyTag(s, lang)}
                  </span>
                  {isCurrent && (
                    <span className="ml-auto shrink-0 font-serif text-[9px] tracking-[0.16em] text-cinnabar-400">
                      {t('ui.story.current')}
                    </span>
                  )}
                </div>

                <p className="mt-1 truncate font-serif text-[15px] tracking-[0.1em] text-paper-50">
                  {head}
                </p>
                {tail && (
                  <p className="mt-0.5 truncate font-serif text-[10.5px] tracking-[0.16em] text-cinnabar-400/70">
                    {tail}
                  </p>
                )}

                <p className="mt-1.5 line-clamp-2 font-serif text-[10.5px] leading-[1.8] text-paper-600">
                  {storyTagline(s, lang)}
                </p>

                {save && (
                  <p className="mt-1 font-serif text-[9.5px] tracking-[0.08em] text-paper-500">
                    {t('ui.story.saved', { day: save.day, max: save.daysSurvived ?? save.day })}
                  </p>
                )}
              </div>
            </button>
          )
        })}

        <p className="py-3 text-center font-serif text-[9.5px] leading-[1.9] tracking-[0.08em] text-paper-700">
          {t('ui.story.hint')}
        </p>
      </div>
    </div>
  )
}
