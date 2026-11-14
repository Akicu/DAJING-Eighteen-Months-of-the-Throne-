import { Howl, Howler } from 'howler'

const BASE = import.meta.env.BASE_URL

/**
 * 背景环境音总开关。
 *
 * 当前版本先关掉：程序合成的雨声 + 低频嗡鸣质感不够，长时间循环会显得廉价。
 * 换成真正的授权音源（或自己录的）之后，把这里改回 true 即可，
 * 下面的 startAmbience / setAmbience / setTension 都能原样复用。
 */
const AMBIENCE_ENABLED = false

type SfxName = 'click' | 'stamp' | 'alarm' | 'blip'

interface AmbienceTrack {
  howl: Howl
  volume: number
}

/**
 * 音频管理层。
 *
 * 移动端浏览器禁止无用户手势的自动播放，所以 ambience 只在 unlock()
 * （第一次点击/触摸）后启动；在此之前所有播放请求都会被静默丢弃。
 */
class AudioManager {
  private ambience: AmbienceTrack[] = []
  private sfx = new Map<SfxName, Howl>()
  private started = false
  private soundOn = true
  private ambienceOn = true
  private loadedSfx = false

  private loadSfx() {
    if (this.loadedSfx) return
    this.loadedSfx = true
    const defs: Array<[SfxName, string, number]> = [
      ['click', 'click.wav', 0.45],
      ['stamp', 'stamp.wav', 0.7],
      ['alarm', 'alarm.wav', 0.5],
      ['blip', 'blip.wav', 0.35],
    ]
    for (const [name, file, volume] of defs) {
      this.sfx.set(
        name,
        new Howl({ src: [`${BASE}audio/${file}`], volume, preload: true, html5: false }),
      )
    }
  }

  private startAmbience() {
    if (!AMBIENCE_ENABLED) return
    if (this.started) return
    this.started = true
    const layers: Array<[string, number]> = [
      ['rain.wav', 0.34],
      ['drone.wav', 0.22],
    ]
    for (const [file, volume] of layers) {
      const howl = new Howl({
        src: [`${BASE}audio/${file}`],
        loop: true,
        volume: 0,
        preload: true,
        html5: true,
      })
      howl.play()
      this.ambience.push({ howl, volume })
      if (this.ambienceOn) howl.fade(0, volume, 2200)
      else howl.volume(0)
    }
  }

  /** 必须在第一次用户手势里调用 */
  unlock() {
    this.loadSfx()
    const ctx = Howler.ctx
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    this.startAmbience()
  }

  play(name: SfxName) {
    if (!this.soundOn) return
    this.loadSfx()
    const howl = this.sfx.get(name)
    if (!howl) return
    // 同帧多次触发时，直接重播而不是叠音
    if (howl.playing()) howl.stop()
    howl.play()
  }

  setSound(on: boolean) {
    this.soundOn = on
  }

  setAmbience(on: boolean) {
    this.ambienceOn = on
    if (!AMBIENCE_ENABLED) return
    for (const { howl, volume } of this.ambience) {
      howl.fade(howl.volume(), on ? volume : 0, 600)
    }
  }

  /** 理智过低时压低环境音，制造压迫感 */
  setTension(t: number) {
    if (!AMBIENCE_ENABLED) return
    const clamped = Math.max(0, Math.min(1, t))
    for (const layer of this.ambience) {
      const target = this.ambienceOn ? layer.volume * (1 - clamped * 0.65) : 0
      layer.howl.volume(target)
    }
  }

  dispose() {
    this.ambience.forEach(({ howl }) => howl.unload())
    this.ambience = []
    this.sfx.forEach((howl) => howl.unload())
    this.sfx.clear()
    this.started = false
    this.loadedSfx = false
  }
}

export const audio = new AudioManager()
