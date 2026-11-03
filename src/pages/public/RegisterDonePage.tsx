import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page } from '../../layouts/PageMeta'

export function RegisterDonePage() {
  return (
    <Page title="Cadastro enviado" subtitle="Obrigado por querer fazer parte!" icon={CheckCircle2}>
      <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 p-7 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-9" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-navy-900">Recebemos o seu cadastro!</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            A secretaria e a liderança vão analisar o pedido e entrar em contato pelo telefone ou e-mail que você informou.
            Enquanto isso, você já pode acompanhar os eventos e as escalas como visitante.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/visitante">
            <Button>Ver eventos e escalas</Button>
          </Link>
          <Link to="/login">
            <Button variant="outline">Voltar ao início</Button>
          </Link>
        </div>
      </Card>
    </Page>
  )
}
