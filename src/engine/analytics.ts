/**
 * 极轻量埋点。
 *
 * 设计取舍：这个原型是拿去做海外投放测手感的，所以第一优先级是「能拿到真实漏斗数据」，
 * 而不是引入 GA4 / PostHog 那套需要 cookie 同意弹窗的 SDK（欧盟 DSA/GDPR 下会掉转化）。
 * 因此默认只写 localStorage；配了 VITE_ANALYTICS_ENDPOINT 才用 sendBeacon 上报，
 * 后端可以是任意收数服务（Cloudflare Worker / 自建 / Plausible 事件接口）。
 */

const QUEUE_KEY = 'sector7.analytics.v1'
const MAX_QUEUE = 300

export type TrackName =
  | 'run_start'
  | 'location_enter'
  | 'choice_made'
  | 'day_end'
  | 'run_end'
  | 'share_click'
  | 'share_done'
  | 'lang_switch'
  | 'story_switch'

interface TrackEvent {
  name: TrackName
  props: Record<string, string | number | boolean>
  ts: number
  session: string
}

const endpoint: string = (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined) ?? ''

const sessionId = (() => {
  const key = 'sector7.session'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2, 10)
    sessionStorage.setItem(key, id)
  }
  return id
})()

function readQueue(): TrackEvent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as TrackEvent[]
  } catch {
    return []
  }
}

export function track(name: TrackName, props: Record<string, string | number | boolean> = {}): void {
  const event: TrackEvent = { name, props, ts: Date.now(), session: sessionId }

  try {
    const queue = readQueue()
    queue.push(event)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)))
  } catch {
    /* noop */
  }

  if (endpoint && typeof navigator.sendBeacon === 'function') {
    try {
      navigator.sendBeacon(endpoint, JSON.stringify(event))
    } catch {
      /* noop */
    }
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[track]', name, props)
  }
}

export function getTrackedEvents(): TrackEvent[] {
  return readQueue()
}
