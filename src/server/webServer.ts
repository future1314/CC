/**
 * Web Management Server
 *
 * Serves a Chrome browser-based management page for:
 * - Provider configuration (add, edit, delete)
 * - Provider activation/deactivation
 * - Model selection per provider
 * - Current status monitoring
 *
 * REST API base: http://127.0.0.1:{PORT}/api
 * Management UI: http://127.0.0.1:{PORT}/
 */

import { adapterService } from '../services/adapterService.js'
import { getThirdPartyProviders } from '../utils/model/third-party.js'
import { getChinaConfig } from '../utils/china-config.js'
import * as fs from 'fs'
import * as path from 'path'

const PORT = 3457

let server_: ReturnType<typeof import('node:http').createServer> | null = null

// ─── JSON helpers ─────────────────────────────────────────────

function json(res: import('node:http').ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(data, null, 2))
}

function text(res: import('node:http').ServerResponse, body: string, status = 200, contentType = 'text/html; charset=utf-8'): void {
  res.writeHead(status, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}

async function bodyJson(req: import('node:http').IncomingMessage): Promise<Record<string, unknown> | null> {
  try {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk))
    }
    if (chunks.length === 0) return null
    return JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    return null
  }
}

function getPathSegments(url: string): string[] {
  return url.split('/').filter(Boolean)
}

// ─── Provider Connection Test ─────────────────────────────────

async function testProviderConnection(provider: {
  name: string
  baseUrl: string
  apiKey: string
  apiFormat: string
  models: { main: string }
}): Promise<{ ok: boolean; latencyMs: number; error?: string; detail?: string }> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')
  const apiKey = provider.apiKey
  const apiFormat = provider.apiFormat || 'anthropic'
  const model = provider.models?.main || 'default'
  const start = Date.now()

  try {
    if (apiFormat === 'ollama') {
      // Ollama: GET /api/tags (lists available models)
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) {
        return { ok: false, latencyMs, error: `HTTP ${res.status}`, detail: 'Ollama 服务不可达' }
      }
      const body = await res.json() as { models?: Array<{ name: string }> }
      const modelNames = (body.models || []).map(m => m.name).slice(0, 5).join(', ')
      return {
        ok: true,
        latencyMs,
        detail: `Ollama 已连接，可用模型: ${modelNames || '(无)'}`
      }
    } else if (apiFormat === 'anthropic') {
      // Anthropic-compatible: POST /v1/messages (simple test)
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return { ok: false, latencyMs, error: `HTTP ${res.status}`, detail: errText.slice(0, 300) }
      }
      const body = await res.json() as { model?: string }
      return { ok: true, latencyMs, detail: `端点正常，返回模型: ${body.model || model}` }
    } else {
      // OpenAI Chat format: POST /v1/chat/completions
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return { ok: false, latencyMs, error: `HTTP ${res.status}`, detail: errText.slice(0, 300) }
      }
      const body = await res.json() as { model?: string }
      return { ok: true, latencyMs, detail: `端点正常，返回模型: ${body.model || model}` }
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return { ok: false, latencyMs, error: '连接超时', detail: '请检查端点地址和网络连接' }
    }
    return { ok: false, latencyMs, error: '连接失败', detail: msg.slice(0, 300) }
  }
}

// ─── API Router ───────────────────────────────────────────────

