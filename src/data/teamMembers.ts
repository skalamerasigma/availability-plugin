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
  // NEW YORK (15 members)
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
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765284907/Untitled_design_13_qeyxww.svg',
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
    id: 'priyanshi',
    name: 'Priyanshi',
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/12_avm2xl.svg',
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

  // =========================
  // SAN FRANCISCO (12 members)
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
    avatar: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765311038/Untitled_design_18_uze5nk.svg',
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

  // ==================
  // LONDON (5 members)
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
