function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find(item => item.type === type)?.value
  if (!value) {
    throw new Error(`Missing ${type} from the date.`)
  }
  return Number(value)
}

function timeZoneOffset(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const asUtc = Date.UTC(
    part(parts, 'year'),
    part(parts, 'month') - 1,
    part(parts, 'day'),
    part(parts, 'hour'),
    part(parts, 'minute'),
    part(parts, 'second'),
  )

  return asUtc - date.getTime()
}

export function startOfZonedDay(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const utcMidnight = Date.UTC(part(parts, 'year'), part(parts, 'month') - 1, part(parts, 'day'))
  const offset = timeZoneOffset(timeZone, new Date(utcMidnight))
  return new Date(utcMidnight - offset)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
