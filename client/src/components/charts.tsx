import { useEffect, useState } from 'react'

export type ChartItem = {
  label: string
  value: number
  display: string
}

function useGrow() {
  const [grow, setGrow] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrow(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return grow
}

function summary(items: ChartItem[]) {
  return items.map(item => `${item.label} ${item.display}`).join(', ')
}

export function Bars({ items }: { items: ChartItem[] }) {
  const grow = useGrow()
  const peak = Math.max(1, ...items.map(item => item.value))
  if (items.length === 0) return null
  return (
    <div className="space-y-3" role="img" aria-label={summary(items)}>
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 text-slate-500">{item.display}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div
              className="chart-bar h-2 rounded-full bg-teal-700"
              style={{ width: grow ? `${Math.min(100, (item.value / peak) * 100)}%` : '0%', transitionDelay: `${index * 50}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ColumnChart({ items }: { items: ChartItem[] }) {
  const grow = useGrow()
  const peak = Math.max(1, ...items.map(item => item.value))
  if (items.length === 0) return null
  return (
    <div role="img" aria-label={summary(items)}>
      <div className="flex h-40 items-end gap-2">
        {items.map((item, index) => (
          <div key={item.label} className="flex h-full min-w-0 flex-1 items-end">
            <div
              className="chart-bar w-full rounded-t-md bg-teal-700"
              style={{ height: grow ? `${Math.max(item.value > 0 ? 4 : 0, (item.value / peak) * 100)}%` : '0%', transitionDelay: `${index * 60}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {items.map(item => (
          <div key={item.label} className="min-w-0 flex-1 text-center">
            <p className="text-sm font-medium">{item.display}</p>
            <p className="truncate text-xs text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompareBars({ items }: { items: Array<{ label: string, current: number, currentDisplay: string, minimum: number, minimumDisplay: string }> }) {
  const grow = useGrow()
  if (items.length === 0) return null
  return (
    <div className="space-y-4" role="img" aria-label={items.map(item => `${item.label} on hand ${item.currentDisplay}, minimum ${item.minimumDisplay}`).join(', ')}>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-700" />On hand</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Minimum</span>
      </div>
      {items.map((item, index) => {
        const peak = Math.max(item.current, item.minimum, 0.0001)
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 text-slate-500">{item.currentDisplay} / {item.minimumDisplay}</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-200">
                <div className="chart-bar h-2 rounded-full bg-teal-700" style={{ width: grow ? `${(item.current / peak) * 100}%` : '0%', transitionDelay: `${index * 50}ms` }} />
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="chart-bar h-2 rounded-full bg-amber-500" style={{ width: grow ? `${(item.minimum / peak) * 100}%` : '0%', transitionDelay: `${index * 50 + 40}ms` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const splitColors = ['bg-teal-700', 'bg-amber-500', 'bg-slate-500']

export function SplitBar({ parts, total }: { parts: ChartItem[], total: string }) {
  const grow = useGrow()
  const sum = parts.reduce((totalValue, part) => totalValue + part.value, 0)
  return (
    <div role="img" aria-label={`${summary(parts)}. Total ${total}`}>
      <p className="mb-3 text-sm text-slate-500">Total {total}</p>
      {sum > 0 ? (
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-200">
          {parts.map((part, index) => (
            <div
              key={part.label}
              className={`chart-bar h-3 ${splitColors[index] ?? 'bg-teal-700'}`}
              style={{ width: grow ? `${(part.value / sum) * 100}%` : '0%', transitionDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {parts.map((part, index) => (
          <span key={part.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${splitColors[index] ?? 'bg-teal-700'}`} />
            {part.label} <span className="text-slate-500">{part.display}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
