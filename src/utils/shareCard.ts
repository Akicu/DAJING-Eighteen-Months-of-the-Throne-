/**
 * 结局分享图。
 *
 * 这是这个品类唯一的自然增长入口 —— 玩家愿意发的不是分数，是一张「人格判决书」。
 * 版式采用「先测量再绘制」：先把标题/正文按真实字宽折行，算出总高度，
 * 再让整块内容在画布上垂直居中。否则文案短的时候底部会空出一大块，看起来像没做完。
 */

export interface ShareCardData {
  label: string
  win: boolean
  winText: string
  loseText: string
  title: string
  desc: string
  rarity: number
  rarityLabel: string
  statsLabel: string
  stats: Array<{ label: string; value: number }>
  daysLabel: string
  choicesLabel: string
  choices: string[]
  codeLabel: string
  code: string
  footer: string
}

const W = 1080
const H = 1920
const PAD = 96

const COLORS = {
  bg: '#080b12',
  line: 'rgba(255,255,255,0.10)',
  text: '#edeff4',
  muted: 'rgba(237,239,244,0.58)',
  faint: 'rgba(237,239,244,0.30)',
  amber: '#f0b354',
  rose: '#f09595',
  emerald: '#7fd4a8',
}

const FONT_SANS =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif'
const FONT_MONO = '"SF Mono", Menlo, Consolas, "Courier New", monospace'

const TITLE = `600 76px ${FONT_SANS}`
const TITLE_LH = 94
const DESC = `400 33px ${FONT_SANS}`
const DESC_LH = 54
const CHOICE = `400 27px ${FONT_SANS}`
const CHOICE_LH = 40

/** 切成可换行的最小单元：CJK 单字成词，拉丁按单词 */
function tokenize(text: string): string[] {
  const re = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]|[A-Za-z0-9''\-_.]+|\s+|\n|[^\s]/g
  return text.match(re) ?? []
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let current = ''

  const push = () => {
    lines.push(current.trimEnd())
    current = ''
  }

  for (const token of tokenize(text)) {
    if (token === '\n') {
      push()
      continue
    }
    const test = current + token
    if (ctx.measureText(test).width > maxWidth && current.trim() !== '') {
      push()
      if (lines.length >= maxLines) {
        const last = lines[maxLines - 1]
        let clipped = last
        while (ctx.measureText(clipped + '…').width > maxWidth && clipped.length > 1) {
          clipped = clipped.slice(0, -1)
        }
        lines[maxLines - 1] = clipped + '…'
        return lines
      }
      current = token.trimStart()
    } else {
      current = test
    }
  }
  if (current.trim()) lines.push(current.trimEnd())
  return lines.slice(0, maxLines)
}

