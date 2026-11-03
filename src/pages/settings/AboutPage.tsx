import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Info, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { LogoMark } from '../../components/ui/Logo'
import { APP_BUILD, APP_NAME, APP_VERSION } from '../../config'
import { useToast } from '../../contexts/ToastContext'
import { usePwaInstall } from '../../hooks/usePwaInstall'
import { Page } from '../../layouts/PageMeta'

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

export function AboutPage() {
  const toast = useToast()
  const online = useOnline()
  const { canInstall, installed, install } = usePwaInstall()
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <Page title="Sobre o Aplicativo" subtitle="Veja informações da versão" icon={Info}>
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="grid size-20 place-items-center rounded-3xl bg-linear-to-br/srgb from-navy-950 to-navy-800 text-white shadow-float">
            <LogoMark className="size-12" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-navy-900">{APP_NAME}</h2>
            <p className="text-sm text-muted">Sistema de gestão da igreja</p>
          </div>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-3 pt-2 text-left text-sm">
            <div className="rounded-2xl bg-royal-50 p-3">
              <dt className="text-xs font-semibold uppercase text-muted">Versão</dt>
              <dd className="font-semibold text-navy-900">{APP_VERSION}</dd>
            </div>
            <div className="rounded-2xl bg-royal-50 p-3">
              <dt className="text-xs font-semibold uppercase text-muted">Conexão</dt>
              <dd className="flex items-center gap-1.5 font-semibold text-navy-900">
                {online ? <Wifi className="size-4 text-emerald-600" /> : <WifiOff className="size-4 text-amber-600" />}
                {online ? 'Online' : 'Offline'}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl bg-royal-50 p-3">
              <dt className="text-xs font-semibold uppercase text-muted">Dados</dt>
              <dd className="font-medium text-navy-900">{APP_BUILD}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Instalar no dispositivo" icon={Smartphone} />
          {installed ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-5" /> O aplicativo já está instalado neste dispositivo.
            </p>
          ) : canInstall ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-ink">Instale para abrir direto da tela inicial e usar mesmo sem internet.</p>
              <Button
                icon={Download}
                onClick={async () => {
                  if (await install()) toast.success('Aplicativo instalado!')
                }}
              >
                Instalar aplicativo
              </Button>
            </div>
          ) : ios ? (
            <p className="text-sm text-ink">
              No iPhone ou iPad, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
            </p>
          ) : (
            <p className="text-sm text-ink">
              Use o menu do navegador e escolha <strong>Instalar aplicativo</strong> (ou <strong>Adicionar à tela inicial</strong>). A opção
              só aparece quando o app é aberto em https ou em localhost.
            </p>
          )}
        </Card>
      </div>
    </Page>
  )
}
