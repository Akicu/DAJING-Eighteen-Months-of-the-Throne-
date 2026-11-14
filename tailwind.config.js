/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        sans: ['"Inter"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        // 奏折体：macOS / iOS 宋体 → 思源宋体 → Windows SimSun → 英文衬线
        // 中文小字号下宋体偏细，所以正文一律 ≥13px，见 index.css 的 body 基线
        serif: [
          '"Songti SC"',
          '"Songti TC"',
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          'STSong',
          'SimSun',
          'Georgia',
          'serif',
        ],
      },
      colors: {
        // 暖墨。原来是冷蓝黑 #080b12（Linear / Vercel 的招牌色），
        // 清宫戏里出现冷蓝底是最露馅的一处，整体往棕黑方向压
        ink: {
          950: '#0b0906',
          900: '#100d09',
          850: '#15110c',
          800: '#1b1610',
          700: '#28211a',
          600: '#3a3128',
        },
        // 纸：正文与边框都用它，比纯白暖一档，长段落不刺眼
        paper: {
          50: '#f4eee1',
          100: '#e8dcc8',
          200: '#d5c6ab',
          300: '#b3a48d',
          400: '#8b8071',
          500: '#6d6355',
          600: '#4c453a',
          700: '#332e26',
        },
        // 朱砂。全局唯一的强调色 —— 批红、印、危险线都由它承担
        cinnabar: {
          300: '#e08a76',
          400: '#cc6551',
          500: '#b23a2e',
          600: '#8f2c22',
          700: '#6b2018',
        },
        // 石青。只用于「已接触 / 中立」这类次级状态，不再和朱砂抢
        stone: {
          400: '#7d9aa3',
          500: '#4f6f79',
          600: '#3a545d',
        },
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-3px)' },
          '75%': { transform: 'translateX(3px)' },
        },
        // 属性变动时在数字旁浮起的 +9 / -6。位移刻意做小：
        // 单元格只有 46px 高，飘太远会顶出 HUD 边界被裁掉
        floatUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '18%': { opacity: '1', transform: 'translateY(0)' },
          '66%': { opacity: '1', transform: 'translateY(-3px)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
        // 只做透明度，不碰布局 —— 用在边框上做「这条线还活着」的呼吸
        breathe: {
          '0%,100%': { opacity: '0.14' },
          '50%': { opacity: '0.6' },
        },
        // 落笔：点选项时从指尖渗开的一圈墨
        // 墨点：起始不透明度要高，否则前 150ms 在深底上完全看不见
        inkSpread: {
          '0%': { opacity: '0.85', transform: 'scale(0.15)' },
          '65%': { opacity: '0.3' },
          '100%': { opacity: '0', transform: 'scale(1)' },
        },
        // 奏折从下方推上来
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // 落印：略大于原尺寸压下去，回弹到原位
        stamp: {
          '0%': { opacity: '0', transform: 'scale(1.3) rotate(-6deg)' },
          '55%': { opacity: '1', transform: 'scale(0.96) rotate(-6deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-6deg)' },
        },
        // 结局页那枚印：从两倍尺寸砸下来再压回。比 stamp 更重，
        // 因为它只出现一次，是整个流程的最后一个动作
        sealSlam: {
          '0%': { opacity: '0', transform: 'scale(1.9) rotate(-4deg)' },
          '38%': { opacity: '0.92', transform: 'scale(0.9) rotate(-4deg)' },
          '58%': { transform: 'scale(1.02) rotate(-4deg)' },
          '100%': { opacity: '0.86', transform: 'scale(1) rotate(-4deg)' },
        },
        // 心力濒死的暗角呼吸放在 index.css 里手写：
        // reduced-motion 降级后要单独给一个静态亮度，走 Tailwind 类拿不到那个终态
      },
      animation: {
        // fill-mode 用 both：带 delay 的错位入场不会先亮一下再闪
        fadeUp: 'fadeUp .28s cubic-bezier(.2,.7,.3,1) both',
        fadeIn: 'fadeIn .2s ease-out both',
        shake: 'shake .3s ease-in-out',
        floatUp: 'floatUp 1.1s ease-out both',
        breathe: 'breathe 2.6s ease-in-out infinite',
        inkSpread: 'inkSpread .5s cubic-bezier(.2,.7,.3,1) forwards',
        slideUp: 'slideUp .24s cubic-bezier(.2,.7,.3,1) both',
        stamp: 'stamp .34s cubic-bezier(.2,.8,.3,1) both',
        sealSlam: 'sealSlam .46s cubic-bezier(.2,.75,.25,1) both',
      },
    },
  },
  plugins: [],
}
