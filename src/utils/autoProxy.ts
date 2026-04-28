/**
 * Auto-start Proxy Server for third-party model support
 *
 * This module ensures that when a third-party provider is configured,
 * the proxy server is automatically started before the CLI makes API calls.
 *
 * The proxy server is always auto-started because:
 * 1. It only uses a local port (3456)
 * 2. It only intercepts requests when CLAUDE_CODE_USE_ADAPTER=1
 * 3. It's lightweight and doesn't interfere with normal operation
 */

import { isEnvTruthy } from './envUtils.js'
import { startProxyServer, isProxyServerRunning } from '../server/proxyServer.js'
import { getSettingsForSource } from './settings/settings.js'

let initialized = false

/**
 * Initialize auto-proxy functionality.
 * Call this early during CLI startup, after environment variables are loaded.
 */
export async function initAutoProxy(): Promise<void> {
  if (initialized) return
  initialized = true

  // Check if third-party provider is configured in settings.json
  const userSettings = getSettingsForSource('userSettings')
  const settingsEnv = userSettings?.env
  const hasAdapterConfig = settingsEnv?.CLAUDE_CODE_USE_ADAPTER === '1'
  const hasBaseUrl = !!settingsEnv?.ANTHROPIC_BASE_URL

  // If settings.json has adapter config, apply it to process.env first
  if (hasAdapterConfig && hasBaseUrl) {
    if (!process.env.CLAUDE_CODE_USE_ADAPTER) {
      console.log('[Auto-Proxy] Detected third-party provider config in settings.json')
      process.env.CLAUDE_CODE_USE_ADAPTER = settingsEnv.CLAUDE_CODE_USE_ADAPTER
      process.env.ANTHROPIC_BASE_URL = settingsEnv.ANTHROPIC_BASE_URL
      if (settingsEnv.ANTHROPIC_AUTH_TOKEN) {
        process.env.ANTHROPIC_AUTH_TOKEN = settingsEnv.ANTHROPIC_AUTH_TOKEN
      }
      if (settingsEnv.ANTHROPIC_MODEL) {
        process.env.ANTHROPIC_MODEL = settingsEnv.ANTHROPIC_MODEL
      }
    }
  }

  // Always start proxy server if not running
  // It will only intercept requests when CLAUDE_CODE_USE_ADAPTER=1
  if (!isProxyServerRunning()) {
    console.log('[Auto-Proxy] Starting proxy server for third-party model support...')
    startProxyServer()
      .then((port) => {
        console.log(`[Auto-Proxy] Proxy server ready on port ${port}`)
      })
      .catch((err) => {
        console.error('[Auto-Proxy] Failed to start proxy server:', err)
      })
  } else {
    console.log('[Auto-Proxy] Proxy server already running')
  }
}
