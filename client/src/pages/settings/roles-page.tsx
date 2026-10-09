import { USER_ROLES, permissionsForRole } from '@shared/auth/permissions'
import { ROLE_LABELS } from '@shared/navigation'
import { Page, Table } from '../../components/ui'

export function RolesPage() {
  return (
    <Page title="Roles">
      <Table headers={['Role', 'Permissions']} fit>
        {USER_ROLES.map(role => <tr key={role} className="border-t border-slate-200"><td className="px-3 py-2 whitespace-nowrap">{ROLE_LABELS[role]}</td><td className="px-3 py-2 text-slate-500">{permissionsForRole(role).join(', ')}</td></tr>)}
      </Table>
    </Page>
  )
}