function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  let cursor = x
  for (const ch of text) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + spacing
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function renderShareCard(data: ShareCardData): {
  dataUrl: string
  width: number
  height: number
} {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(240,179,84,0.22)'
  ctx.lineWidth = 2
  roundRect(ctx, 40, 40, W - 80, H - 80, 32)
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const innerW = W - PAD * 2
  const choices = data.choices.slice(0, 4)

  // ---------- 1. 测量 ----------
  ctx.font = TITLE
  const titleLines = wrapText(ctx, data.title, innerW, 2)

  ctx.font = DESC
  const descLines = wrapText(ctx, data.desc, innerW, 8)

  ctx.font = CHOICE
  const choiceLines = choices.map((c) => wrapText(ctx, c, innerW - 52, 2))

  const titleH = titleLines.length * TITLE_LH
  const tagH = 56
  const descH = descLines.length * DESC_LH
  const statsH = 190
  const choiceBlockH = choiceLines.reduce((n, ls) => n + ls.length * CHOICE_LH + 24, 0)

  const gapTitle = 40
  const gapDesc = 74
  const gapRule = 62
  const gapStats = 52
  const gapChoiceLabel = 38

  const contentH =
    titleH +
    gapTitle +
    tagH +
    gapDesc +
    descH +
    gapRule +
    1 +
    gapStats +
    statsH +
    (choiceLines.length
      ? gapRule + 1 + gapChoiceLabel + choiceBlockH
      : 0)

  const topBound = 200
  const bottomBound = H - 230
  const startY = topBound + Math.max(0, (bottomBound - topBound - contentH) / 2)

  // 顶部标识（固定在顶部，不参与居中）
  ctx.fillStyle = COLORS.faint
  ctx.font = `500 24px ${FONT_MONO}`
  drawSpaced(ctx, data.label, PAD, 118, 4)

  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, 'rgba(240,179,84,0.85)')
  grad.addColorStop(0.6, 'rgba(240,179,84,0.15)')
  grad.addColorStop(1, 'rgba(240,179,84,0)')
  ctx.fillStyle = grad
  ctx.fillRect(PAD, 146, innerW, 3)

  // ---------- 2. 绘制 ----------
  let y = startY + TITLE_LH * 0.78

  ctx.fillStyle = COLORS.text
  ctx.font = TITLE
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y)
    y += TITLE_LH
  }

  y += gapTitle

  // 结果标签
  const tagColor = data.win ? COLORS.emerald : COLORS.rose
  const tagText = data.win ? data.winText : data.loseText
  ctx.font = `500 27px ${FONT_SANS}`
  const tagW = ctx.measureText(tagText).width + 42
  ctx.fillStyle = data.win ? 'rgba(127,212,168,0.15)' : 'rgba(240,149,149,0.15)'
  roundRect(ctx, PAD, y - 34, tagW, 52, 26)
  ctx.fill()
  ctx.fillStyle = tagColor
  ctx.fillText(tagText, PAD + 21, y + 2)

  // 稀有度
  const stars = '★'.repeat(data.rarity) + '☆'.repeat(5 - data.rarity)
  ctx.fillStyle = COLORS.amber
  ctx.font = `400 30px ${FONT_SANS}`
  ctx.fillText(stars, PAD + tagW + 26, y + 2)
  const starW = ctx.measureText(stars).width
  ctx.fillStyle = COLORS.faint
  ctx.font = `400 24px ${FONT_SANS}`
  ctx.fillText(data.rarityLabel, PAD + tagW + 26 + starW + 22, y + 1)

  y += gapDesc

  // 正文
  ctx.fillStyle = COLORS.muted
  ctx.font = DESC
  for (const line of descLines) {
    ctx.fillText(line, PAD, y)
    y += DESC_LH
  }

  y += gapRule

  const rule = () => {
    ctx.strokeStyle = COLORS.line
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
  }
  rule()
  y += gapStats

  // 最终体征
  ctx.fillStyle = COLORS.faint
  ctx.font = `500 22px ${FONT_MONO}`
  drawSpaced(ctx, data.statsLabel, PAD, y, 3)
  ctx.font = `400 22px ${FONT_MONO}`
  ctx.textAlign = 'right'
  ctx.fillText(data.daysLabel, W - PAD, y)
  ctx.textAlign = 'left'

  y += 44
  const colW = innerW / 4
  data.stats.forEach((s, i) => {
    const x = PAD + colW * i
    ctx.fillStyle = COLORS.text
    ctx.font = `500 62px ${FONT_MONO}`
    ctx.fillText(String(s.value), x, y + 56)
    ctx.fillStyle = COLORS.faint
    ctx.font = `400 22px ${FONT_SANS}`
    ctx.fillText(s.label, x, y + 94)
  })

  y += statsH - 6

  // 关键抉择
  if (choiceLines.length) {
    rule()
    y += gapChoiceLabel + 26

    ctx.fillStyle = COLORS.faint
    ctx.font = `500 22px ${FONT_MONO}`
    drawSpaced(ctx, data.choicesLabel, PAD, y, 3)
    y += 40

    choiceLines.forEach((lines) => {
      ctx.fillStyle = COLORS.amber
      ctx.font = `400 27px ${FONT_SANS}`
      ctx.fillText('—', PAD, y)
      ctx.fillStyle = COLORS.muted
      ctx.font = CHOICE
      lines.forEach((line, i) => {
        ctx.fillText(line, PAD + 52, y + i * CHOICE_LH)
      })
      y += lines.length * CHOICE_LH + 24
    })
  }

  // ---------- 3. 页脚 ----------
  ctx.strokeStyle = COLORS.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, H - 168)
  ctx.lineTo(W - PAD, H - 168)
  ctx.stroke()

  ctx.fillStyle = COLORS.faint
  ctx.font = `400 21px ${FONT_MONO}`
  drawSpaced(ctx, data.codeLabel, PAD, H - 118, 2)
  ctx.fillStyle = COLORS.amber
  ctx.font = `500 28px ${FONT_MONO}`
  ctx.fillText(data.code, PAD, H - 78)

  ctx.fillStyle = COLORS.faint
  ctx.font = `400 20px ${FONT_MONO}`
  ctx.textAlign = 'right'
  drawSpaced(ctx, data.footer, W - PAD - 168, H - 82, 3)
  ctx.textAlign = 'left'

  return { dataUrl: canvas.toDataURL('image/png'), width: W, height: H }
}

export async function shareOrDownload(
  dataUrl: string,
  filename: string,
): Promise<'shared' | 'downloaded'> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Sector 7' })
      return 'shared'
    }
  } catch {
    /* 用户取消或浏览器不支持，落到下载 */
  }

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  return 'downloaded'
}
