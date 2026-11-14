#!/usr/bin/env node
/**
 * 程序化合成音效，输出到 public/audio/。
 *
 * 为什么不用现成素材：
 *   1) 雨声 / 警报这类素材要么付费、要么 CC 授权不明，商用投放有风险；
 *   2) 外部 CDN 在部分地区会被墙或限速，直接影响首屏体验。
 * 这里全部用噪声 + 正弦 + 包络现场合成，零依赖、零版权问题，产物 < 700KB。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/audio')
mkdirSync(outDir, { recursive: true })

const SR = 22050
const TAU = Math.PI * 2

const rnd = () => Math.random() * 2 - 1

/** 一阶低通 */
function onePoleLP(input, a) {
  const out = new Float32Array(input.length)
  let y = 0
  for (let i = 0; i < input.length; i++) {
    y += a * (input[i] - y)
    out[i] = y
  }
  return out
}

/** 循环交叉淡化：让首尾无缝衔接 */
function makeLoop(x, n, fade) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (i < fade) {
      const t = i / fade
      out[i] = x[i] * (1 - t) + x[n + i] * t
    } else {
      out[i] = x[i]
    }
  }
  return out
}

function normalize(x, peak = 0.9) {
  let max = 0
  for (let i = 0; i < x.length; i++) max = Math.max(max, Math.abs(x[i]))
  if (max === 0) return x
  const k = peak / max
  for (let i = 0; i < x.length; i++) x[i] *= k
  return x
}

function writeWav(name, samples) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  writeFileSync(join(outDir, name), buf)
  console.log(`  ${name.padEnd(12)} ${(buf.length / 1024).toFixed(0)} KB`)
}

// ---------- 雨声：带通噪声 + 缓慢起伏 ----------
function rain() {
  const n = SR * 6
  const fade = SR * 0.5
  const raw = new Float32Array(n + fade)
  for (let i = 0; i < raw.length; i++) raw[i] = rnd()

  const low = onePoleLP(raw, 0.12)
  const lower = onePoleLP(raw, 0.012)
  const mid = onePoleLP(raw, 0.45)

  const x = new Float32Array(n + fade)
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const swell = 0.86 + 0.14 * Math.sin(TAU * 0.11 * t) + 0.05 * Math.sin(TAU * 0.37 * t + 1.2)
    x[i] = (low[i] * 0.9 - lower[i] * 0.75 + mid[i] * 0.22) * swell
  }
  return normalize(makeLoop(x, n, fade), 0.62)
}

// ---------- 环境低频嗡鸣：潜艇码头的底噪 ----------
function drone() {
  const n = SR * 8
  const fade = SR * 1
  const x = new Float32Array(n + fade)
  const noise = new Float32Array(n + fade)
  for (let i = 0; i < noise.length; i++) noise[i] = rnd()
  const filtered = onePoleLP(noise, 0.008)

  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const lfo = 0.72 + 0.28 * Math.sin(TAU * 0.07 * t)
    x[i] =
      Math.sin(TAU * 55 * t) * 0.18 +
      Math.sin(TAU * 82.5 * t) * 0.08 +
      Math.sin(TAU * 27.5 * t + 0.6) * 0.1 +
      filtered[i] * 2.4 * lfo * 0.16
    // 轻微的磁带抖动，避免过于「电子」
    x[i] *= 1 + 0.06 * Math.sin(TAU * 3.1 * t)
  }
  return normalize(makeLoop(x, n, fade), 0.5)
}

// ---------- 打字机敲击 ----------
function click() {
  const n = Math.floor(SR * 0.07)
  const x = new Float32Array(n)
  let prev = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.exp(-t * 130)
    const nz = rnd()
    const hp = nz - prev * 0.92
    prev = nz
    x[i] = (hp * 0.85 + Math.sin(TAU * 1750 * t) * 0.35) * env
  }
  return normalize(x, 0.55)
}

// ---------- 印章落下 ----------
function stamp() {
  const n = Math.floor(SR * 0.26)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const body = Math.sin(TAU * 88 * t) * Math.exp(-t * 26)
    const thud = rnd() * Math.exp(-t * 90) * 0.8
    x[i] = body * 0.9 + thud
  }
  return normalize(x, 0.8)
}

// ---------- 警报 ----------
function alarm() {
  const dur = 1.7
  const n = Math.floor(SR * dur)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const sweep = Math.sin(TAU * 0.62 * t) > 0 ? 520 : 392
    const trem = 0.65 + 0.35 * Math.sin(TAU * 9 * t)
    const env = Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.12)
    const s = Math.sin(TAU * sweep * t) + 0.28 * Math.sin(TAU * sweep * 3 * t)
    x[i] = s * trem * env * 0.6
  }
  return normalize(x, 0.7)
}

// ---------- UI 轻提示 ----------
function blip() {
  const n = Math.floor(SR * 0.09)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    x[i] = Math.sin(TAU * 1180 * t) * Math.exp(-t * 42) * 0.55
  }
  return normalize(x, 0.4)
}

console.log('generating audio → public/audio')
writeWav('rain.wav', rain())
writeWav('drone.wav', drone())
writeWav('click.wav', click())
writeWav('stamp.wav', stamp())
writeWav('alarm.wav', alarm())
writeWav('blip.wav', blip())
console.log('done')
