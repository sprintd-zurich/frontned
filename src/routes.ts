/** Home is the company desk. Every workflow page lives under one tender. */

export const HOME = '/'

export const TENDER_PAGES = [
  'positions',
  'matched',
  'calculation',
  'rfq',
  'bid',
  'validation',
  'export',
  'systems',
  'face-to-face',
  'review',
] as const

export type TenderPage = (typeof TENDER_PAGES)[number]

export function tenderPath(id: string, page: TenderPage = 'positions') {
  return `/tenders/${id}/${page}`
}

/** The last path segment of a tender URL, or null on the home page. */
export function pageOf(pathname: string): TenderPage | null {
  const m = pathname.match(/^\/tenders\/[^/]+\/([^/]+)/)
  return m && (TENDER_PAGES as readonly string[]).includes(m[1]) ? (m[1] as TenderPage) : null
}

export function tenderIdOf(pathname: string): string | null {
  const m = pathname.match(/^\/tenders\/([^/]+)/)
  return m?.[1] ?? null
}
