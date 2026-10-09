import { createContext, useContext, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../lib/api'

const BusyContext = createContext(false)

export { Bars } from './charts'

export const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5'

export function Page({ title, action, children }: { title: string, action?: ReactNode, children: ReactNode }) {
  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Alert({ error }: { error: string }) {
  if (!error) return null
  return <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
}

export function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : 'The request failed.'
}

export function Drawer({ title, open, onClose, children }: { title: string, open: boolean, onClose: () => void, children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="sheet h-full w-full overflow-auto bg-white p-5 shadow-xl sm:max-w-lg sm:border-l sm:border-slate-200 sm:p-6" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Shimmer({ className = '' }: { className?: string }) {
  return <span className={`shimmer ${className}`} />
}

export function LoadingNote() {
  return <p className="sr-only" role="status">Loading</p>
}

export function Field({ label, error, loading = false, children }: { label: string, error?: string, loading?: boolean, children: ReactNode }) {
  const busy = useContext(BusyContext) && !loading
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      {loading ? <Shimmer className="h-10 w-full" /> : (
        <span className={`relative block ${busy ? 'field-busy pointer-events-none' : ''}`}>
          {children}
          {busy ? <span className="loader absolute top-1/2 right-3 -translate-y-1/2" aria-hidden="true" /> : null}
        </span>
      )}
      {error ? <span className="mt-1 block text-red-700">{error}</span> : null}
    </label>
  )
}

export function BusyForm({ busy, onSubmit, children }: { busy: boolean, onSubmit: () => void | Promise<void>, children: ReactNode }) {
  return (
    <BusyContext.Provider value={busy}>
      <form aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void onSubmit() }}>
        {children}
      </form>
    </BusyContext.Provider>
  )
}

export function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      <LoadingNote />
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={panelClass}>
          <Shimmer className="h-4 w-24" />
          <Shimmer className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <LoadingNote />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index}>
          <Shimmer className="mb-2 h-3 w-28" />
          <Shimmer className="h-2 w-full" />
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div aria-busy="true">
      <LoadingNote />
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="mb-4">
          <Shimmer className="mb-2 h-4 w-24" />
          <Shimmer className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15'

export function Button({ children, type = 'button', onClick, disabled, busy = false, tone = 'primary' }: { children: ReactNode, type?: 'button' | 'submit', onClick?: () => void, disabled?: boolean, busy?: boolean, tone?: 'primary' | 'secondary' }) {
  const look = tone === 'secondary'
    ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
    : 'bg-teal-800 text-white hover:bg-teal-900'
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy || undefined} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-60 ${look}`}>
      {busy ? <span className={`loader ${tone === 'primary' ? 'loader-on-dark' : ''}`} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function Table({ headers, children, fit = false, loading = false }: { headers: string[], children?: ReactNode, fit?: boolean, loading?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white" aria-busy={loading || undefined}>
      {loading ? <LoadingNote /> : null}
      <table className={`w-full text-left text-sm ${fit ? '' : 'min-w-[36rem]'}`}>
        <thead className="bg-slate-50 text-slate-500">
          <tr>{headers.map(header => <th key={header} className="px-3 py-2.5 font-medium whitespace-nowrap">{header}</th>)}</tr>
        </thead>
        <tbody className="[&_tr]:border-t [&_tr]:border-slate-200 [&_tr:hover]:bg-slate-50">
          {loading
            ? Array.from({ length: 6 }, (_, row) => (
                <tr key={row}>
                  {headers.map(header => <td key={header} className="px-3 py-3"><Shimmer className="h-4 w-full max-w-36" /></td>)}
                </tr>
              ))
            : children}
        </tbody>
      </table>
    </div>
  )
}

export function onSubmit(handler: () => void | Promise<void>) {
  return (event: FormEvent) => {
    event.preventDefault()
    void handler()
  }
}
