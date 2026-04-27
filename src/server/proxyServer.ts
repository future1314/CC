/**
 * Proxy Server — 本地代理服务器，将 Anthropic API 请求转换为第三方模型格式
 */

import { handleProxyRequest } from './proxy/handler.js'
import http from 'node:http'

const DEFAULT_PORT = 3456

let server: http.Server | null = null
let serverStarting: Promise<number> | null = null

function getPort(): number {
  const envPort = parseInt(process.env.CLAUDE_PROXY_PORT || '', 10)
  return Number.isNaN(envPort) ? DEFAULT_PORT : envPort
}

/**
 * 检查 Proxy Server 是否正在运行
 */
export function isProxyServerRunning(): boolean {
  return server !== null
}

/**
 * 确保 Proxy Server 运行，如果未运行则启动它
 * 这是异步的，会等待服务器启动完成
 */
export async function ensureProxyServer(): Promise<number> {
  // 如果已经在运行，直接返回
  if (server) {
    return getPort()
  }

  // 如果正在启动，等待它完成
  if (serverStarting) {
    return serverStarting
  }

  // 启动服务器
  serverStarting = startProxyServer()
  return serverStarting
}

/**
 * 启动代理服务器
 */
export async function startProxyServer(): Promise<number> {
  const PORT = getPort()
  if (server) {
    console.log('[Proxy Server] Already running on port', PORT)
    return PORT
  }

  const handler: http.RequestListener = async (req, res) => {
    try {
      // Build a Web API Request from Node.js IncomingMessage
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk))
      }
      const body = Buffer.concat(chunks)

      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)

      const webRequest = new Request(url, {
        method: req.method || 'GET',
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]),
        ),
        body: req.method !== 'GET' && req.method !== 'HEAD' && body.length > 0 ? body : undefined,
      })

      const response = await handleProxyRequest(webRequest, url)

      // Write response back
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
      if (response.body) {
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
      }
      res.end()
    } catch (err) {
      console.error('[Proxy Server] Error:', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
      }
      res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Internal proxy error' } }))
    }
  }

  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler)
    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log('[Proxy Server] Port', PORT, 'already in use — assuming another instance is running')
        // Server is effectively running (another instance)
        server = srv as unknown as null
        serverStarting = null
        resolve(PORT)
        return
      }
      serverStarting = null
      reject(err)
    })
    srv.listen(PORT, '127.0.0.1', () => {
      server = srv
      serverStarting = null
      console.log(`[Proxy Server] Started on http://127.0.0.1:${PORT}`)
      console.log(`[Proxy Server] Accepting Anthropic SDK requests at http://127.0.0.1:${PORT}/v1/messages`)
      resolve(PORT)
    })
  })
}

/**
 * 停止代理服务器
 */
export async function stopProxyServer(): Promise<void> {
  if (!server) return
  return new Promise((resolve) => {
    server!.close(() => {
      server = null
      console.log('[Proxy Server] Stopped')
      resolve()
    })
  })
}

/**
 * 获取代理服务器端口
 */
export function getProxyPort(): number {
  return getPort()
}