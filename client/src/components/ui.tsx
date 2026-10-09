import type { FormEvent, ReactNode } from 'react'
import { ApiError } from '../lib/api'

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

export function Field({ label, error, children }: { label: string, error?: string, children: ReactNode }) {
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-red-700">{error}</span> : null}
    </label>
  )
}

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15'

export function Button({ children, type = 'button', onClick, disabled, tone = 'primary' }: { children: ReactNode, type?: 'button' | 'submit', onClick?: () => void, disabled?: boolean, tone?: 'primary' | 'secondary' }) {
  const look = tone === 'secondary'
    ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
    : 'bg-teal-800 text-white hover:bg-teal-900'
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-60 ${look}`}>
      {children}
    </button>
  )
}

export function Table({ headers, children, fit = false }: { headers: string[], children: ReactNode, fit?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className={`w-full text-left text-sm ${fit ? '' : 'min-w-[36rem]'}`}>
        <thead className="bg-slate-50 text-slate-500">
          <tr>{headers.map(header => <th key={header} className="px-3 py-2.5 font-medium whitespace-nowrap">{header}</th>)}</tr>
        </thead>
        <tbody className="[&_tr]:border-t [&_tr]:border-slate-200 [&_tr:hover]:bg-slate-50">{children}</tbody>
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
