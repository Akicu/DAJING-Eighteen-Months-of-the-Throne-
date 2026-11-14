#!/usr/bin/env node
/**
 * src/data/stories/<id>/config.json + packs/*.json  →  src/data/stories/<id>/events.json
 *
 * 为什么要拆包：
 *   上线版目标是 80+ 事件、多人并行写。所有人改同一个 events.json 必然 git 冲突，
 *   而且 AI 一次生成 10 个事件的片段也没法直接落盘。所以改成：
 *     config.json      —— 每个剧本一个：世界观参数、地点、结局表（策划独占）
 *     packs/*.json     —— 每个包一批事件（每条 NPC 支线 / 每个地点 / 每次 AI 批次各一个文件）
 *
 * 为什么要拆剧本：
 *   「剧本」= 一个完整可玩的世界（自己的地点、数值命名、结局表）。
 *   多剧本共用同一套引擎，所以每个剧本只是一份 config + 若干 pack + 一份文案。
 *   本脚本遍历 stories/ 下所有目录，各自产出 events.json，互不影响。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const storiesDir = join(root, 'src/data/stories')

/** 列出所有剧本目录（含 config.json 的才算） */
function listStories() {
  return readdirSync(storiesDir)
    .filter((d) => statSync(join(storiesDir, d)).isDirectory())
    .filter((d) => existsSync(join(storiesDir, d, 'config.json')))
    .sort()
}

function buildStory(storyId) {
  const dir = join(storiesDir, storyId)
  const config = readJson(join(dir, 'config.json'))
  const packDir = join(dir, 'packs')
  const packFiles = existsSync(packDir)
    ? readdirSync(packDir).filter((f) => f.endsWith('.json')).sort()
    : []

  const events = []
  const errors = []
  const seen = new Map()
  const locIds = new Set(config.locations.map((l) => l.id))
  const stats = []

  for (const file of packFiles) {
    const pack = readJson(join(packDir, file))
    if (!Array.isArray(pack.events)) {
      errors.push(`${file}: missing "events" array`)
      continue
    }
    const before = events.length
    for (const ev of pack.events) {
      const where = `${file} → ${ev.id ?? '(no id)'}`

      if (!ev.id) {
        errors.push(`${file}: event without id`)
        continue
      }
      if (seen.has(ev.id)) {
        errors.push(`${where}: duplicate id (also in ${seen.get(ev.id)})`)
        continue
      }
      if (!locIds.has(ev.loc)) {
        errors.push(`${where}: unknown loc "${ev.loc}"`)
        continue
      }
      if (!Array.isArray(ev.choices) || ev.choices.length < 1) {
        errors.push(`${where}: needs at least 1 choice`)
        continue
      }
      const choiceIds = new Set()
      for (const c of ev.choices) {
        if (!c.id) errors.push(`${where}: choice without id`)
        else if (choiceIds.has(c.id)) errors.push(`${where}: duplicate choice id "${c.id}"`)
        choiceIds.add(c.id)
        if (c.roll && (!c.roll.win || !c.roll.lose)) {
          errors.push(`${where}.${c.id}: roll needs win & lose branches`)
        }
      }
      seen.set(ev.id, file)
      events.push(ev)
    }
    stats.push({ file, n: events.length - before })
  }

  // 结局表必须是「第一个命中生效」，因此最后一条必须是无条件兜底
  const endings = config.endings ?? []
  if (!endings.length) errors.push('config.json: endings is empty')
  else if (endings[endings.length - 1].cond) errors.push('config.json: last ending must have no cond (fallback)')

  if (errors.length) {
    console.error(`\n✗ [${storyId}] build-events failed — ${errors.length} problem(s):`)
    errors.forEach((e) => console.error('   ' + e))
    process.exitCode = 1
    return null
  }

  const out = { id: storyId, ...config, events }
  writeFileSync(join(dir, 'events.json'), JSON.stringify(out, null, 2) + '\n')
  return { storyId, events: events.length, packs: packFiles.length, stats }
}

const results = listStories().map(buildStory).filter(Boolean)
const failed = results.length !== listStories().length

if (results.length) {
  console.log(`\n✓ events.json built — ${results.length} 个剧本`)
  for (const r of results) {
    console.log(`\n   ${r.storyId}  ${r.events} 事件 / ${r.packs} 个包`)
    for (const s of r.stats) console.log(`     ${s.file.padEnd(26)} ${String(s.n).padStart(3)}`)
  }
  console.log('')
}

if (failed) process.exit(1)
