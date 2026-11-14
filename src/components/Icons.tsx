interface IconProps {
  name: IconName
  className?: string
  strokeWidth?: number
}

export type IconName =
  | 'gate'
  | 'pub'
  | 'medbay'
  | 'market'
  | 'dorm'
  | 'sound'
  | 'mute'
  | 'globe'
  | 'share'
  | 'restart'
  | 'chevron'
  | 'lock'
  | 'chain'
  | 'download'
  | 'close'
  | 'users'
  // 多剧本用的地点图标（大靖）
  | 'throne'
  | 'scroll'
  | 'vault'
  | 'banner'
  | 'moon'
  | 'dice'

const PATHS: Record<IconName, string[]> = {
  gate: ['M4 21h16', 'M8 21V9l4-3 4 3v12', 'M8 13h8'],
  pub: ['M7 4h10l-1.2 7.5a4 4 0 0 1-7.6 0L7 4z', 'M12 15.5V20', 'M9 20h6'],
  medbay: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v8', 'M8 12h8'],
  market: ['M5.5 8h13l1 12h-15l1-12z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  dorm: ['M3 20v-9', 'M3 15h18v5', 'M7 15v-3h5v3'],
  sound: ['M4 9.5v5h3l4.5 3.5V6L7 9.5H4z', 'M15.8 8.8a4.5 4.5 0 0 1 0 6.4'],
  mute: ['M4 9.5v5h3l4.5 3.5V6L7 9.5H4z', 'M15.5 9.5l5 5', 'M20.5 9.5l-5 5'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3.4 3 14.6 0 18'],
  share: ['M12 3.5v11', 'M8.5 7L12 3.5 15.5 7', 'M4.5 14v4.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V14'],
  restart: ['M4 12a8 8 0 0 1 13.6-5.7L20 8.5', 'M20 4v4.5h-4.5'],
  chevron: ['M9.5 6l6 6-6 6'],
  lock: ['M6 11h12v9.5H6z', 'M9 11V8.2a3 3 0 0 1 6 0V11'],
  chain: ['M9.5 7.5H7.5a4 4 0 0 0 0 8h2', 'M14.5 7.5h2a4 4 0 0 1 0 8h-2', 'M8.5 11.5h7'],
  download: ['M12 3.5v10', 'M8 9.5l4 4 4-4', 'M5 19.5h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  users: ['M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11z', 'M3.5 20a5.5 5.5 0 0 1 11 0', 'M16 5.2a3 3 0 0 1 0 5.8', 'M17.5 14.6a5.2 5.2 0 0 1 3 4.9'],
  throne: ['M5 20.5h14', 'M7 20.5V13', 'M17 20.5V13', 'M7 13h10', 'M9 13V7l3-2.5L15 7v6'],
  scroll: ['M7 3.5h10a2 2 0 0 1 2 2v15l-3-2-3 2-3-2-3 2v-15a2 2 0 0 1 2-2z', 'M9.5 8h5', 'M9.5 11.5h5'],
  vault: ['M4 7.5h16v11.5H4z', 'M12 10.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z', 'M12 13.4v2', 'M7 7.5V5.5h10v2'],
  banner: ['M6 3.5v17', 'M6 4.5h11.5l-2.6 4.2 2.6 4.2H6'],
  moon: ['M20 13.6A8 8 0 1 1 10.4 4a6.4 6.4 0 0 0 9.6 9.6z'],
  // 骰子：两点用实心小方块画。24 viewBox 里再小的点，缩到 12px 就只剩一个像素，认不出来
  dice: [
    'M6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z',
    'M8.4 8.4h2.4v2.4H8.4z',
    'M13.2 13.2h2.4v2.4h-2.4z',
  ],
}

export function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.6 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
