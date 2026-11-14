import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EventsFile, LocationId } from './types'
import { actOf, createInitialState, reducer, upkeepFor } from './engine/game'
import type { Action, GameState } from './engine/game'
import {
  clearSave,
  getArchive,
  loadGame,
  loadPrefs,
  recordEnding,
  saveGame,
  savePrefs,
  setStoredLang,
} from './engine/save'
import type { Prefs } from './engine/save'
import { track } from './engine/analytics'
import { audio } from './audio/audio'
import { Hud } from './components/Hud'
import { MapScreen } from './components/MapScreen'
import { EventModal } from './components/EventModal'
import { EndingScreen } from './components/EndingScreen'
import { TitleScreen } from './components/TitleScreen'
import { ContactsSheet } from './components/ContactsSheet'
import { ActCard, DayCard } from './components/Interlude'
import { StoryPicker } from './components/StoryPicker'
import {
  DEFAULT_STORY_ID,
  PUBLIC_STORY_ID,
  STORIES,
  applyLocales,
  getStory,
  loadStory,
} from './data/story'
import type { StoryMeta } from './data/story'

const params = new URLSearchParams(window.location.search)

/**
 * 仅开发环境：?sanity=N 把心力压到指定值。
 * 濒死暗角和 HUD 的低值呼吸都只在最后十几点里才出现，正常玩一局到不了那儿，
 * 没有这个口子就只能靠改代码去校对。上线时 import.meta.env.DEV 为 false，整段被摇掉。
 */
function devSanity(s: GameState): GameState {
  const raw = params.get('sanity')
  if (!import.meta.env.DEV || raw === null) return s
  const n = Number(raw)
  if (!Number.isFinite(n)) return s
  return { ...s, stats: { ...s.stats, sanity: Math.max(0, Math.min(100, n)) } }
}

function initialStoryId(): string {
  // 只发一个剧本时，线上不接受 ?story= 和上次选择，直接钉在这个剧本上。
  // 开发环境仍放行 ?story=xxx —— 被藏起来的那个剧本还要继续改。
  if (PUBLIC_STORY_ID && !import.meta.env.DEV) return PUBLIC_STORY_ID

  const fromUrl = params.get('story')
  if (fromUrl && STORIES.some((s) => s.id === fromUrl)) return fromUrl
  if (PUBLIC_STORY_ID) return PUBLIC_STORY_ID

  const fromPrefs = loadPrefs().story
  if (fromPrefs && STORIES.some((s) => s.id === fromPrefs)) return fromPrefs
  return DEFAULT_STORY_ID
}

