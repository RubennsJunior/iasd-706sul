import type { Asset } from '../models'
import { repos } from '../repositories'
import { createCrudService } from './crud'

export const assetsService = createCrudService<Asset>(repos.assets, {
  label: 'Patrimônio',
  activityKind: 'patrimonio',
  nameOf: (a) => `${a.assetNumber ? `[${a.assetNumber}] ` : ''}${a.name}`,
})

