#!/usr/bin/env node
/**
 * 把一批 AI 生成的事件合入工程：node scripts/merge-batch.mjs path/to/batch.json [--dry]
 *
 * 输入文件格式（一个 JSON 对象）：
 *   {
 *     "pack": "15-batch-01",              // 可选，落盘用的包名
 *     "loc": "gate",                      // 可选，事件未写 loc 时的默认值
 *     "events": [ ...10 个事件定义... ],
 *     "text": { "zh": { "<eventId>": {...} }, "en": { ... } }   // 可选
 *   }
 *
 * 脚本做四件事：
 *   1. 结构校验（id 唯一、loc 合法、至少有 1 个选项、有 requires 必须有 req 文案）
 *   2. 落成新的 pack 文件，不动其他人正在写的包（避免 git 冲突）
 *   3. 文案缺失时自动生成骨架，占位符写成 TODO:<key>，构建时会直接报错，不会被带上线
 *   4. 打印下一步该跑什么
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const file = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'))
const dry = argv.includes('--dry')
const story = flag('story', 'sector07')

if (!file) {
  console.error('用法：node scripts/merge-batch.mjs <batch.json> [--story sector07] [--dry]')
  process.exit(1)
}

const batch = JSON.parse(readFileSync(file, 'utf8'))
const events = batch.events
if (!Array.isArray(events) || !events.length) {
  console.error('✗ batch.json 里没有 events 数组')
  process.exit(1)
}

const storyDir = join(root, 'src/data/stories', story)
const config = JSON.parse(readFileSync(join(storyDir, 'config.json'), 'utf8'))
const existing = JSON.parse(readFileSync(join(storyDir, 'events.json'), 'utf8'))
const existingIds = new Set(existing.events.map((e) => e.id))
const locIds = new Set(config.locations.map((l) => l.id))
const npcIds = new Set(config.npcs.map((n) => n.id))

const problems = []
const warnings = []

for (const ev of events) {
  const where = ev.id ?? '(no id)'
  if (!ev.id) problems.push('事件缺少 id')
  else if (existingIds.has(ev.id)) problems.push(`${where}: id 与现有事件重复`)
  if (!ev.loc) {
    if (batch.loc) ev.loc = batch.loc
    else problems.push(`${where}: 缺少 loc，且 batch 没给默认 loc`)
  } else if (!locIds.has(ev.loc)) problems.push(`${where}: loc "${ev.loc}" 不存在`)
  if (ev.npc && !npcIds.has(ev.npc)) problems.push(`${where}: npc "${ev.npc}" 不存在`)
  if (!Array.isArray(ev.choices) || !ev.choices.length) problems.push(`${where}: 没有 choices`)
  for (const c of ev.choices ?? []) {
    if (!c.id) problems.push(`${where}: 有选项缺 id`)
    if (c.requires && !c.req) warnings.push(`${where}.${c.id}: 有 requires，记得补 req 文案`)
  }
  if (events.filter((x) => x.id === ev.id).length > 1) problems.push(`${where}: 本批次内 id 重复`)
}

if (problems.length) {
  console.error(`✗ 合入失败 — ${problems.length} 个问题：`)
  problems.forEach((p) => console.error('   ' + p))
  process.exit(1)
}

const packName = batch.pack ?? `90-${basename(file, '.json')}`
const packPath = join(storyDir, 'packs', `${packName}.json`)
const pack = { pack: packName, loc: batch.loc ?? events[0].loc, events }
if (batch.bookkeeping) pack.bookkeeping = batch.bookkeeping

console.log(`  待写入 ${events.length} 个事件 → src/data/stories/${story}/packs/${packName}.json`)
if (warnings.length) warnings.forEach((w) => console.log('  ⚠ ' + w))

// ---------- 文案骨架 ----------
const scaffold = (lang) => {
  const src = batch.text?.[lang] ?? {}
  const out = {}
  for (const ev of events) {
    const t = src[ev.id] ?? {}
    out[ev.id] = {
      title: t.title || `TODO:${ev.id}.title`,
      desc: t.desc || `TODO:${ev.id}.desc`,
      choices: Object.fromEntries(
        ev.choices.map((c) => [
          c.id,
          {
            text: t.choices?.[c.id]?.text || `TODO:${ev.id}.${c.id}.text`,
            ...(c.requires ? { req: t.choices?.[c.id]?.req || `TODO:${ev.id}.${c.id}.req` } : {}),
            outcome: t.choices?.[c.id]?.outcome || `TODO:${ev.id}.${c.id}.outcome`,
          },
        ]),
      ),
    }
  }
  return out
}

if (dry) {
  console.log('\n(--dry 模式，未写入任何文件)')
  process.exit(0)
}

writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n')
for (const lang of ['zh', 'en']) {
  const p = join(root, `content/${lang}/${story}/${packName}.json`)
  writeFileSync(p, JSON.stringify(scaffold(lang), null, 2) + '\n')
  console.log(`  已生成文案骨架 content/${lang}/${story}/${packName}.json`)
}

const missing = []
for (const lang of ['zh', 'en']) {
  const data = JSON.parse(readFileSync(join(root, `content/${lang}/${packName}.json`), 'utf8'))
  for (const ev of events) {
    for (const c of ev.choices) {
      if (data[ev.id].choices[c.id].text.startsWith('TODO')) missing.push(`${lang}: ${ev.id}.${c.id}.text`)
      if (data[ev.id].choices[c.id].outcome.startsWith('TODO')) missing.push(`${lang}: ${ev.id}.${c.id}.outcome`)
    }
  }
}

console.log('')
if (existsSync(packPath)) {
  console.log('下一步：')
  console.log(`  1. 填文案（${missing.length} 条待写）：content/zh|en/${story}/${packName}.json`)
  console.log('  2. npm run content   # 合并 + 校验，TODO 占位符会直接报错')
  console.log('  3. npm run lint      # 查死条件、断链、数值越界')
  console.log('  4. npm run sim       # 跑仿真，看新内容有没有把经济搞崩')
}