export default function App() {
  const { i18n } = useTranslation()

  const [storyId, setStoryId] = useState<string>(initialStoryId)
  const [meta, setMeta] = useState<StoryMeta>(() => getStory(initialStoryId()))
  const [data, setData] = useState<EventsFile | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [screen, setScreen] = useState<'title' | 'game'>('title')
  const [saved, setSaved] = useState<GameState | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const [timesReached, setTimesReached] = useState(1)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(import.meta.env.DEV && params.get('picker') === '1')

  const recordedEnding = useRef<string | null>(null)

  // 幕间遮罩：换日给一张日卡，跨幕给一张幕卡（幕卡优先，日卡让位）
  const [interlude, setInterlude] = useState<
    | { kind: 'day'; day: number; act: string; income: number; spend: number }
    | { kind: 'act'; act: string }
    | null
  >(null)
  const progressRef = useRef<{ day: number; act: string } | null>(null)

  // ---------- 语言：支持 ?lang=en 直接给海外测试者发链接 ----------
  useEffect(() => {
    const param = params.get('lang')
    if (param === 'zh' || param === 'en') {
      if (i18n.language !== param) void i18n.changeLanguage(param)
      // 带 ?lang= 进来算显式指定，记下来（否则下次回来又按浏览器语言）
      setStoredLang(param)
      document.documentElement.lang = param === 'zh' ? 'zh-CN' : 'en'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 剧本加载：切剧本 = 换一份 data + 换一整套文案 ----------
  useEffect(() => {
    let alive = true
    setLoadError(null)
    setData(null)

    void (async () => {
      try {
        const bundle = await loadStory(storyId)
        if (!alive) return

        applyLocales(bundle)
        await i18n.changeLanguage(i18n.language)
        if (!alive) return

        const fresh = createInitialState(bundle.data)
        setMeta(getStory(storyId))
        setData(bundle.data)
        setState(fresh)
        setSaved(loadGame(storyId))
        setScreen('title')
        setContactsOpen(false)
        setPickerOpen(import.meta.env.DEV && params.get('picker') === '1')

        // ---- 深链：数据就绪后才能算 ----
        // ?play=1 跳过封面直接开局；配合 ?loc=gate 可做单场景深链，方便投放与自动化测试
        if (params.get('play') === '1') {
          setState(createInitialState(bundle.data))
          setScreen('game')
          const loc = params.get('loc')
          if (loc) {
            setState((s) => (s ? reducer(s, { type: 'enter', loc: loc as LocationId }, bundle.data) : s))
          }
          setState((s) => (s ? devSanity(s) : s))
        }

        const metFlags = (d: EventsFile) =>
          d.npcs.reduce<Record<string, boolean>>((acc, n) => {
            if (n.metFlag) acc[n.metFlag] = true
            return acc
          }, {})

        // 仅开发环境：?contacts=1 直接打开关系档案，用于校对四种状态的头像与文案
        if (import.meta.env.DEV && params.get('contacts') === '1') {
          const preview = createInitialState(bundle.data)
          preview.day = 11
          preview.flags = metFlags(bundle.data)
          if (bundle.data.npcs[1]?.allyFlag) preview.flags[bundle.data.npcs[1].allyFlag] = true
          if (bundle.data.npcs[2]?.betrayFlag) preview.flags[bundle.data.npcs[2].betrayFlag] = true
          setState(preview)
          setScreen('game')
          setContactsOpen(true)
        }

        // 仅开发环境：?ev=<事件id> 直接进入指定事件（?pre=a,b 预置 flag，?day=N 指定天数）
        // 长线剧情（第 15 天以后的高潮事件）没法靠刷新抽到，只能靠这个深链校对
        if (import.meta.env.DEV && params.get('ev')) {
          const preview = createInitialState(bundle.data)
          const target = bundle.data.events.find((e) => e.id === params.get('ev'))
          if (target) {
            preview.day = Number(params.get('day') ?? 12)
            preview.ap = bundle.data.config.actionsPerDay
            preview.flags = metFlags(bundle.data)
            for (const f of (params.get('pre') ?? '').split(',').filter(Boolean)) preview.flags[f] = true
            preview.phase = 'event'
            preview.location = target.loc
            preview.currentEventId = target.id
            preview.pending = null
            setState(preview)
            setScreen('game')
          }
        }

        // 仅开发环境：?end=xxx 直接跳到指定结局，用于校对结局页与分享图排版
        if (import.meta.env.DEV && params.get('end')) {
          const preview = createInitialState(bundle.data)
          preview.phase = 'ending'
          preview.endingId = params.get('end')
          preview.daysSurvived = bundle.data.config.maxDays
          preview.stats = { health: 52, sanity: 31, money: 262, favor: 48 }
          preview.morality = 2
          preview.flags = metFlags(bundle.data)
          const withKey = bundle.data.events.find((e) => e.choices.some((c) => c.key))
          const keyChoice = withKey?.choices.find((c) => c.key)
          if (withKey && keyChoice) {
            preview.keyChoices = [`events.${withKey.id}.choices.${keyChoice.id}.text`]
          }
          setState(devSanity(preview))
          setScreen('game')
        }
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      alive = false
    }
    // i18n 实例稳定，只跟着剧本变
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId])

  // ---------- 音频：首次手势解锁（移动端自动播放限制） ----------
  useEffect(() => {
    const unlock = () => {
      audio.unlock()
      audio.setSound(prefs.sound)
      audio.setAmbience(prefs.ambience)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    // prefs 只在解锁瞬间取一次初值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    audio.setSound(prefs.sound)
    audio.setAmbience(prefs.ambience)
  }, [prefs.sound, prefs.ambience])

  // 理智越低，环境音越闷
  const sanity = state?.stats.sanity
  useEffect(() => {
    if (sanity === undefined) return
    audio.setTension(Math.max(0, (55 - sanity) / 55))
  }, [sanity])

  // 心力濒死：外框内压一层会呼吸的暗红，同时把 body 那层静态暗角让位 ——
  // 0.42 + 0.62 叠在 430px 宽的框里会糊成一块纯黑，不是压迫是故障
  const dying = sanity !== undefined && sanity < 15
  useEffect(() => {
    document.documentElement.style.setProperty('--vignette-a', dying ? '0.16' : '0.42')
  }, [dying])

  // ---------- 自动存档（按剧本隔离） ----------
  useEffect(() => {
    if (!data || !state) return
    if (screen !== 'game') return
    if (state.phase === 'ending') return
    saveGame(storyId, state)
  }, [state, screen, storyId, data])

  // ---------- 幕间遮罩的触发 ----------
  // 只在「游戏内往前走了一个单位」时弹：读档、深链、开新局都会让 day 跳变，
  // 那些不该被一张日卡挡住。所以第一次见到某个 (day, act) 只记录，不弹。
  useEffect(() => {
    if (!data || !state) return
    if (screen !== 'game' || state.phase === 'ending') {
      progressRef.current = null
      return
    }

    const current = { day: state.day, act: actOf(data, state.day) }
    const prev = progressRef.current
    progressRef.current = current

    if (!prev || current.day === prev.day) return

    if (current.act !== prev.act) {
      setInterlude({ kind: 'act', act: current.act })
      return
    }

    if (current.day === prev.day + 1 && prefs.dayCard !== false) {
      setInterlude({
        kind: 'day',
        day: current.day,
        act: current.act,
        // 日结发生在「上一天」的夜里，所以用 prev.day 算这笔支出
        income: data.config.dailyWage ?? 0,
        spend: upkeepFor(data, prev.day),
      })
    }
  }, [data, state, screen, prefs.dayCard])

  // ---------- 结局结算 ----------
  useEffect(() => {
    if (!data || !state || state.phase !== 'ending' || !state.endingId) return
    if (recordedEnding.current === state.endingId) return
    recordedEnding.current = state.endingId

    const ending = data.endings.find((e) => e.id === state.endingId)
    const win = Boolean(ending?.win)

    recordEnding(storyId, state.endingId, win)
    setTimesReached(getArchive(storyId).endings[state.endingId] ?? 1)
    clearSave(storyId)
    setSaved(null)

    track('run_end', {
      story: storyId,
      ending: state.endingId,
      win,
      days: state.daysSurvived,
      morality: state.morality,
      money: state.stats.money,
      favor: state.stats.favor,
    })

    audio.play(win ? 'blip' : 'alarm')
  }, [data, state, storyId])

  // ---------- 交互 ----------
  const startRun = useCallback(() => {
    if (!data) return
    recordedEnding.current = null
    clearSave(storyId)
    setSaved(null)
    setState(createInitialState(data))
    setScreen('game')
    track('run_start', { story: storyId, lang: i18n.language })
  }, [data, storyId, i18n.language])

  const resumeRun = useCallback(() => {
    const save = loadGame(storyId)
    if (!save) return
    recordedEnding.current = null
    setState(save)
    setScreen('game')
    track('run_start', { story: storyId, lang: i18n.language, resumed: true })
  }, [storyId, i18n.language])

  const dispatch = useCallback(
    (action: Action) => {
      setState((s) => (s && data ? reducer(s, action, data) : s))
    },
    [data],
  )

  const handleEnter = useCallback(
    (loc: LocationId) => {
      setContactsOpen(false)
      audio.play('click')
      track('location_enter', { story: storyId, loc, day: state?.day ?? 0 })
      dispatch({ type: 'enter', loc })
    },
    [dispatch, state?.day, storyId],
  )

  const handleChoose = useCallback(
    (choiceId: string) => {
      // 点选项只是「落笔」，轻一点；重的那一声留给长按按到底的落印
      audio.play('click')
      track('choice_made', { story: storyId, choice: choiceId })
      dispatch({ type: 'choose', choiceId })
    },
    [dispatch, storyId],
  )

  const handleAck = useCallback(() => {
    // 长按 420ms 按到底 = 朱笔落下，这一声是整个循环里最重的反馈
    audio.play('stamp')
    dispatch({ type: 'ack' })
  }, [dispatch])

  const handleEndDay = useCallback(() => {
    audio.play('blip')
    track('day_end', { story: storyId, day: state?.day ?? 0 })
    dispatch({ type: 'endDay' })
  }, [dispatch, state?.day, storyId])

  const closeInterlude = useCallback(() => setInterlude(null), [])

  const disableDayCard = useCallback(() => {
    setPrefs((p) => {
      const updated = { ...p, dayCard: false }
      savePrefs(updated)
      return updated
    })
    setInterlude(null)
  }, [])

  const toggleLang = useCallback(() => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    void i18n.changeLanguage(next)
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
    // 只有这里（和 ?lang=）会写语言偏好。prefs 不再参与，见 save.ts 的 LANG_KEY 注释
    setStoredLang(next)
    track('lang_switch', { to: next })
  }, [i18n])

  const toggleSound = useCallback(() => {
    setPrefs((p) => {
      const updated = { ...p, sound: !p.sound, ambience: !p.sound ? true : p.ambience }
      savePrefs(updated)
      return updated
    })
  }, [])

  const switchStory = useCallback(
    (id: string) => {
      audio.play('click')
      if (id === storyId) {
        setPickerOpen(false)
        return
      }
      track('story_switch', { from: storyId, to: id })
      setPrefs((p) => {
        const updated = { ...p, story: id }
        savePrefs(updated)
        return updated
      })
      recordedEnding.current = null
      setStoryId(id)
    },
    [storyId],
  )

  const frameClass = useMemo(
    () =>
      // 桌面端的外框：直角、单线。原来的 26px 大圆角 + 80px 外发光是「手机样机」的做法，
      // 摆在一卷奏折上会立刻出戏
      'relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-ink-950 sm:h-[880px] sm:max-h-[94dvh] sm:border sm:border-paper-100/[0.1]',
    [],
  )

  // 剧本数据没到位之前不渲染任何 t() 文案，否则会闪出原始 key
  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070605] px-8">
        <p className="text-center font-serif text-[12.5px] leading-relaxed text-cinnabar-400">
          {loadError}
        </p>
      </div>
    )
  }

  if (!data || !state) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070605]">
        <span className="h-1.5 w-1.5 animate-breathe bg-cinnabar-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#070605]">
      <div className={frameClass}>
        {screen === 'title' ? (
          <TitleScreen
            story={meta}
            saved={saved}
            maxDays={data.config.maxDays}
            onStart={startRun}
            onResume={resumeRun}
            onToggleLang={toggleLang}
            onToggleSound={toggleSound}
            onOpenPicker={
              PUBLIC_STORY_ID
                ? undefined
                : () => {
                    audio.play('click')
                    setPickerOpen(true)
                  }
            }
            soundOn={prefs.sound}
          />
        ) : (
          <>
            <Hud
              state={state}
              data={data}
              soundOn={prefs.sound}
              onToggleSound={toggleSound}
              onToggleLang={toggleLang}
              onOpenContacts={() => {
                audio.play('click')
                setContactsOpen(true)
              }}
            />

            {/* 地图层单独包一层 relative：日结卡只盖住地图，不盖 HUD —— 换日那一刻
                属性正在滚动和抖动，盖住就等于把刚做的反馈吃掉了 */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MapScreen
                state={state}
                data={data}
                onEnter={handleEnter}
                onEndDay={handleEndDay}
                onOpenContacts={() => setContactsOpen(true)}
              />

              {interlude?.kind === 'day' && (
                <DayCard
                  day={interlude.day}
                  act={interlude.act}
                  income={interlude.income}
                  spend={interlude.spend}
                  onDone={closeInterlude}
                  onDisable={disableDayCard}
                />
              )}
            </div>

            {contactsOpen && (
              <ContactsSheet state={state} data={data} onClose={() => setContactsOpen(false)} />
            )}

            {(state.phase === 'event' || state.phase === 'outcome') && (
              <EventModal state={state} data={data} onChoose={handleChoose} onAck={handleAck} />
            )}

            {state.phase === 'ending' && (
              <EndingScreen
                state={state}
                data={data}
                timesReached={timesReached}
                onRestart={startRun}
              />
            )}

            {interlude?.kind === 'act' && (
              <ActCard act={interlude.act} onDone={closeInterlude} />
            )}

            {/* 心力濒死：只压外框内，不压整个浏览器窗口。
                桌面端外框只有 430px 居中，全屏暗角会把窗口背景一起压黑，看起来像渲染失败。
                z-34 压在奏折（20）与结局页（30）之上、分享预览（40）之下 ——
                读折子那一刻压迫感最强，但别盖住要保存的那张图。 */}
            {screen === 'game' && dying && (
              <div
                aria-hidden="true"
                className="vignette-pulse pointer-events-none absolute inset-0 z-[34]"
                style={{
                  // 起点放到 52%：再往里推就成了一张红纱，不是暗角。
                  // 颜色偏黑红而不是朱砂 —— 「暗」要多过「红」，否则像警报灯
                  background:
                    'radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(74,13,10,0.62) 100%)',
                }}
              />
            )}
          </>
        )}

        {/* 只发一个剧本时选择页整层不挂载：入口按钮已经没了，这里再挡一道。
            dev 放行，是为了还能用 ?picker=1 校对选择页本身 */}
        {pickerOpen && (!PUBLIC_STORY_ID || import.meta.env.DEV) && (
          <StoryPicker
            current={storyId}
            lang={i18n.language}
            onSelect={switchStory}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
