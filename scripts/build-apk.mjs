/*
 * Gera o APK do aplicativo do mesmo jeito do ERP_Controle_Produção: release assinado, com a versão no nome,
 * uma cópia de nome fixo e a chave de assinatura guardada fora do repositório (~/.techsoft/).
 *
 * Uso: node scripts/build-apk.mjs [--debug]        (npm run build:apk)
 *   --debug  gera um APK de teste (depurável), em apk/iasd-706-sul-<versão>-debug.apk, sem mexer nos demais
 *
 * Versão: vem do package.json. O versionCode segue a conta major*10000 + minor*100 + patch (1.0.0 -> 10000),
 * então um APK mais novo sempre atualiza o instalado.
 *
 * Pré-requisitos: JDK 21 e Android SDK. Usa ~/android-tools/jdk-21 e ~/android-tools/android-sdk quando existem;
 * senão, JAVA_HOME e ANDROID_HOME.
 *
 * Resultado: apk/iasd-706-sul-<versão>.apk (nome com a versão, para guardar e enviar) e apk/iasd-706-sul.apk
 * (nome fixo, a mesma cópia). Em apk/ fica só o APK da versão atual; os antigos continuam no histórico do Git.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = join(root, 'android')
const apkDir = join(root, 'apk')
const windows = platform() === 'win32'
const debug = process.argv.includes('--debug')

const NOME = 'iasd-706-sul'
const ALIAS = 'iasd706sul'

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const [major, minor, patch] = version.split('.').map(Number)
const versionCode = major * 10000 + minor * 100 + patch

const tools = join(homedir(), 'android-tools')
const javaHome = existsSync(join(tools, 'jdk-21')) ? join(tools, 'jdk-21') : process.env.JAVA_HOME
const sdk = existsSync(join(tools, 'android-sdk')) ? join(tools, 'android-sdk') : process.env.ANDROID_HOME
if (!javaHome || !sdk) {
  console.error('Faltam o JDK 21 e o Android SDK (veja o cabeçalho deste arquivo).')
  process.exit(1)
}

const nomes = { versionado: `${NOME}-${version}${debug ? '-debug' : ''}.apk`, ultimo: `${NOME}.apk` }

function run(command, args, options = {}) {
  console.log(`> ${command.split(/[\\/]/).pop()} ${args.slice(0, 3).join(' ')} ...`)
  return execFileSync(command, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options })
}

/** Chave de assinatura fora do repositório (~/.techsoft). Criada na primeira vez, com senha aleatória. */
function signingKey() {
  const dir = join(homedir(), '.techsoft')
  const keystore = join(dir, 'iasd706sul.keystore')
  const passwordFile = `${keystore}.senha`
  if (!existsSync(keystore)) {
    mkdirSync(dir, { recursive: true })
    const password = randomBytes(12).toString('hex')
    writeFileSync(passwordFile, password)
    run(join(javaHome, 'bin', windows ? 'keytool.exe' : 'keytool'), [
      '-genkeypair', '-keystore', keystore, '-alias', ALIAS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
      '-storepass', password, '-keypass', password, '-dname', 'CN=IASD 706 Sul, O=Techsoft, C=BR',
    ])
    console.log(`Chave de assinatura criada em ${keystore} (guarde-a: sem ela não dá para atualizar o app já instalado).`)
  }
  return { keystore, password: readFileSync(passwordFile, 'utf8').trim() }
}

const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, Path: `${join(javaHome, 'bin')};${process.env.Path ?? process.env.PATH ?? ''}` }

// 1. Site (tsc + vite) e cópia para o projeto Android
run(windows ? 'npm.cmd' : 'npm', ['run', 'cap:sync'], { cwd: root, env, shell: windows })

// 2. Gradle (release assinado ou debug)
const key = debug ? undefined : signingKey()
const gradleEnv = key ? { ...env, APK_KEYSTORE: key.keystore, APK_STORE_PASSWORD: key.password, APK_KEY_ALIAS: ALIAS } : env
const args = [debug ? 'assembleDebug' : 'assembleRelease', `-PappVersionCode=${versionCode}`, `-PappVersionName=${version}`]
if (windows) run('cmd.exe', ['/c', '.\\gradlew.bat', ...args], { cwd: androidDir, env: gradleEnv })
else run('./gradlew', args, { cwd: androidDir, env: gradleEnv })

// 3. Arquivos em apk/
const saida = join(androidDir, 'app', 'build', 'outputs', 'apk', debug ? 'debug' : 'release', debug ? 'app-debug.apk' : 'app-release.apk')
if (!existsSync(saida)) {
  console.error(`APK não encontrado em ${saida}`)
  process.exit(1)
}
mkdirSync(apkDir, { recursive: true })
copyFileSync(saida, join(apkDir, nomes.versionado))
if (!debug) {
  copyFileSync(saida, join(apkDir, nomes.ultimo))
  // deixa só o APK da versão atual (e tira o antigo de teste, de antes deste script)
  for (const nome of readdirSync(apkDir)) {
    if ((/^iasd-706-sul-\d+\.\d+\.\d+\.apk$/.test(nome) && nome !== nomes.versionado) || nome === 'IASD706Sul-debug.apk') rmSync(join(apkDir, nome))
  }
}

// 4. Confere assinatura e versão do que foi gerado
const buildTools = join(sdk, 'build-tools')
const maisNova = readdirSync(buildTools).sort().at(-1)
const apk = join(apkDir, nomes.versionado)
if (!debug) {
  const signer = join(buildTools, maisNova, windows ? 'apksigner.bat' : 'apksigner')
  if (windows) run('cmd.exe', ['/c', signer, 'verify', '--print-certs', apk], { env })
  else run(signer, ['verify', '--print-certs', apk], { env })
}
console.log(`\nAPK ${debug ? 'de teste ' : ''}pronto: apk/${nomes.versionado}${debug ? '' : ` (e apk/${nomes.ultimo})`} — versão ${version}, versionCode ${versionCode}`)
