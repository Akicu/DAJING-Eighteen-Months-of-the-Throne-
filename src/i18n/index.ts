import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getStoredLang } from '../engine/save'

/**
 * i18n 初始化时**不带任何文案**。
 *
 * 多剧本之后，文案属于剧本而不是属于应用：每个剧本有自己的 ui.stat.health
 * （SECTOR-07 是"健康"，大靖是"龙体"）。所以这里只定语言和插值规则，
 * 具体的 key 由 src/data/story.ts 的 applyLocales() 在剧本加载完成后灌进来。
 *
 * 代价是：剧本没加载完之前不能渲染任何 t() 文案，否则会看到原始 key。
 * App 用 loading 屏挡住了这个窗口。
 */
const fallbackLang = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
const initialLang = getStoredLang() ?? fallbackLang

void i18n.use(initReactI18next).init({
  resources: {},
  lng: initialLang,
  fallbackLng: 'en',
  supportedLngs: ['zh', 'en'],
  // 资源是本地对象、没有异步 backend，关掉立即初始化避免首帧空文案
  initImmediate: false,
  interpolation: {
    // 文案里统一用单大括号 {n}，比 {{n}} 更贴近编剧习惯
    prefix: '{',
    suffix: '}',
    escapeValue: false,
  },
  returnNull: false,
})

document.documentElement.lang = initialLang === 'zh' ? 'zh-CN' : 'en'

export default i18n
