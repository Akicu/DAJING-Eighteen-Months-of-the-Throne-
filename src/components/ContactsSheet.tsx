import { useTranslation } from 'react-i18next'
import type { GameState } from '../engine/game'
import { npcStatus } from '../engine/game'
import type { EventsFile } from '../types'
import { Icon } from './Icons'

const STATUS_TEXT = {
  unknown: 'text-paper-700',
  met: 'text-stone-400',
  ally: 'text-paper-200',
  betray: 'text-cinnabar-400',
} as const

const FRAME = {
  unknown: 'border-transparent bg-paper-100/[0.03] grayscale opacity-40',
  met: 'border-stone-500/50',
  ally: 'border-paper-300/70',
  betray: 'border-cinnabar-600/60',
} as const

interface Props {
  state: GameState
  data: EventsFile
  onClose: () => void
}

export function ContactsSheet({ state, data, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-ink-950/[0.99] animate-fadeIn">
      <div className="flex shrink-0 items-baseline justify-between border-b border-paper-100/[0.1] px-4 py-3">
        <div>
          <div className="font-serif text-[12px] tracking-[0.24em] text-paper-200">
            {t('ui.contacts.title')}
          </div>
          <div className="mt-1 font-serif text-[10px] tracking-[0.08em] text-paper-600">
            {t('ui.contacts.hint')}
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center text-paper-500 transition-colors hover:text-paper-100"
          aria-label={t('ui.contacts.close')}
        >
          <Icon name="close" className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1">
        {data.npcs.map((npc) => {
          const status = npcStatus(npc, state)
          return (
            <div
              key={npc.id}
              className="flex gap-3 py-4"
            >
              <div
                className={`relative h-14 w-12 shrink-0 overflow-hidden border bg-ink-900 ${FRAME[status]}`}
              >
                {npc.portrait && status !== 'unknown' ? (
                  <img
                    src={npc.portrait}
                    alt=""
                    className={`h-full w-full object-cover ${
                      status === 'betray' ? 'grayscale opacity-60' : 'opacity-95'
                    }`}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center font-serif text-[15px] text-paper-700">
                    ?
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`truncate font-serif text-[14px] tracking-[0.06em] ${
                      status === 'unknown' ? 'text-paper-600' : 'text-paper-50'
                    }`}
                  >
                    {status === 'unknown' ? '???' : t(`npcs.${npc.id}.name`)}
                  </span>
                  <span
                    className={`shrink-0 font-serif text-[10px] tracking-[0.16em] ${STATUS_TEXT[status]}`}
                  >
                    {t(`ui.contacts.status.${status}`)}
                  </span>
                </div>
                <div className="mt-1 truncate font-serif text-[10.5px] tracking-[0.06em] text-paper-600">
                  {status === 'unknown' ? '—' : t(`npcs.${npc.id}.role`)}
                </div>
                <p
                  className={`mt-1.5 font-serif text-[11.5px] leading-[1.8] ${
                    status === 'unknown' ? 'text-paper-700' : 'text-paper-400'
                  }`}
                >
                  {t(`npcs.${npc.id}.stage.${status}`)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
