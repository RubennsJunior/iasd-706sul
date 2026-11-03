import { useMemo, useState } from 'react'
import { ShieldCheck, UserRound } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PermissionMatrixEditor } from '../../components/admin/PermissionMatrixEditor'
import { Switch } from '../../components/forms/Controls'
import { FormPage } from '../../components/forms/FormPage'
import type { FormTab } from '../../components/forms/FormPage'
import { Select } from '../../components/forms/Select'
import type { FieldDef, Values } from '../../components/forms/types'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useMembers, useRoles, useUsers } from '../../hooks/useData'
import { cloudEnabled } from '../../lib/firebase'
import { createLoginFor, sendReset } from '../../lib/cloudSession'
import { MODULES } from '../../models'
import type { AppUser, NewEntity, PermissionMatrix, Role, UserStatus } from '../../models'
import { ensureMemberForUser, membersService, usersService, validateUser } from '../../services'
import { formatDate, todayISO } from '../../utils/date'
import { USER_STATUS_OPTIONS } from '../../utils/labels'

const ADMIN_ROLE = 'role-admin'

const TABS: FormTab[] = [
  { key: 'dados', label: 'Dados', icon: UserRound },
  { key: 'permissao', label: 'Permissão', icon: ShieldCheck },
]

const clone = (matrix: PermissionMatrix): PermissionMatrix => JSON.parse(JSON.stringify(matrix))

const lastAccess = (iso?: string) =>
  iso ? `${formatDate(iso.slice(0, 10))} às ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Nunca acessou'

function UserSummary({ item, values, role }: { item?: AppUser; values: Values; role?: Role }) {
  const name = String(values.name ?? '').trim()
  return (
    <Card className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
      <Avatar name={name || 'Novo usuário'} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-navy-900">{name || 'Novo usuário'}</p>
        <p className="truncate text-sm text-muted">{String(values.email ?? '') || 'Informe o e-mail de acesso'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {role && <Badge tone="info">{role.name}</Badge>}
          {values.customEnabled && <Badge tone="gold">Permissões personalizadas</Badge>}
          <StatusBadge kind="user" value={String(values.status || 'ativo')} />
        </div>
      </div>
      {item && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
          <dt className="text-muted">Último acesso</dt>
          <dd className="font-medium text-ink">{lastAccess(item.lastLoginAt)}</dd>
          <dt className="text-muted">Cadastrado em</dt>
          <dd className="font-medium text-ink">{item.createdAt ? formatDate(item.createdAt.slice(0, 10)) : '—'}</dd>
        </dl>
      )}
    </Card>
  )
}

function PermissionsPanel({
  roles,
  values,
  setValues,
  canCustomize,
}: {
  roles: Role[]
  values: Values
  setValues(patch: Values): void
  canCustomize: boolean
}) {
  const role = roles.find((r) => r.id === values.roleId)
  const isAdmin = role?.id === ADMIN_ROLE
  const enabled = Boolean(values.customEnabled) && !isAdmin
  const matrix = enabled ? (values.customPermissions as PermissionMatrix) : role?.permissions
  const modules = matrix ? MODULES.filter((m) => matrix[m].view || matrix[m].manage).length : 0

  const toggle = (on: boolean) => {
    if (on && role) setValues({ customEnabled: true, customPermissions: values.customPermissions ?? clone(role.permissions) })
    else setValues({ customEnabled: false, customPermissions: undefined })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-royal-50 px-4 py-3 text-sm text-ink">
        <p className="font-semibold text-navy-900">{role ? role.name : 'Selecione um perfil de acesso'}</p>
        {role && <p className="text-muted">{role.description}</p>}
        {matrix && (
          <p className="mt-1 text-xs font-medium text-royal-600">
            Acesso a {modules} de {MODULES.length} módulos
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-3.5 py-3">
        <div>
          <span className="block text-sm font-medium text-navy-900">Personalizar permissões deste usuário</span>
          <span className="text-xs text-muted">
            {isAdmin
              ? 'O Administrador Geral sempre tem acesso total.'
              : canCustomize
                ? 'Desligado: vale exatamente o perfil escolhido. Ligado: você marca módulo por módulo.'
                : 'Seu perfil não pode personalizar permissões.'}
          </span>
        </div>
        <Switch
          checked={enabled}
          onChange={toggle}
          disabled={!canCustomize || isAdmin || !role}
          label="Personalizar permissões deste usuário"
        />
      </div>

      {matrix && <PermissionMatrixEditor value={matrix} readOnly={!enabled} onChange={(next) => setValues({ customPermissions: next })} />}
    </div>
  )
}

/** Na nuvem a senha de outra pessoa não pode ser trocada daqui (só o Firebase sabe): envia o e-mail de nova senha. */
function ResetPassword({ email }: { email: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try {
      await sendReset(email)
      toast.success(`Enviamos o link de nova senha para ${email}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
      <p className="text-sm text-muted">A senha fica no Firebase. Para trocá-la, envie o link de nova senha ao e-mail do usuário.</p>
      <Button variant="outline" size="sm" onClick={send} loading={busy}>
        Enviar link de nova senha
      </Button>
    </div>
  )
}