async function handleApi(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, method: string, pathname: string): Promise<boolean> {
  const segs = getPathSegments(pathname)

  // GET /api/status — overall status
  if (method === 'GET' && segs[0] === 'status') {
    const [providerStatus, chinaConfig] = await Promise.all([
      adapterService.checkAuthStatus(),
      Promise.resolve(getChinaConfig()),
    ])
    return json(res, { china: chinaConfig, auth: providerStatus, proxyPort: 3456, webPort: PORT }), true
  }

  // GET /api/providers — list all providers
  if (method === 'GET' && segs[0] === 'providers' && segs.length === 1) {
    const ui = await adapterService.getConfigForUI()
    const presets = getThirdPartyProviders()
    return json(res, {
      saved: ui.providers,
      activeId: ui.activeId,
      presets: Object.entries(presets).map(([id, cfg]) => ({
        id: `preset-${id}`,
        name: cfg.name,
        baseUrl: cfg.baseUrl,
        defaultModel: cfg.defaultModel,
        models: cfg.models,
      })),
    }), true
  }

  // POST /api/providers — add a new provider
  if (method === 'POST' && segs[0] === 'providers' && segs.length === 1) {
    const data = await bodyJson(req)
    if (!data?.name || !data?.baseUrl) {
      return json(res, { error: 'name and baseUrl are required' }, 400), true
    }
    try {
      const models = data.models as Record<string, unknown> || {}
      const provider = await adapterService.addProvider({
        name: String(data.name),
        baseUrl: String(data.baseUrl),
        apiKey: String(data.apiKey || ''),
        apiFormat: (data.apiFormat as string) || 'anthropic',
        models: {
          main: String(models.main || data.mainModel || ''),
          ...(models.haiku || data.haikuModel ? { haiku: String(models.haiku || data.haikuModel || '') } : {}),
          ...(models.sonnet || data.sonnetModel ? { sonnet: String(models.sonnet || data.sonnetModel || '') } : {}),
          ...(models.opus || data.opusModel ? { opus: String(models.opus || data.opusModel || '') } : {}),
        },
        notes: data.notes ? String(data.notes) : undefined,
      })
      return json(res, provider, 201), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // GET /api/providers/:id — get single provider
  if (method === 'GET' && segs[0] === 'providers' && segs.length === 2) {
    try {
      const provider = await adapterService.getProvider(segs[1])
      // Mask API key in response for security
      const masked = { ...provider, apiKey: provider.apiKey ? '****' + provider.apiKey.slice(-4) : '' }
      return json(res, masked), true
    } catch {
      return json(res, { error: 'Not found' }, 404), true
    }
  }

  // PUT /api/providers/:id — update a provider
  if (method === 'PUT' && segs[0] === 'providers' && segs.length === 2) {
    const data = await bodyJson(req)
    if (!data) return json(res, { error: 'Invalid JSON' }, 400), true
    try {
      const models = data.models as Record<string, unknown> || {}
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = String(data.name)
      if (data.baseUrl !== undefined) updateData.baseUrl = String(data.baseUrl)
      if (data.apiKey !== undefined) updateData.apiKey = String(data.apiKey)
      if (data.apiFormat !== undefined) updateData.apiFormat = data.apiFormat
      if (data.notes !== undefined) updateData.notes = String(data.notes)
      if (data.models !== undefined || data.mainModel !== undefined) {
        const mergedModels: Record<string, string> = {}
        if (data.models && typeof data.models === 'object') Object.assign(mergedModels, data.models)
        if (data.mainModel !== undefined) mergedModels.main = String(data.mainModel)
        if (data.haikuModel !== undefined) mergedModels.haiku = String(data.haikuModel)
        if (data.sonnetModel !== undefined) mergedModels.sonnet = String(data.sonnetModel)
        if (data.opusModel !== undefined) mergedModels.opus = String(data.opusModel)
        updateData.models = mergedModels
      }
      const updated = await adapterService.updateProvider(segs[1], updateData as any)
      return json(res, updated), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // DELETE /api/providers/:id
  if (method === 'DELETE' && segs[0] === 'providers' && segs.length === 2) {
    try {
      await adapterService.deleteProvider(segs[1])
      return json(res, { ok: true }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // POST /api/providers/:id/activate
  if (method === 'POST' && segs.length === 3 && segs[0] === 'providers' && segs[2] === 'activate') {
    try {
      await adapterService.activateProvider(segs[1])
      return json(res, { ok: true, active: segs[1] }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // POST /api/providers/:id/test — verify provider configuration
  if (method === 'POST' && segs.length === 3 && segs[0] === 'providers' && segs[2] === 'test') {
    try {
      const provider = await adapterService.getProvider(segs[1])
      const result = await testProviderConnection(provider)
      return json(res, result), true
    } catch (err) {
      return json(res, { ok: false, error: (err as Error).message }, 400), true
    }
  }

  // POST /api/providers/:id/copy — clone a provider
  if (method === 'POST' && segs.length === 3 && segs[0] === 'providers' && segs[2] === 'copy') {
    try {
      const data = await bodyJson(req)
      const copy = await adapterService.copyProvider(segs[1], data?.name as string | undefined)
      return json(res, copy, 201), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // POST /api/providers/:id/trash — soft-delete (move to recycle bin)
  if (method === 'POST' && segs.length === 3 && segs[0] === 'providers' && segs[2] === 'trash') {
    try {
      await adapterService.deleteProvider(segs[1])
      return json(res, { ok: true }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // GET /api/trash — list trashed providers
  if (method === 'GET' && segs[0] === 'trash' && segs.length === 1) {
    try {
      const trash = await adapterService.listTrash()
      return json(res, trash.map(t => ({
        id: t.provider.id,
        name: t.provider.name,
        baseUrl: t.provider.baseUrl,
        apiFormat: t.provider.apiFormat,
        deletedAt: t.deletedAt,
      }))), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 500), true
    }
  }

  // POST /api/trash/:id/restore — restore from trash
  if (method === 'POST' && segs.length === 3 && segs[0] === 'trash' && segs[2] === 'restore') {
    try {
      const restored = await adapterService.restoreProvider(segs[1])
      return json(res, restored), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // DELETE /api/trash/:id — permanently delete
  if (method === 'DELETE' && segs.length === 2 && segs[0] === 'trash') {
    try {
      await adapterService.permanentlyDeleteFromTrash(segs[1])
      return json(res, { ok: true }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // POST /api/providers/deactivate
  if (method === 'POST' && segs[0] === 'providers' && segs[1] === 'deactivate') {
    try {
      await adapterService.activateOfficial()
      return json(res, { ok: true }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 400), true
    }
  }

  // POST /api/proxy/start — start proxy server
  if (method === 'POST' && segs[0] === 'proxy' && segs[1] === 'start') {
    try {
      const { startProxyServer } = await import('./proxyServer.js')
      await startProxyServer()
      return json(res, { ok: true, port: 3456 }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 500), true
    }
  }

  // POST /api/proxy/stop — stop proxy server
  if (method === 'POST' && segs[0] === 'proxy' && segs[1] === 'stop') {
    try {
      const { stopProxyServer } = await import('./proxyServer.js')
      await stopProxyServer()
      return json(res, { ok: true }), true
    } catch (err) {
      return json(res, { error: (err as Error).message }, 500), true
    }
  }

  // GET /api/models — all available models
  if (method === 'GET' && segs[0] === 'models') {
    const { getAllThirdPartyModels } = await import('../utils/model/third-party.js')
    return json(res, getAllThirdPartyModels()), true
  }

  // GET /api/env — current environment variables relevant to model config
  if (method === 'GET' && segs[0] === 'env') {
    const keys = [
      'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL', 'ANTHROPIC_AUTH_TOKEN',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'CLAUDE_CODE_USE_ADAPTER', 'CLAUDE_CODE_CHINA_MODE',
    ]
    const env: Record<string, string | undefined> = {}
    for (const k of keys) env[k] = process.env[k] || undefined
    return json(res, env), true
  }

  return false // not an API route
}

// ─── Static HTML for Management UI ─────────────────────────────

function getManagementPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code - 模型管理</title>
<style>
:root {
  --bg: #1a1a2e; --fg: #e0e0e0; --card: #16213e; --accent: #0f3460;
  --border: #334155; --green: #22c55e; --red: #ef4444;
  --yellow: #eab308; --blue: #3b82f6; --muted: #94a3b8; --pink: #ec4899;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; }
header { background: var(--card); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
header h1 { font-size: 18px; font-weight: 600; white-space: nowrap; }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.status-dot.active { background: var(--green); }
.status-dot.inactive { background: var(--red); }
main { max-width: 1200px; margin: 0 auto; padding: 24px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.card h2 { font-size: 16px; margin-bottom: 16px; color: var(--green); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 14px; background: var(--accent); color: var(--fg); transition: all .15s; white-space: nowrap; }
.btn:hover { opacity: 0.85; }
.btn-primary { background: var(--blue); border-color: var(--blue); color: white; }
.btn-success { background: var(--green); border-color: var(--green); color: white; }
.btn-danger { background: var(--red); border-color: var(--red); color: white; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.provider-card { background: var(--card); border: 2px solid var(--border); border-radius: 8px; padding: 16px; }
.provider-card.active { border-color: var(--green); }
.provider-card h3 { font-size: 15px; margin-bottom: 8px; word-break: break-all; }
.provider-card .meta { font-size: 12px; color: var(--muted); margin-bottom: 6px; word-break: break-all; }
.provider-card .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge-active { background: var(--green); color: white; }
.badge-inactive { background: var(--muted); color: var(--bg); }
input, select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--fg); font-size: 14px; margin-bottom: 10px; }
input:focus, select:focus { outline: none; border-color: var(--blue); }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; margin-bottom: 4px; font-size: 13px; color: var(--muted); }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,.6); z-index: 1000; display: none; align-items: center; justify-content: center; }
.modal-overlay.show { display: flex; }
.modal-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; min-width: 360px; max-width: 520px; width: 90%; }
.modal-box h2 { margin-bottom: 16px; color: var(--green); }
.modal-box .btn-row { display: flex; gap: 8px; margin-top: 16px; }
#toast { position: fixed; top: 20px; right: 20px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; }
.toast-item { padding: 12px 20px; border-radius: 8px; font-size: 14px; max-width: 400px; animation: slideIn .3s ease; }
.toast-item.error { background: var(--red); color: white; }
.toast-item.success { background: var(--green); color: white; }
.toast-item.info { background: var(--blue); color: white; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
</style>
</head>
<body>
<header>
  <div>
    <span class="status-dot inactive" id="statusDot"></span>
    <h1 style="display:inline">Claude Code 模型管理</h1>
  </div>
  <div>
    <span id="activeProviderDisplay" style="margin-right:16px;font-size:13px;color:var(--muted)"></span>
    <button class="btn btn-primary" id="btnAddProvider">+ 添加提供商</button>
  </div>
</header>

<main>
  <section id="chinaSection" class="card" style="display:none">
    <h2>🇨🇳 中国大陆模式</h2>
    <div id="chinaStatus"></div>
  </section>

  <section class="card">
    <h2>📦 已配置的模型提供商</h2>
    <div class="grid" id="providerGrid"></div>
    <div id="noProviders" style="color:var(--muted);margin-top:12px;display:none">
      暂未配置第三方提供商。点击「添加提供商」开始。
    </div>
  </section>

  <section class="card">
    <h2>🔧 快捷操作</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn" id="btnStartProxy">🔄 启动代理服务器</button>
      <button class="btn btn-danger" id="btnStopProxy">⏹ 停止代理服务器</button>
      <button class="btn" id="btnSwitchOfficial">🏢 切换回官方 Anthropic</button>
      <button class="btn" id="btnRefresh">🔄 刷新</button>
    </div>
    <div id="proxyStatus" style="margin-top:8px;font-size:13px;color:var(--muted)"></div>
  </section>

  <section class="card" id="trashSection" style="display:none">
    <h2>🗑 回收站</h2>
    <div class="grid" id="trashGrid"></div>
  </section>

  <section class="card">
    <h2>📋 预设提供商</h2>
    <div class="grid" id="presetGrid"></div>
  </section>
</main>

<!-- Provider Modal (used for both add and edit) -->
<div class="modal-overlay" id="modalForm">
  <div class="modal-box">
    <h2 id="modalTitle">添加模型提供商</h2>
    <input type="hidden" id="formEditId" value="">
    <div class="form-group">
      <label>名称 *</label>
      <input id="formName" placeholder="例如: My Ollama">
    </div>
    <div class="form-group">
      <label>API 端点 *</label>
      <input id="formBaseUrl" placeholder="例如: http://localhost:11434">
    </div>
    <div class="form-group">
      <label>API 密钥 <span id="formApiKeyHint" style="color:var(--muted);font-size:11px"></span></label>
      <input id="formApiKey" placeholder="如不需要可留空">
    </div>
    <div class="form-group">
      <label>API 格式</label>
      <select id="formFormat">
        <option value="anthropic">Anthropic 兼容</option>
        <option value="openai_chat">OpenAI Chat Completions</option>
        <option value="openai_responses">OpenAI Responses</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>
    <div class="form-group">
      <label>主模型</label>
      <input id="formMainModel" placeholder="例如: qwen2.5:latest">
    </div>
    <div class="form-group">
      <label>Haiku 模型 (可选)</label>
      <input id="formHaikuModel" placeholder="快速模型，如 qwen2.5:3b">
    </div>
    <div class="form-group">
      <label>Sonnet 模型 (可选)</label>
      <input id="formSonnetModel" placeholder="日用模型">
    </div>
    <div class="form-group">
      <label>Opus 模型 (可选)</label>
      <input id="formOpusModel" placeholder="最强模型">
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnConfirmForm">确认</button>
      <button class="btn" id="btnCancelForm">取消</button>
    </div>
  </div>
</div>

<!-- Toast container -->
<div id="toast"></div>

<script>
(function() {
  'use strict';
  var API = '/api';
  var PROXY_PORT = 3456;

  function el(id) { return document.getElementById(id); }

  // ─── Toast ────────────────────────────────
  function toast(msg, type) {
    type = type || 'info';
    var container = el('toast');
    var div = document.createElement('div');
    div.className = 'toast-item ' + type;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(function() {
      div.style.opacity = '0';
      div.style.transition = 'opacity .3s';
      setTimeout(function() { container.removeChild(div); }, 300);
    }, 3000);
  }

  // ─── API helper ───────────────────────────
  function callApi(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      method: opts.method || 'GET',
      body: opts.body || undefined
    }).then(function(r) { return r.json(); });
  }

  // ─── Loaders ──────────────────────────────
  function loadAll() {
    loadStatus();
    loadProviders();
    loadPresets();
    loadTrash();
  }

  function loadStatus() {
    callApi('/status').then(function(s) {
      if (s.china && s.china.enabled) {
        el('chinaSection').style.display = 'block';
        el('chinaStatus').innerHTML = '<p style="color:var(--green)">中国大陆网络环境已检测到，已启用国内镜像端点</p>';
      }
      el('statusDot').className = 'status-dot ' + (s.auth && s.auth.hasAuth ? 'active' : 'inactive');
      el('activeProviderDisplay').textContent = (s.auth && s.auth.activeProvider)
        ? '当前: ' + s.auth.activeProvider : '当前: Anthropic 官方';
    }).catch(function(e) { console.error('loadStatus:', e); });
  }

  function loadProviders() {
    callApi('/providers').then(function(data) {
      var grid = el('providerGrid');
      grid.innerHTML = '';
      if (!data.saved || !data.saved.length) {
        el('noProviders').style.display = 'block';
        return;
      }
      el('noProviders').style.display = 'none';
      data.saved.forEach(function(p) {
        var isActive = p.id === data.activeId;
        var card = document.createElement('div');
        card.className = 'provider-card' + (isActive ? ' active' : '');
        var modelsExtra = [];
        if (p.models && p.models.haiku) modelsExtra.push('Haiku: ' + esc(p.models.haiku));
        if (p.models && p.models.sonnet) modelsExtra.push('Sonnet: ' + esc(p.models.sonnet));
        if (p.models && p.models.opus) modelsExtra.push('Opus: ' + esc(p.models.opus));
        card.innerHTML =
          '<h3>' + esc(p.name) + ' <span class="badge badge-' + (isActive ? 'active' : 'inactive') + '">' + (isActive ? '活跃' : '离线') + '</span></h3>' +
          '<div class="meta">端点: ' + esc(p.baseUrl) + '</div>' +
          '<div class="meta">格式: ' + esc(p.apiFormat || 'anthropic') + '</div>' +
          '<div class="meta">主模型: ' + esc(p.models && p.models.main || '未设置') + '</div>' +
          (modelsExtra.length ? '<div class="meta">' + modelsExtra.join(' · ') + '</div>' : '') +
          '<div class="actions">' +
          '<button class="btn btn-sm hk-test" data-id="' + esc(p.id) + '" style="background:var(--pink);border-color:var(--pink);color:#fff">测试</button> ' +
          (!isActive ? '<button class="btn btn-primary btn-sm hk-activate" data-id="' + esc(p.id) + '">激活</button> ' : '') +
          '<button class="btn btn-sm hk-edit" data-id="' + esc(p.id) + '" style="background:var(--yellow);border-color:var(--yellow);color:#000">编辑</button> ' +
          '<button class="btn btn-sm hk-copy" data-id="' + esc(p.id) + '" style="background:var(--blue);border-color:var(--blue);color:#fff">复制</button> ' +
          '<button class="btn btn-danger btn-sm hk-trash" data-id="' + esc(p.id) + '">删除</button>' +
          '</div>' +
          '<div class="test-result" id="test-' + esc(p.id) + '" style="margin-top:8px;font-size:12px;display:none"></div>';
        grid.appendChild(card);
      });
      // Bind buttons
      grid.querySelectorAll('.hk-test').forEach(function(btn) {
        btn.addEventListener('click', function() { testProvider(this.dataset.id, this); });
      });
      grid.querySelectorAll('.hk-activate').forEach(function(btn) {
        btn.addEventListener('click', function() { activateProvider(this.dataset.id); });
      });
      grid.querySelectorAll('.hk-edit').forEach(function(btn) {
        btn.addEventListener('click', function() { openEditModal(this.dataset.id); });
      });
      grid.querySelectorAll('.hk-copy').forEach(function(btn) {
        btn.addEventListener('click', function() { copyProvider(this.dataset.id); });
      });
      grid.querySelectorAll('.hk-trash').forEach(function(btn) {
        btn.addEventListener('click', function() { trashProvider(this.dataset.id); });
      });
    }).catch(function(e) { console.error('loadProviders:', e); });
  }

  function loadPresets() {
    callApi('/providers').then(function(data) {
      var grid = el('presetGrid');
      grid.innerHTML = '';
      if (!data.presets || !data.presets.length) return;
      data.presets.forEach(function(p) {
        var models = p.models && p.models.length ? p.models.map(function(m) { return m.name; }).join(', ') : '无';
        var card = document.createElement('div');
        card.className = 'provider-card';
        card.innerHTML =
          '<h3>' + esc(p.name) + '</h3>' +
          '<div class="meta">端点: ' + esc(p.baseUrl) + '</div>' +
          '<div class="meta">默认模型: ' + esc(p.defaultModel || '未知') + '</div>' +
          '<div class="meta">可用模型: ' + esc(models) + '</div>';
        grid.appendChild(card);
      });
    }).catch(function(e) { console.error('loadPresets:', e); });
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Actions ──────────────────────────────
  function activateProvider(id) {
    callApi('/providers/' + encodeURIComponent(id) + '/activate', { method: 'POST' }).then(function(r) {
      if (r.ok) toast('提供商已激活', 'success');
      else toast('激活失败: ' + (r.error || ''), 'error');
      loadAll();
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  function testProvider(id, btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = '测试中...';
    var resultEl = el('test-' + id);
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<span style="color:var(--muted)">⏳ 正在测试连接...</span>';

    callApi('/providers/' + encodeURIComponent(id) + '/test', { method: 'POST' }).then(function(r) {
      btnEl.disabled = false;
      btnEl.textContent = '测试';
      if (r.ok) {
        resultEl.innerHTML = '<span style="color:var(--green)">✓ 测试通过</span> ' +
          '<span style="color:var(--muted)">(' + r.latencyMs + 'ms)</span> ' +
          '<span style="color:var(--muted)">' + esc(r.detail || '') + '</span>';
        toast('测试通过: ' + (r.detail || '连接正常'), 'success');
      } else {
        resultEl.innerHTML = '<span style="color:var(--red)">✗ 测试失败</span> ' +
          '<span style="color:var(--muted)">(' + r.latencyMs + 'ms)</span> ' +
          '<span style="color:var(--red)">' + esc(r.error || '') + '</span>' +
          (r.detail ? '<br><span style="color:var(--muted);font-size:11px">' + esc(r.detail) + '</span>' : '');
        toast('测试失败: ' + (r.error || '未知错误'), 'error');
      }
    }).catch(function(e) {
      btnEl.disabled = false;
      btnEl.textContent = '测试';
      resultEl.innerHTML = '<span style="color:var(--red)">✗ 网络错误: ' + esc(e.message) + '</span>';
      toast('网络错误: ' + e.message, 'error');
    });
  }

  // ─── Copy ──────────────────────────────────
  function copyProvider(id) {
    callApi('/providers/' + encodeURIComponent(id) + '/copy', { method: 'POST' }).then(function(r) {
      if (r.error) { toast('复制失败: ' + r.error, 'error'); return; }
      toast('已复制: ' + r.name, 'success');
      loadAll();
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  // ─── Trash (soft delete) ────────────────────
  function trashProvider(id) {
    if (!confirm('确认删除此提供商? 将移到回收站，可以恢复。')) return;
    callApi('/providers/' + encodeURIComponent(id) + '/trash', { method: 'POST' }).then(function(r) {
      if (r.ok) toast('已移到回收站', 'info');
      else toast('删除失败: ' + (r.error || ''), 'error');
      loadAll();
      loadTrash();
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  function restoreProvider(id) {
    callApi('/trash/' + encodeURIComponent(id) + '/restore', { method: 'POST' }).then(function(r) {
      if (r.error) { toast('还原失败: ' + r.error, 'error'); return; }
      toast('已还原: ' + r.name, 'success');
      loadAll();
      loadTrash();
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  function permanentDelete(id) {
    if (!confirm('⚠ 此操作不可恢复！确认彻底删除?')) return;
    callApi('/trash/' + encodeURIComponent(id), { method: 'DELETE' }).then(function(r) {
      if (r.ok) toast('已彻底删除', 'info');
      else toast('删除失败: ' + (r.error || ''), 'error');
      loadTrash();
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  function loadTrash() {
    callApi('/trash').then(function(trash) {
      var section = el('trashSection');
      var grid = el('trashGrid');
      if (!trash.length) {
        section.style.display = 'none';
        return;
      }
      section.style.display = 'block';
      grid.innerHTML = '';
      trash.forEach(function(t) {
        var ago = Math.round((Date.now() - t.deletedAt) / 60000);
        var card = document.createElement('div');
        card.className = 'provider-card';
        card.style.borderColor = 'var(--red)';
        card.innerHTML =
          '<h3 style="color:var(--red)">' + esc(t.name) + '</h3>' +
          '<div class="meta">端点: ' + esc(t.baseUrl) + '</div>' +
          '<div class="meta">格式: ' + esc(t.apiFormat || 'anthropic') + '</div>' +
          '<div class="meta">删除于: ' + ago + ' 分钟前</div>' +
          '<div class="actions">' +
          '<button class="btn btn-sm hk-restore" data-id="' + esc(t.id) + '" style="background:var(--green);border-color:var(--green);color:#fff">还原</button> ' +
          '<button class="btn btn-danger btn-sm hk-perm-delete" data-id="' + esc(t.id) + '">彻底删除</button>' +
          '</div>';
        grid.appendChild(card);
      });
      grid.querySelectorAll('.hk-restore').forEach(function(btn) {
        btn.addEventListener('click', function() { restoreProvider(this.dataset.id); });
      });
      grid.querySelectorAll('.hk-perm-delete').forEach(function(btn) {
        btn.addEventListener('click', function() { permanentDelete(this.dataset.id); });
      });
    }).catch(function(e) { console.error('loadTrash:', e); });
  }

  // Legacy alias kept for compatibility
  function deleteProvider(id) {
    trashProvider(id);
  }

  function switchToOfficial() {
    callApi('/providers/deactivate', { method: 'POST' }).then(function(r) {
      if (r.ok) toast('已切换回官方 Anthropic API', 'success');
      else toast('操作失败: ' + (r.error || ''), 'error');
      loadAll();
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  // ─── Add/Edit Provider Form ────────────────
  function openAddModal() {
    el('formEditId').value = '';
    el('modalTitle').textContent = '添加模型提供商';
    el('formName').value = '';
    el('formBaseUrl').value = '';
    el('formApiKey').value = '';
    el('formApiKeyHint').textContent = '';
    el('formApiKey').placeholder = '如不需要可留空';
    el('formFormat').value = 'anthropic';
    el('formMainModel').value = '';
    el('formHaikuModel').value = '';
    el('formSonnetModel').value = '';
    el('formOpusModel').value = '';
    el('btnConfirmForm').textContent = '确认添加';
    el('modalForm').classList.add('show');
  }

  function openEditModal(id) {
    // Fetch provider details first
    callApi('/providers/' + encodeURIComponent(id)).then(function(p) {
      if (p.error) { toast('获取提供商信息失败: ' + p.error, 'error'); return; }
      el('formEditId').value = p.id || id;
      el('modalTitle').textContent = '编辑: ' + p.name;
      el('formName').value = p.name || '';
      el('formBaseUrl').value = p.baseUrl || '';
      // API key is masked (****xxxx) — leave empty to keep existing
      el('formApiKey').value = '';
      el('formApiKey').placeholder = p.apiKey ? '已保存 (' + p.apiKey + ')，留空则不修改' : '如不需要可留空';
      el('formApiKeyHint').textContent = p.apiKey ? '(已保存)' : '';
      el('formFormat').value = p.apiFormat || 'anthropic';
      el('formMainModel').value = (p.models && p.models.main) || '';
      el('formHaikuModel').value = (p.models && p.models.haiku) || '';
      el('formSonnetModel').value = (p.models && p.models.sonnet) || '';
      el('formOpusModel').value = (p.models && p.models.opus) || '';
      el('btnConfirmForm').textContent = '保存修改';
      el('modalForm').classList.add('show');
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  function closeFormModal() {
    el('modalForm').classList.remove('show');
  }

  function doSaveProvider() {
    var editId = el('formEditId').value;
    var name = el('formName').value.trim();
    var baseUrl = el('formBaseUrl').value.trim();
    if (!name || !baseUrl) {
      toast('名称和 API 端点不能为空', 'error');
      return;
    }
    var apiKey = el('formApiKey').value.trim();
    var body = {
      name: name,
      baseUrl: baseUrl,
      apiFormat: el('formFormat').value,
      models: {
        main: el('formMainModel').value.trim() || '',
        haiku: el('formHaikuModel').value.trim() || '',
        sonnet: el('formSonnetModel').value.trim() || '',
        opus: el('formOpusModel').value.trim() || ''
      }
    };
    // Edit: only send apiKey if user typed a new one (empty = keep existing)
    // Add: always send apiKey
    if (editId) {
      if (apiKey) body.apiKey = apiKey;
    } else {
      body.apiKey = apiKey;
    }

    if (editId) {
      // Update existing provider
      callApi('/providers/' + encodeURIComponent(editId), { method: 'PUT', body: JSON.stringify(body) }).then(function(r) {
        if (r.error) { toast('更新失败: ' + r.error, 'error'); return; }
        toast('已更新: ' + r.name, 'success');
        closeFormModal();
        loadAll();
      }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
    } else {
      // Add new provider
      callApi('/providers', { method: 'POST', body: JSON.stringify(body) }).then(function(r) {
        if (r.error) { toast('添加失败: ' + r.error, 'error'); return; }
        toast('已添加: ' + r.name, 'success');
        closeFormModal();
        loadAll();
      }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
    }
  }

  // ─── Proxy ────────────────────────────────
  function startProxy() {
    callApi('/proxy/start', { method: 'POST' }).then(function(r) {
      if (r.ok) toast('代理服务器已启动，端口: ' + PROXY_PORT, 'success');
      else toast('启动失败: ' + (r.error || ''), 'error');
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }
  function stopProxy() {
    callApi('/proxy/stop', { method: 'POST' }).then(function(r) {
      if (r.ok) toast('代理服务器已停止', 'success');
      else toast('停止失败: ' + (r.error || ''), 'error');
    }).catch(function(e) { toast('网络错误: ' + e.message, 'error'); });
  }

  // ─── Bind events on DOM ready ─────────────
  document.addEventListener('DOMContentLoaded', function() {
    el('btnAddProvider').addEventListener('click', openAddModal);
    el('btnConfirmForm').addEventListener('click', doSaveProvider);
    el('btnCancelForm').addEventListener('click', closeFormModal);
    el('btnStartProxy').addEventListener('click', startProxy);
    el('btnStopProxy').addEventListener('click', stopProxy);
    el('btnSwitchOfficial').addEventListener('click', switchToOfficial);
    el('btnRefresh').addEventListener('click', loadAll);

    // Close modal on overlay click
    el('modalForm').addEventListener('click', function(e) {
      if (e.target === el('modalForm')) closeFormModal();
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && el('modalForm').classList.contains('show')) {
        closeFormModal();
      }
    });

    // Load initial data
    loadAll();
  });
})();
</script>
</body>
</html>`
}

// ─── Main server handler ────────────────────────────────────────

function createHandler() {
  return async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<void> => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const method = req.method || 'GET'
    const pathname = url.pathname

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, method, pathname.replace(/^\/api\//, ''))
      if (handled) return
    }

    // Health check
    if (pathname === '/health') {
      return text(res, JSON.stringify({ status: 'ok', timestamp: Date.now() }), 200, 'application/json')
    }

    // Root — management page
    if (pathname === '/' || pathname === '/index.html') {
      return text(res, getManagementPage())
    }

    // 404
    return text(res, 'Not Found', 404, 'text/plain')
  }
}

// ─── Public API ─────────────────────────────────────────────────

export async function startWebServer(port = PORT): Promise<number> {
  if (server_) {
    console.log('[Web Server] Already running on port', port)
    return port
  }

  const http = await import('node:http')
  const handler = createHandler()

  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler as any)
    let started = false

    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (!started && err.code === 'EADDRINUSE') {
        console.log('[Web Server] Port', port, 'in use, trying', port + 1)
        srv.close()
        startWebServer(port + 1).then(resolve).catch(reject)
        return
      }
      reject(err)
    })

    srv.listen(port, '127.0.0.1', () => {
      started = true
      server_ = srv as any
      console.log(`[Web Server] Management UI available at http://127.0.0.1:${port}/`)
      console.log(`[Web Server] API at http://127.0.0.1:${port}/api/`)
      resolve(port)
    })
  })
}

export async function stopWebServer(): Promise<void> {
  if (!server_) return
  return new Promise((resolve) => {
    server_!.close(() => {
      server_ = null
      console.log('[Web Server] Stopped')
      resolve()
    })
  })
}

export function getWebPort(): number {
  return PORT
}
