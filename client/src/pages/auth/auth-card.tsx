import type { ReactNode } from 'react'

export function AuthCard({ title, children }: { title: string, children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-teal-800">FactoryOS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
