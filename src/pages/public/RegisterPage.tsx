import { UserPlus } from 'lucide-react'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef, Values } from '../../components/forms/types'
import { useTeams } from '../../hooks/useData'
import { requestsService } from '../../services'
import { todayISO } from '../../utils/date'

/** Cadastro público de membro (`/cadastro`): vira uma solicitação para a secretaria analisar. Não cria usuário. */
export function RegisterPage() {
  const { items: teams } = useTeams()

  const fields: FieldDef[] = [
    { name: 'fullName', label: 'Nome completo', type: 'text', required: true, span: 2, section: 'Seus dados', hint: 'Nome e sobrenome.' },
    { name: 'phone', label: 'Telefone / WhatsApp', type: 'tel', required: true, placeholder: '(00) 00000-0000', section: 'Seus dados' },
    {
      name: 'email',
      label: 'E-mail',
      type: 'email',
      required: true,
      placeholder: 'nome@exemplo.com',
      hint: 'Usamos este e-mail para entrar em contato com você.',
      section: 'Seus dados',
    },
    {
      name: 'birthDate',
      label: 'Data de nascimento',
      type: 'date',
      section: 'Seus dados',
      validate: (value) => (value && String(value) > todayISO() ? 'A data não pode ser futura.' : undefined),
    },
    { name: 'address', label: 'Endereço', type: 'text', span: 2, section: 'Seus dados' },
    { name: 'baptized', label: 'Já sou batizado(a)', type: 'switch', section: 'Seus dados' },
    {
      name: 'baptismDate',
      label: 'Data do batismo (se souber)',
      type: 'date',
      section: 'Seus dados',
      showIf: (values) => Boolean(values.baptized),
      validate: (value, values) =>
        value && values.birthDate && String(value) < String(values.birthDate)
          ? 'O batismo não pode ser anterior ao nascimento.'
          : undefined,
    },
    {
      name: 'teamIds',
      label: 'Em quais equipes você gostaria de participar?',
      type: 'multiselect',
      section: 'Participação',
      hint: 'Escolha quantas quiser. A liderança confirma com você; pode deixar em branco.',
      options: teams
        .filter((t) => t.status === 'ativa')
        .map((t) => ({ value: t.id, label: t.description ? `${t.name} — ${t.description}` : t.name })),
    },
    { name: 'message', label: 'Quer deixar um recado? (opcional)', type: 'textarea', rows: 3, section: 'Participação' },
    {
      name: 'consent',
      label: 'Autorizo a igreja a guardar meus dados para entrar em contato comigo',
      type: 'switch',
      section: 'Autorização',
      validate: (value) => (value ? undefined : 'Para enviar o cadastro, é preciso autorizar o uso dos dados.'),
    },
  ]

  const initialValues: Values = {
    fullName: '',
    phone: '',
    email: '',
    birthDate: '',
    address: '',
    baptized: false,
    baptismDate: '',
    teamIds: [],
    message: '',
    consent: false,
  }

  return (
    <FormPage
      backTo="/login"
      afterSave="/cadastro/enviado"
      icon={UserPlus}
      title="Quero me cadastrar"
      subtitle="Cadastro de membro — a secretaria analisa depois"
      submitLabel="Enviar cadastro"
      fields={fields}
      initialValues={initialValues}
      onSubmit={async (values) => {
        await requestsService.submit({
          fullName: String(values.fullName),
          phone: String(values.phone),
          email: String(values.email ?? ''),
          birthDate: String(values.birthDate ?? ''),
          address: String(values.address ?? ''),
          baptized: Boolean(values.baptized),
          baptismDate: String(values.baptismDate ?? ''),
          teamIds: (values.teamIds as string[]) ?? [],
          message: String(values.message ?? ''),
        })
      }}
    />
  )
}
