import type { AgentStatus } from '../types'

export interface TeamMember {
  id: string
  name: string
  avatar: string
  timezone: string
  defaultStatus?: AgentStatus
}

/**
 * Real team member data with Cloudinary avatars
 */
export const TEAM_MEMBERS: TeamMember[] = [
  // =====================
  // NEW YORK (19 members)
  // =====================
  {
    id: 'nick',
    name: 'Nick',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232392/2_fpxpja.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'julia',
    name: 'Julia',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/17_hxyc2t.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'ankita',
    name: 'Ankita',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765282918/Untitled_design_10_bsgeve.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'nikhil',
    name: 'Nikhil',
    avatar: 'https://static.intercomassets.com/avatars/8710209/square_128/d575c470-8926-4431-aaee-1569111745e5_1-1755714993.jpg',
    timezone: 'America/New_York',
  },
  {
    id: 'erez',
    name: 'Erez',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/10_ttgpck.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'xyla',
    name: 'Xyla',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232391/7_qwfphq.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'rashi',
    name: 'Rashi',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765293772/Untitled_design_14_w3uv23.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'ryan',
    name: 'Ryan',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232392/5_kw4h8x.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'krish',
    name: 'Krish',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/15_hwmz5x.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'lyle',
    name: 'Lyle',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/14_vqo4ks.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'betty',
    name: 'Betty',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232391/8_efebpc.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'arley',
    name: 'Arley',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/9_vpzwjd.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'siddhi',
    name: 'Siddhi',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232392/6_f3d2qt.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'swapnil',
    name: 'Swapnil',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/11_xrb9qj.svg',
    timezone: 'America/New_York',
  },
  {
    id: 'stephen',
    name: 'Stephen',
    avatar: 'https://static.intercomassets.com/avatars/9110812/square_128/sigma_photo-1761684652.png',
    timezone: 'America/New_York',
  },
  {
    id: 'grace',
    name: 'Grace',
    avatar: 'https://static.intercomassets.com/avatars/7339274/square_128/slack_img_cropped-1714574408.jpeg',
    timezone: 'America/New_York',
  },
  {
    id: 'david',
    name: 'David',
    avatar: 'https://static.intercomassets.com/avatars/9656338/square_128/IMG_3055-1768339772.jpeg',
    timezone: 'America/New_York',
  },
  {
    id: 'zen',
    name: 'Zen',
    avatar: 'https://static.intercomassets.com/avatars/8893370/square_128/photo_squared-1758117953.jpeg',
    timezone: 'America/New_York',
  },

  // =========================
  // SAN FRANCISCO (16 members)
  // =========================
  {
    id: 'sanyam',
    name: 'Sanyam',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765382789/Untitled_design_10_kzcja0.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'hem',
    name: 'Hem',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765318686/Untitled_design_22_uydf2h.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'sagarika',
    name: 'Sagarika',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232530/Untitled_design_8_ikixmx.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'nikita',
    name: 'Nikita',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765284091/Untitled_design_11_mbsjbt.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'payton',
    name: 'Payton',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232385/22_pammoi.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'bhavana',
    name: 'Bhavana',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765318568/Untitled_design_21_kuwvcw.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'grania',
    name: 'Grania',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/21_tjy6io.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'soheli',
    name: 'Soheli',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765318474/Untitled_design_20_zsho0q.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'hayden',
    name: 'Hayden',
    avatar: 'https://static.intercomassets.com/avatars/8411107/square_128/IMG_4063-1748968966.JPG',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'roshini',
    name: 'Roshini',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765311036/Untitled_design_19_ls5fat.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'abhijeet',
    name: 'Abhijeet',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765310522/Untitled_design_16_jffaql.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'ratna',
    name: 'Ratna',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765311039/Untitled_design_17_lchaky.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'sahibeer',
    name: 'Sahibeer',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1767268642/sahibeer_g0bk1n.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'priyanshi',
    name: 'Priyanshi',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/12_avm2xl.svg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'chetana',
    name: 'Chetana',
    avatar: 'https://static.intercomassets.com/avatars/7274393/square_128/intercom_1712708295666-1712708358.jpeg',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'vruddhi',
    name: 'Vruddhi',
    avatar: 'https://static.intercomassets.com/avatars/9657303/square_128/Photo-1768083840.png',
    timezone: 'America/Los_Angeles',
  },

  // ==================
  // LONDON (7 members)
  // ==================
  {
    id: 'nathan',
    name: 'Nathan',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232389/13_flxpry.svg',
    timezone: 'Europe/London',
  },
  {
    id: 'j',
    name: 'J',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232387/18_yqqjho.svg',
    timezone: 'Europe/London',
  },
  {
    id: 'kabilan',
    name: 'Kabilan',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232387/16_hgphrw.svg',
    timezone: 'Europe/London',
  },
  {
    id: 'salman',
    name: 'Salman',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232386/20_ukjqlc.svg',
    timezone: 'Europe/London',
  },
  {
    id: 'erin',
    name: 'Erin',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232386/19_q54uo5.svg',
    timezone: 'Europe/London',
  },
  {
    id: 'holly',
    name: 'Holly',
    avatar: 'https://static.intercomassets.com/avatars/7254229/square_128/IMG_5367-1740050085.jpg',
    timezone: 'Europe/London',
  },
  {
    id: 'somachi',
    name: 'Somachi',
    avatar: 'https://static.intercomassets.com/avatars/9654462/square_128/Somachi_headshot-1768473476.png',
    timezone: 'Europe/London',
  },
]

/**
 * Get team members grouped by timezone
 */
export function getTeamByTimezone(timezone: string): TeamMember[] {
  return TEAM_MEMBERS.filter(m => m.timezone === timezone)
}

/**
 * Get all unique timezones from team
 */
export function getTeamTimezones(): string[] {
  return [...new Set(TEAM_MEMBERS.map(m => m.timezone))]
}
