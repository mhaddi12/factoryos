import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { BomRecord } from '@shared/types/records'
import { api } from '../../lib/api'
import { qty } from '../../lib/format'
import { Alert, Page, Table, messageOf } from '../../components/ui'

export function BomDetailPage() {
  const { id = '' } = useParams()
  const [bom, setBom] = useState<BomRecord | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<BomRecord>(`/api/boms/${id}`).then(setBom).catch(reason => setError(messageOf(reason))) }, [id])
  if (!bom) return <Page title="BOM"><Alert error={error} /></Page>
  return (
    <Page title={bom.name}>
      <p className="mb-4 text-sm text-slate-500">{bom.sku} · {bom.productName}</p>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-2">{bom.items.map(item => <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{item.materialName} <span className="text-slate-500">{qty(item.quantity)} {item.unit}</span></div>)}</div>
        <div className="text-center text-slate-400"><span className="lg:hidden">↓</span><span className="hidden lg:inline">→</span></div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center font-medium">{bom.productName}</div>
      </div>
      <Table headers={['Material', 'Quantity', 'Wastage']}>{bom.items.map(item => <tr key={item.id} className="border-t border-slate-200"><td className="px-3 py-2">{item.materialName}</td><td className="px-3 py-2">{qty(item.quantity)} {item.unit}</td><td className="px-3 py-2">{item.wastagePercentage}%</td></tr>)}</Table>
    </Page>
  )
}
