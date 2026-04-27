/**
 * Auto-start Proxy Server when CLAUDE_CODE_USE_ADAPTER is set
 *
 * This module ensures that when a third-party provider is activated,
 * the proxy server is automatically started before the CLI makes API calls.
 */

import { isEnvTruthy } from './envUtils.js'
import { startProxyServer, isProxyServerRunning } from '../server/proxyServer.js'

let initialized = false

/**
 * Initialize auto-proxy functionality.
 * Call this early during CLI startup, after environment variables are loaded.
 */
export async function initAutoProxy(): Promise<void> {
  if (initialized) return
  initialized = true

  // If CLAUDE_CODE_USE_ADAPTER is set, auto-start the proxy server
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_ADAPTER)) {
    // Don't wait for it - start in background and let requests queue
    if (!isProxyServerRunning()) {
      console.log('[Auto-Proxy] Third-party provider detected, starting proxy server...')
      startProxyServer()
        .then((port) => {
          console.log(`[Auto-Proxy] Proxy server started on port ${port}`)
        })
        .catch((err) => {
          console.error('[Auto-Proxy] Failed to start proxy server:', err)
        })
    }
  }
}
