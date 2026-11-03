import { useRef } from 'react'
import { Database, Download, SlidersHorizontal, Sparkles, Trash2, Upload } from 'lucide-react'
import { Switch } from '../../components/forms/Controls'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useSettings } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { CLOUD_LABEL, CloudStatusDot } from '../../components/CloudStatus'
import { useCloudStatus } from '../../lib/cloudStatus'
import { clearAllData, exportAllData, importAllData } from '../../repositories'
import { settingsService } from '../../services'
import { todayISO } from '../../utils/date'
import { downloadFile } from '../../utils/misc'

export function AppSettingsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { settings } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const canEdit = can('configuracoes', 'edit')
  const canManage = can('configuracoes', 'manage')
  const cloud = useCloudStatus()
  const synced = cloud.state === 'online' || cloud.state === 'cache'
  /** Onde os dados estão guardados, para as mensagens de confirmação. */
  const scope = synced ? 'da igreja na nuvem (em todos os aparelhos)' : 'neste dispositivo'

  const toggleSplash = async (value: boolean) => {
    try {
      await settingsService.save({ showSplash: value })
      toast.success(value ? 'A tela de abertura será exibida.' : 'A tela de abertura foi desativada.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const exportBackup = () => {
    downloadFile(`backup-igreja-${todayISO()}.json`, exportAllData(), 'application/json')
    toast.success('Backup gerado.')
  }

  const importBackup = async (file: File) => {
    const ok = await confirm({
      title: 'Importar backup?',
      message: `Todos os dados atuais ${scope} serão substituídos pelos do arquivo.`,
      confirmLabel: 'Importar',
      tone: 'primary',
    })
    if (!ok) return
    try {
      await importAllData(await file.text())
      toast.success('Backup importado com sucesso.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const clear = async () => {
    const ok = await confirm({
      title: 'Limpar todos os dados?',
      message: `Todos os cadastros ${scope} serão apagados: membros, equipes, eventos, escalas, liturgia, avisos e pedidos. Continuam apenas os usuários, os perfis de acesso e as configurações da igreja. Não há como desfazer.`,
      confirmLabel: 'Apagar tudo',
    })
    if (!ok) return
    try {
      await clearAllData()
      toast.success('Dados apagados. O sistema fica só com os usuários e as configurações.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Page title="Configurações do Aplicativo" subtitle="Personalize o comportamento do app" icon={SlidersHorizontal}>
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="p-5">
          <SectionHeader title="Aparência e abertura" icon={Sparkles} />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-navy-900">Tela de abertura</p>
              <p className="text-sm text-muted">Exibe o logotipo ao abrir o aplicativo (uma vez por sessão).</p>
            </div>
            <Switch checked={settings?.showSplash !== false} onChange={(v) => canEdit && void toggleSplash(v)} label="Tela de abertura" />
          </div>
          {!canEdit && <p className="mt-3 text-xs text-muted">Seu perfil não pode alterar as configurações.</p>}
        </Card>

        <Card className="p-5">
          <SectionHeader title="Dados e sincronização" icon={Database} />
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-navy-900">
            <CloudStatusDot state={cloud.state} />
            {CLOUD_LABEL[cloud.state]}
          </p>
          <p className="mb-4 text-sm text-muted">
            {synced
              ? 'Os cadastros ficam guardados na nuvem (Firebase) e aparecem em todos os aparelhos. Sem internet, o aplicativo continua funcionando e envia as alterações quando a conexão volta.'
              : cloud.reason
                ? `${cloud.reason} Enquanto isso, os dados ficam somente neste dispositivo.`
                : 'Os dados ficam salvos somente neste dispositivo (navegador ou aplicativo). Faça um backup para levar as informações a outro lugar.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Download} onClick={exportBackup}>
              Exportar backup
            </Button>
            {canManage && (
              <>
                <Button variant="outline" icon={Upload} onClick={() => fileInput.current?.click()}>
                  Importar backup
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void importBackup(file)
                  }}
                />
                <Button variant="danger" icon={Trash2} onClick={clear}>
                  Limpar todos os dados
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </Page>
  )
}
