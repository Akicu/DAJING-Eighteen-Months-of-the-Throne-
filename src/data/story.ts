import i18n from '../i18n'
import type { EventsFile } from '../types'
import registry from './stories/index.json'

/**
 * 多剧本运行时。
 *
 * 引擎本身与剧本无关（reducer 的第三个参数就是 data），所以「加一个剧本」
 * 只是加一份 config + pack + 文案，不需要动引擎。这个文件负责三件事：
 *   1. 提供剧本清单（封面、标题、题材标签）给选择页
 *   2. 按需动态加载某个剧本的 events.json（Vite 代码分割，剧本再多首屏也不膨胀）
 *   3. 切换剧本时，把该剧本的双语文案灌进 i18next
 *
 * 关键设计：所有剧本共用 'translation' 这一个 namespace，切剧本时整包覆盖。
 * 好处是组件里 t('ui.stat.health') 这类调用一行都不用改；
 * 而不同剧本可以对同一个 key 给出完全不同的意思（健康 / 龙体）。
 */

export type Accent = 'amber' | 'violet' | 'sky' | 'emerald' | 'rose'

export interface StoryMeta {
  id: string
  order: number
  cover: string
  accent: Accent
  tag: { zh: string; en: string }
  title: { zh: string; en: string }
  tagline: { zh: string; en: string }
}

export const STORIES: StoryMeta[] = [...(registry.stories as StoryMeta[])].sort(
  (a, b) => a.order - b.order,
)

export const DEFAULT_STORY_ID = STORIES[0]?.id ?? 'sector07'

/**
 * 对外发布时只留一个剧本 —— 填它的 id。
 *
 * 生效范围：标题页的「切换剧本」入口消失；线上也无法靠 ?story= 或上次的选择
 * 跳到另一个剧本。开发环境仍然接受 ?story=xxx，方便继续改被藏起来的那个。
 * 设成 null 就恢复多剧本（入口和选择页一起回来）。
 */
export const PUBLIC_STORY_ID: string | null = 'emperor'

/** 剧本标题按 "主标题 · 副标题" 组织，主标题进大字号，副标题进小字 */
export function splitTitle(meta: StoryMeta, lang: string): [string, string] {
  const full = storyTitle(meta, lang)
  const [head, ...rest] = full.split('·')
  return [head.trim(), rest.join('·').trim()]
}

export function getStory(id: string): StoryMeta {
  return STORIES.find((s) => s.id === id) ?? STORIES[0]
}

export function storyTitle(meta: StoryMeta, lang: string): string {
  return lang === 'en' ? meta.title.en : meta.title.zh
}

export function storyTagline(meta: StoryMeta, lang: string): string {
  return lang === 'en' ? meta.tagline.en : meta.tagline.zh
}

export function storyTag(meta: StoryMeta, lang: string): string {
  return lang === 'en' ? meta.tag.en : meta.tag.zh
}

// 两个 glob 是关键：构建时收集所有剧本的产物，运行时只下载被选中的那一个。
const eventModules = import.meta.glob<{ default: EventsFile }>('./stories/*/events.json')
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>('../i18n/*/*.json')

interface StoryBundle {
  data: EventsFile
  locales: Record<string, Record<string, unknown>>
}

const cache = new Map<string, StoryBundle>()

/** 加载某个剧本（含中英两份文案）。同一剧本只加载一次。 */
export async function loadStory(id: string): Promise<StoryBundle> {
  const hit = cache.get(id)
  if (hit) return hit

  const evLoad = eventModules[`./stories/${id}/events.json`]
  if (!evLoad) throw new Error(`剧本 "${id}" 没有构建产物，先跑 npm run content`)

  const [evMod, zhMod, enMod] = await Promise.all([
    evLoad(),
    localeModules[`../i18n/zh/${id}.json`]?.(),
    localeModules[`../i18n/en/${id}.json`]?.(),
  ])

  const bundle: StoryBundle = {
    data: evMod.default,
    locales: {},
  }
  if (zhMod) bundle.locales.zh = zhMod.default
  if (enMod) bundle.locales.en = enMod.default

  cache.set(id, bundle)
  return bundle
}

/**
 * 把剧本文案灌进 i18next。
 *
 * 用 deep + overwrite 合并而不是先删后加：删掉的那一瞬间界面上所有 key
 * 都会变成原始 key 名闪一下。合并旧剧本残留的 key 是无害的 —— 当前剧本
 * 的 events.json 根本不会引用它们。
 */
export function applyLocales(bundle: StoryBundle): void {
  for (const [lang, res] of Object.entries(bundle.locales)) {
    i18n.addResourceBundle(lang, 'translation', res, true, true)
  }
}
