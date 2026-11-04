/**
 * Fotos do sistema (usuários, equipes e eventos): a imagem escolhida é reduzida e comprimida no próprio aparelho e
 * guardada como texto (data URL JPEG) junto do cadastro. Assim não é preciso um serviço de arquivos à parte, e a foto
 * continua funcionando sem internet. Os limites abaixo mantêm cada cadastro bem abaixo do teto de 1 MB do Firestore.
 */
export interface PhotoOptions {
  maxWidth: number
  maxHeight: number
  /** Tamanho máximo da imagem final, em bytes. */
  maxBytes: number
  /** Recorta no centro para um quadrado (fotos de pessoas e equipes). */
  square?: boolean
}

export const PHOTO_PRESETS = {
  /** Foto de pessoa: quadrada, pequena. */
  avatar: { maxWidth: 320, maxHeight: 320, maxBytes: 40_000, square: true },
  /** Emblema da equipe: quadrado, um pouco maior. */
  team: { maxWidth: 480, maxHeight: 480, maxBytes: 70_000, square: true },
  /** Foto do evento: formato de capa (16:9). */
  event: { maxWidth: 960, maxHeight: 540, maxBytes: 130_000 },
} satisfies Record<string, PhotoOptions>

/** Maior arquivo aceito para escolher (a imagem é reduzida depois). */
export const MAX_PICKED_FILE_BYTES = 15 * 1024 * 1024

export function isImageFile(file: { type: string }): boolean {
  return /^image\/(jpeg|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.type)
}

/** Tamanho aproximado, em bytes, de uma imagem em data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
  return Math.floor((body.length * 3) / 4) - padding
}

/** Só aceita o que foi gerado por este módulo (imagem em data URL), nunca endereços externos. */
export function isPhoto(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/')
}

/** Dimensões finais: cabe no limite sem ampliar; no modo quadrado recorta o centro. */
export function fitSize(width: number, height: number, options: PhotoOptions) {
  if (options.square) {
    const side = Math.min(width, height)
    const target = Math.min(side, options.maxWidth, options.maxHeight)
    return { sx: (width - side) / 2, sy: (height - side) / 2, sw: side, sh: side, dw: target, dh: target }
  }
  const scale = Math.min(1, options.maxWidth / width, options.maxHeight / height)
  return { sx: 0, sy: 0, sw: width, sh: height, dw: Math.max(1, Math.round(width * scale)), dh: Math.max(1, Math.round(height * scale)) }
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // formato que o decodificador rápido não conhece: tenta pelo elemento de imagem
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Reduz e comprime a imagem até caber em `maxBytes`. Lança Error com mensagem amigável se não for possível. */
export async function photoFromFile(file: File, options: PhotoOptions): Promise<string> {
  if (!isImageFile(file)) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WebP).')
  if (file.size > MAX_PICKED_FILE_BYTES) throw new Error('A imagem é muito grande. Escolha uma de até 15 MB.')

  let decoded
  try {
    decoded = await decode(file)
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Tente outra.')
  }
  try {
    if (!decoded.width || !decoded.height) throw new Error('Não foi possível abrir esta imagem. Tente outra.')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Este aparelho não consegue preparar a imagem.')

    let shrink = 1
    for (let attempt = 0; attempt < 6; attempt++) {
      const { sx, sy, sw, sh, dw, dh } = fitSize(decoded.width, decoded.height, options)
      canvas.width = Math.max(1, Math.round(dw * shrink))
      canvas.height = Math.max(1, Math.round(dh * shrink))
      // fundo branco: imagens com transparência (PNG) não ficam pretas no JPEG
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
        const result = canvas.toDataURL('image/jpeg', quality)
        if (dataUrlBytes(result) <= options.maxBytes) return result
      }
      shrink *= 0.8
    }
    throw new Error('Não foi possível reduzir esta imagem o bastante. Tente outra foto.')
  } finally {
    decoded.release()
  }
}
