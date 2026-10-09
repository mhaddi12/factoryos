export function statusLabel(value: string) {
  return value.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function money(value: string, currency = 'PKR') {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value))
}

export function qty(value: string) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 4 }).format(Number(value))
}

export function todayInput() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
