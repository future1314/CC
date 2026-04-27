/**
 * Model Provider Adapter Service
 * 管理第三方模型提供商配置
 *
 * 配置文件：~/.claude/claude-code-adapters.json
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

export type ApiFormat = 'anthropic' | 'openai_chat' | 'openai_responses' | 'ollama' | 'minimax' | 'zhipu'

export interface SavedProvider {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  apiFormat: ApiFormat
  models: {
    main: string
    haiku?: string
    sonnet?: string
    opus?: string
  }
  notes?: string
}

export interface TrashEntry {
  provider: SavedProvider
  deletedAt: number
}

export interface ProvidersIndex {
  activeId: string | null
  providers: SavedProvider[]
  trash: TrashEntry[]
}

export interface CreateProviderInput {
  name: string
  apiKey: string
  baseUrl: string
  apiFormat?: ApiFormat
  models: {
    main: string
    haiku?: string
    sonnet?: string
    opus?: string
  }
  notes?: string
}

export interface UpdateProviderInput {
  name?: string
  apiKey?: string
  baseUrl?: string
  apiFormat?: ApiFormat
  models?: {
    main?: string
    haiku?: string
    sonnet?: string
    opus?: string
  }
  notes?: string
}

const MANAGED_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'CLAUDE_CODE_USE_ADAPTER',
] as const

const DEFAULT_INDEX: ProvidersIndex = { activeId: null, providers: [], trash: [] }

class AdapterService {
  private getConfigDir(): string {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  }

  private getIndexPath(): string {
    return path.join(this.getConfigDir(), 'claude-code-adapters.json')
  }

  private async readIndex(): Promise<ProvidersIndex> {
    try {
      const raw = await fs.readFile(this.getIndexPath(), 'utf-8')
      const parsed = JSON.parse(raw) as Partial<ProvidersIndex>
      return {
        activeId: parsed.activeId ?? null,
        providers: parsed.providers ?? [],
        trash: parsed.trash ?? [],
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ...DEFAULT_INDEX, providers: [], trash: [] }
      }
      throw new Error(`Failed to read adapter config: ${err}`)
    }
  }

  private async writeIndex(index: ProvidersIndex): Promise<void> {
    const filePath = this.getIndexPath()
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmpFile = `${filePath}.tmp.${Date.now()}`
    try {
      await fs.writeFile(tmpFile, JSON.stringify(index, null, 2) + '\n', 'utf-8')
      await fs.rename(tmpFile, filePath)
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {})
      throw new Error(`Failed to write adapter config: ${err}`)
    }
  }

  private maskSecret(value: string | undefined): string | undefined {
    if (!value) return value
    if (value.length <= 4) return '****'
    return '****' + value.slice(-4)
  }

  private isMasked(value: string | undefined): boolean {
    return !!value && value.startsWith('****')
  }

  // --- CRUD ---

  async listProviders(): Promise<{ providers: SavedProvider[]; activeId: string | null }> {
    const index = await this.readIndex()
    return { providers: index.providers, activeId: index.activeId }
  }

  async getProvider(id: string): Promise<SavedProvider> {
    const index = await this.readIndex()
    const provider = index.providers.find((p) => p.id === id)
    if (!provider) throw new Error(`Provider not found: ${id}`)
    return provider
  }

  async addProvider(input: CreateProviderInput): Promise<SavedProvider> {
    const index = await this.readIndex()

    const provider: SavedProvider = {
      id: crypto.randomUUID(),
      name: input.name,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      apiFormat: input.apiFormat ?? 'anthropic',
      models: input.models,
      ...(input.notes !== undefined && { notes: input.notes }),
    }

    index.providers.push(provider)
    await this.writeIndex(index)
    return provider
  }

  async updateProvider(id: string, input: UpdateProviderInput): Promise<SavedProvider> {
    const index = await this.readIndex()
    const idx = index.providers.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Provider not found: ${id}`)

    const existing = index.providers[idx]
    const updated: SavedProvider = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.apiKey !== undefined && {
        apiKey: this.isMasked(input.apiKey) ? existing.apiKey : input.apiKey
      }),
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
      ...(input.apiFormat !== undefined && { apiFormat: input.apiFormat }),
      ...(input.models !== undefined && { models: { ...existing.models, ...input.models } }),
      ...(input.notes !== undefined && { notes: input.notes }),
    }

    index.providers[idx] = updated
    await this.writeIndex(index)

    if (index.activeId === id) {
      await this.syncToSettings(updated)
    }

    return updated
  }

  async deleteProvider(id: string): Promise<void> {
    const index = await this.readIndex()
    const idx = index.providers.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Provider not found: ${id}`)

    if (index.activeId === id) {
      throw new Error('Cannot delete active provider. Switch to another provider first.')
    }

    // Soft delete — move to trash
    const [provider] = index.providers.splice(idx, 1)
    index.trash.push({ provider, deletedAt: Date.now() })
    await this.writeIndex(index)
  }

  // --- Trash / Recycle Bin ---

  async listTrash(): Promise<TrashEntry[]> {
    const index = await this.readIndex()
    return index.trash
  }

  async restoreProvider(id: string): Promise<SavedProvider> {
    const index = await this.readIndex()
    const idx = index.trash.findIndex((t) => t.provider.id === id)
    if (idx === -1) throw new Error(`Trash entry not found: ${id}`)

    const [entry] = index.trash.splice(idx, 1)
    index.providers.push(entry.provider)
    await this.writeIndex(index)
    return entry.provider
  }

  async permanentlyDeleteFromTrash(id: string): Promise<void> {
    const index = await this.readIndex()
    const idx = index.trash.findIndex((t) => t.provider.id === id)
    if (idx === -1) throw new Error(`Trash entry not found: ${id}`)

    index.trash.splice(idx, 1)
    await this.writeIndex(index)
  }

  // --- Copy / Clone ---

  async copyProvider(id: string, newName?: string): Promise<SavedProvider> {
    const index = await this.readIndex()
    const source = index.providers.find((p) => p.id === id)
    if (!source) throw new Error(`Provider not found: ${id}`)

    const copy: SavedProvider = {
      ...source,
      id: crypto.randomUUID(),
      name: newName || `${source.name} (副本)`,
    }
    index.providers.push(copy)
    await this.writeIndex(index)
    return copy
  }

  // --- Activation ---

  async activateProvider(id: string): Promise<void> {
    const index = await this.readIndex()
    const provider = index.providers.find((p) => p.id === id)
    if (!provider) throw new Error(`Provider not found: ${id}`)

    index.activeId = id
    await this.writeIndex(index)
    await this.syncToSettings(provider)
  }

  async activateOfficial(): Promise<void> {
    const index = await this.readIndex()
    index.activeId = null
    await this.writeIndex(index)
    await this.clearProviderFromSettings()
  }

  // --- Settings sync ---

  private async syncToSettings(provider: SavedProvider): Promise<void> {
    const settingsPath = path.join(this.getConfigDir(), 'settings.json')

    // Determine the base URL strategy:
    // - anthropic format: use provider's baseUrl directly (Anthropic-compatible mirror)
    // - ollama format: needs proxy (Ollama's /v1/chat/completions is OpenAI format,
    //   not Anthropic Messages format) — point CLI at proxy server
    // - openai_chat/openai_responses: needs proxy for Anthropic→OpenAI conversion
    const needsProxy = provider.apiFormat !== 'anthropic'
    // The CLI must talk to the proxy server. The proxy reads the upstream
    // provider's baseUrl from the adapter config and forwards requests there.
    const proxyPort = 3456
    const baseUrl = needsProxy ? `http://127.0.0.1:${proxyPort}` : provider.baseUrl

    const envOverrides: Record<string, string> = {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: provider.apiKey,
      ANTHROPIC_MODEL: provider.models.main,
      CLAUDE_CODE_USE_ADAPTER: needsProxy ? '1' : '',
    }
    if (provider.models.haiku) envOverrides.ANTHROPIC_DEFAULT_HAIKU_MODEL = provider.models.haiku
    if (provider.models.sonnet) envOverrides.ANTHROPIC_DEFAULT_SONNET_MODEL = provider.models.sonnet
    if (provider.models.opus) envOverrides.ANTHROPIC_DEFAULT_OPUS_MODEL = provider.models.opus

    try {
      const raw = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(raw) as Record<string, unknown>
      const env = (settings.env as Record<string, string>) || {}

      const mergedEnv = { ...env, ...envOverrides }
      // Clean up empty values
      for (const [key, value] of Object.entries(mergedEnv)) {
        if (value === '') delete mergedEnv[key]
      }

      settings.env = mergedEnv
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
    } catch (err) {
      // Settings file doesn't exist or invalid — create new
      const newSettings: Record<string, unknown> = { env: envOverrides }
      // Clean up empty values
      for (const [key, value] of Object.entries(envOverrides)) {
        if (value === '') delete (newSettings.env as Record<string, string>)[key]
      }
      await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2) + '\n', 'utf-8')
    }
  }

  private async clearProviderFromSettings(): Promise<void> {
    const settingsPath = path.join(this.getConfigDir(), 'settings.json')

    try {
      const raw = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(raw) as Record<string, unknown>
      const env = (settings.env as Record<string, string>) || {}

      for (const key of MANAGED_ENV_KEYS) {
        delete env[key]
      }

      settings.env = env
      if (Object.keys(env).length === 0) {
        delete settings.env
      }

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
    } catch {
      // 文件不存在，无需处理
    }
  }

  // --- Get config for UI (masked) ---

  async getConfigForUI(): Promise<{ providers: SavedProvider[]; activeId: string | null }> {
    const index = await this.readIndex()
    const maskedProviders = index.providers.map(p => ({
      ...p,
      apiKey: this.maskSecret(p.apiKey)
    }))
    return { providers: maskedProviders, activeId: index.activeId }
  }

  // --- Auth status ---

  async checkAuthStatus(): Promise<{
    hasAuth: boolean
    source: 'adapter' | 'original-settings' | 'env' | 'none'
    activeProvider?: string
  }> {
    // 1. Check adapter active provider
    const index = await this.readIndex()
    if (index.activeId) {
      const provider = index.providers.find(p => p.id === index.activeId)
      if (provider?.apiKey && provider.apiKey !== '****') {
        return { hasAuth: true, source: 'adapter', activeProvider: provider.name }
      }
    }

    // 2. Check process.env
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
      return { hasAuth: true, source: 'env' }
    }

    // 3. Check original settings
    try {
      const settingsPath = path.join(this.getConfigDir(), 'settings.json')
      const raw = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(raw) as { env?: Record<string, string> }
      const env = settings.env ?? {}
      if (env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY) {
        return { hasAuth: true, source: 'original-settings' }
      }
    } catch {
      // File doesn't exist or invalid
    }

    return { hasAuth: false, source: 'none' }
  }

  // --- Get active provider for proxy ---

  async getActiveProviderForProxy(): Promise<{
    baseUrl: string
    apiKey: string
    apiFormat: ApiFormat
  } | null> {
    const index = await this.readIndex()
    if (!index.activeId) return null
    const provider = index.providers.find((p) => p.id === index.activeId)
    if (!provider) return null
    return {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      apiFormat: provider.apiFormat ?? 'anthropic',
    }
  }
}

export const adapterService = new AdapterService()
