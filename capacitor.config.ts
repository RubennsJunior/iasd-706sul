import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Troque pelo identificador definitivo do aplicativo antes de publicar na Play Store.
  appId: 'br.com.igrejasda.app',
  appName: 'IASD 706 Sul',
  webDir: 'dist',
  backgroundColor: '#0a2468',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0a2468',
      showSpinner: false,
    },
  },
}

export default config