/** Cadastro (`/usuarios/novo`) e edição (`/usuarios/:id/editar`) de usuário, com abas Dados e Permissão. */
export function UserFormPage({ item, backTo }: { item?: AppUser; backTo: string }) {
  const toast = useToast()
  const { can } = useAuth()
  const { items: roles } = useRoles()
  const { items: members } = useMembers()
  const { items: users } = useUsers()
  const [params] = useSearchParams()
  const canCustomize = can('permissoes', 'edit')

  // Membros que ainda não têm usuário: são os que podem ser aproveitados no cadastro.
  const availableMembers = useMemo(() => {
    const linked = new Set(users.map((user) => user.memberId).filter((id): id is string => Boolean(id)))
    return members.filter((member) => !linked.has(member.id))
  }, [members, users])

  const fields = useMemo<FieldDef[]>(
    () => [
      {
        name: 'memberId',
        label: 'Aproveitar cadastro de membro',
        type: 'custom',
        span: 2,
        tab: 'dados',
        section: 'Informações pessoais',
        showIf: () => !item,
        hint: availableMembers.length
          ? 'Escolha um membro já cadastrado para preencher os dados abaixo. O usuário ficará vinculado a ele.'
          : 'Todos os membros já têm um usuário. Preencha os dados para cadastrar um novo usuário e o membro correspondente.',
        render: ({ value, setValues }) => (
          <Select
            value={String(value ?? '')}
            placeholder="Cadastrar usuário do zero"
            emptyOption="Cadastrar usuário do zero"
            searchable
            options={availableMembers.map((member) => ({
              value: member.id,
              label: member.email ? `${member.fullName} — ${member.email}` : member.fullName,
            }))}
            onChange={(id) => {
              const member = availableMembers.find((m) => m.id === id)
              setValues(
                member
                  ? {
                      memberId: member.id,
                      name: member.fullName,
                      email: member.email ?? '',
                      phone: member.phone ?? '',
                      birthDate: member.birthDate ?? '',
                    }
                  : { memberId: '' },
              )
            }}
          />
        ),
      },
      { name: 'name', label: 'Nome completo', type: 'text', required: true, span: 2, tab: 'dados', section: 'Informações pessoais' },
      {
        name: 'email',
        label: 'E-mail (login)',
        type: 'email',
        required: true,
        // na nuvem o e-mail é o acesso criado no Firebase; não dá para trocá-lo daqui
        readOnly: cloudEnabled && Boolean(item),
        hint: cloudEnabled && item ? 'O e-mail de acesso não pode ser alterado.' : undefined,
        tab: 'dados',
        section: 'Informações pessoais',
      },
      { name: 'phone', label: 'Telefone / WhatsApp', type: 'tel', placeholder: '(00) 00000-0000', tab: 'dados', section: 'Informações pessoais' },
      {
        name: 'birthDate',
        label: 'Data de nascimento',
        type: 'date',
        tab: 'dados',
        section: 'Informações pessoais',
        validate: (value) => (value && String(value) > todayISO() ? 'A data não pode ser futura.' : undefined),
      },
      { name: 'notes', label: 'Observações', type: 'textarea', rows: 3, tab: 'dados', section: 'Informações pessoais' },
      {
        name: 'password',
        label: 'Senha',
        type: 'password',
        required: !item,
        hint: cloudEnabled
          ? 'Mínimo de 6 caracteres. A pessoa pode trocá-la depois, em “Minha conta”.'
          : item
            ? 'Deixe em branco para manter a senha atual. Mínimo de 4 caracteres.'
            : 'Mínimo de 4 caracteres.',
        // na nuvem a senha só é definida ao criar; depois, cada pessoa troca a sua ou pede o e-mail de nova senha
        showIf: () => !(cloudEnabled && item),
        validate: (value) => (cloudEnabled && value && String(value).length < 6 ? 'A senha deve ter pelo menos 6 caracteres.' : undefined),
        tab: 'dados',
        section: 'Acesso ao aplicativo',
      },
      {
        name: 'confirmPassword',
        label: 'Confirmar senha',
        type: 'password',
        required: !item,
        showIf: () => !(cloudEnabled && item),
        tab: 'dados',
        section: 'Acesso ao aplicativo',
        validate: (value, values) => (value !== values.password ? 'As senhas não conferem.' : undefined),
      },
      {
        name: 'resetPassword',
        label: 'Senha',
        type: 'custom',
        showIf: () => cloudEnabled && Boolean(item),
        tab: 'dados',
        section: 'Acesso ao aplicativo',
        render: () => <ResetPassword email={item?.email ?? ''} />,
      },
      {
        name: 'status',
        label: 'Situação',
        type: 'select',
        required: true,
        options: USER_STATUS_OPTIONS,
        hint: 'Usuários inativos ou bloqueados não conseguem entrar.',
        tab: 'dados',
        section: 'Acesso ao aplicativo',
      },
      {
        name: 'roleId',
        label: 'Perfil de acesso',
        type: 'select',
        required: true,
        span: 2,
        options: roles.map((r) => ({ value: r.id, label: r.name })),
        hint: 'Define o que o usuário pode ver e fazer no sistema.',
        tab: 'permissao',
        section: 'Perfil',
      },
      {
        name: 'customPermissions',
        label: '',
        type: 'custom',
        tab: 'permissao',
        section: 'Permissões do usuário',
        render: ({ values, setValues }) => (
          <PermissionsPanel roles={roles} values={values} setValues={setValues} canCustomize={canCustomize} />
        ),
      },
    ],
    [roles, canCustomize, item, availableMembers],
  )

  const initialValues: Values = item
    ? {
        ...item,
        memberId: item.memberId ?? '',
        birthDate: item.birthDate ?? '',
        notes: item.notes ?? '',
        // a senha atual nunca volta para a tela; em branco significa "manter"
        password: '',
        confirmPassword: '',
        customEnabled: Boolean(item.customPermissions),
      }
    : {
        memberId: '',
        name: '',
        email: '',
        phone: '',
        birthDate: '',
        notes: '',
        password: '',
        confirmPassword: '',
        status: 'ativo',
        roleId: 'role-membro',
        customEnabled: false,
        customPermissions: undefined,
      }

  const submit = async (values: Values) => {
    const custom = values.customEnabled && values.roleId !== ADMIN_ROLE
    const payload = {
      name: String(values.name).trim(),
      email: String(values.email).trim(),
      phone: String(values.phone ?? '').trim(),
      birthDate: values.birthDate || undefined,
      notes: String(values.notes ?? '').trim() || undefined,
      roleId: values.roleId as string,
      status: values.status as UserStatus,
      customPermissions: custom ? (values.customPermissions as PermissionMatrix) : undefined,
    }
    // todo usuário também é um membro: aproveita o escolhido, reconhece um existente ou cria o cadastro
    await validateUser(payload, item)
    const link = await ensureMemberForUser(
      { ...payload, memberId: String(values.memberId ?? '').trim() || item?.memberId },
      members,
    )
    if (cloudEnabled) {
      if (item) await usersService.update(item.id, { ...payload, memberId: link.memberId })
      else {
        // o membro já existe; o acesso no Firebase só é criado se o cadastro for aceito
        let uid: string
        try {
          uid = await createLoginFor(payload.email, String(values.password))
        } catch (error) {
          if (link.created) await membersService.remove(link.memberId)
          throw error
        }
        await usersService.create({ ...payload, id: uid, memberId: link.memberId } as NewEntity<AppUser>)
      }
    } else if (item) {
      await usersService.update(item.id, {
        ...payload,
        memberId: link.memberId,
        ...(values.password ? { password: String(values.password) } : {}),
      })
    } else {
      await usersService.create({ ...payload, memberId: link.memberId, password: String(values.password) })
    }
    toast.success(item ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.')
  }

  return (
    <FormPage
      backTo={backTo}
      icon={UserRound}
      title={item ? 'Editar usuário' : 'Novo usuário'}
      subtitle={item ? item.name : 'Crie o acesso de uma pessoa ao aplicativo'}
      tabs={TABS}
      initialTab={params.get('aba') === 'permissao' ? 'permissao' : 'dados'}
      header={(values) => <UserSummary item={item} values={values} role={roles.find((r) => r.id === values.roleId)} />}
      fields={fields}
      initialValues={initialValues}
      onSubmit={submit}
    />
  )
}
