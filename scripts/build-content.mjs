#!/usr/bin/env node
/**
 * content/<lang>/<storyId>/*.json  →  src/i18n/<lang>/<storyId>.json
 *
 * 为什么要这一步：
 *   一份完整的双语文案在单个文件里会到上万行，编剧和译者在 git 里改起来极易冲突。
 *   所以按「剧本 / 地点 / core」拆开维护，构建时合并，并对照该剧本的 events.json 做完整性校验。
 *   校验不通过直接中断构建 —— 防止漏翻的 key 在线上变成空白文本。
 *
 * 多剧本约定：content/{zh,en}/ 下每个子目录就是一个剧本，目录名必须和
 * src/data/stories/<id> 一致。每个剧本产出独立的一份 i18n 包，运行时按需加载，
 * 互不污染（同一个 key 在不同剧本里可以指完全不同的东西）。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh', 'en']

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const storiesDir = join(root, 'src/data/stories')
const storyIds = readdirSync(storiesDir)
  .filter((d) => statSync(join(storiesDir, d)).isDirectory())
  .filter((d) => existsSync(join(storiesDir, d, 'events.json')))
  .sort()

const problems = []
const warnings = []

function mergeLang(lang, storyId) {
  const dir = join(root, 'content', lang, storyId)
  if (!existsSync(dir)) throw new Error(`missing content dir: ${dir}`)
  const events = readJson(join(root, 'src/data/stories', storyId, 'events.json'))

  const out = { meta: {}, ui: {}, npcs: {}, locations: {}, events: {}, endings: {} }

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const data = readJson(join(dir, file))
    if (file === 'core.json') {
      for (const key of Object.keys(out)) {
        if (data[key]) Object.assign(out[key], data[key])
      }
    } else {
      Object.assign(out.events, data)
    }
  }

  // ---------- 校验 ----------
  const need = (cond, msg) => {
    if (!cond) problems.push(`[${lang}] ${msg}`)
  }

  for (const loc of events.locations) {
    need(out.locations[loc.id]?.name, `location "${loc.id}" missing name`)
    need(out.locations[loc.id]?.desc, `location "${loc.id}" missing desc`)
  }

  for (const npc of events.npcs ?? []) {
    const tr = out.npcs[npc.id]
    need(tr, `npc "${npc.id}" has no translation block`)
    if (!tr) continue
    need(tr.name, `npc "${npc.id}" missing name`)
    need(tr.role, `npc "${npc.id}" missing role`)
    for (const stage of ['unknown', 'met', 'ally', 'betray']) {
      need(tr.stage?.[stage], `npc "${npc.id}" missing stage.${stage}`)
    }
  }

  for (const ev of events.events) {
    const tr = out.events[ev.id]
    need(tr, `event "${ev.id}" has no translation block`)
    if (!tr) continue
    need(tr.title, `event "${ev.id}" missing title`)
    need(tr.desc, `event "${ev.id}" missing desc`)
    for (const ch of ev.choices) {
      const ct = tr.choices?.[ch.id]
      need(ct, `choice "${ev.id}.${ch.id}" has no translation`)
      if (!ct) continue
      need(ct.text, `choice "${ev.id}.${ch.id}" missing text`)
      if (ch.roll) {
        // 风险选项没有单一结局，胜负各一段文案，取代 outcome
        need(ct.win, `roll choice "${ev.id}.${ch.id}" missing win text`)
        need(ct.lose, `roll choice "${ev.id}.${ch.id}" missing lose text`)
      } else {
        need(ct.outcome, `choice "${ev.id}.${ch.id}" missing outcome`)
      }
      // 有 requires 的选项必须有锁定提示文案
      if (ch.requires) need(ct.req, `choice "${ev.id}.${ch.id}" requires a lock reason`)
    }
  }

  for (const end of events.endings) {
    const tr = out.endings[end.id]
    need(tr, `ending "${end.id}" has no translation block`)
    if (tr) {
      need(tr.title, `ending "${end.id}" missing title`)
      need(tr.desc, `ending "${end.id}" missing desc`)
    }
  }

  // TODO 占位符（merge-batch 生成的骨架）必须在构建时挡住，不能带上线
  const scanTodo = (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.trim().startsWith('TODO')) problems.push(`[${lang}] 未填写的文案 ${path}${k}`)
      else if (v && typeof v === 'object') scanTodo(v, `${path}${k}.`)
    }
  }
  scanTodo(out, '')

  // 反向检查：翻译里存在但 events.json 里没有的孤儿 key
  const eventIds = new Set(events.events.map((e) => e.id))
  for (const id of Object.keys(out.events)) {
    if (!eventIds.has(id)) warnings.push(`[${lang}] orphan event text "${id}" not present in events.json`)
  }

  return out
}

mkdirSync(join(root, 'src/i18n'), { recursive: true })
const stats = []
for (const storyId of storyIds) {
  for (const lang of LANGS) {
    const merged = mergeLang(lang, storyId)
    mkdirSync(join(root, 'src/i18n', lang), { recursive: true })
    writeFileSync(join(root, `src/i18n/${lang}/${storyId}.json`), JSON.stringify(merged, null, 2) + '\n')
    const evCount = Object.keys(merged.events).length
    const choiceCount = Object.values(merged.events).reduce(
      (n, e) => n + Object.keys(e.choices || {}).length,
      0,
    )
    stats.push({
      storyId,
      lang,
      events: evCount,
      choices: choiceCount,
      endings: Object.keys(merged.endings).length,
    })
  }
}

if (warnings.length) {
  console.warn('\n⚠  warnings:')
  warnings.forEach((w) => console.warn('   ' + w))
}

if (problems.length) {
  console.error(`\n✗ content validation failed — ${problems.length} problem(s):`)
  problems.forEach((p) => console.error('   ' + p))
  process.exit(1)
}

console.log(`✓ i18n built — ${storyIds.length} 个剧本`)
for (const s of stats) {
  console.log(`  ${s.storyId}/${s.lang}: ${s.events} events / ${s.choices} choices / ${s.endings} endings`)
}
