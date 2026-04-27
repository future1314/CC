/**
 * 第三方模型配置支持
 *
 * 支持两种模式：
 * 1. adapter 模式（CLAUDE_CODE_USE_ADAPTER=1）：通过 adapterService 管理 provider
 * 2. 环境变量模式：通过 ANTHROPIC_BASE_URL 等环境变量配置（中国用户常用）
 *
 * 在中国环境下（isChinaEnvironment()），即使未设置 CLAUDE_CODE_USE_ADAPTER，
 * 也会自动在 ModelPicker 中显示第三方模型选项。
 */

import { getChinaConfig, isChinaEnvironment } from '../china-config.js'

export type ThirdPartyProvider = 'ollama' | 'minimax' | 'zhipu' | 'deepseek' | 'kimi' | 'custom'

export interface ThirdPartyModel {
  id: string
  name: string
  provider: ThirdPartyProvider
  maxTokens?: number
  costPer1kInput?: number
  costPer1kOutput?: number
  description?: string
}

export interface ThirdPartyProviderConfig {
  name: string
  baseUrl: string
  apiKey?: string
  defaultModel: string
  models: ThirdPartyModel[]
  supportStream: boolean
  supportImages: boolean
  supportsTools: boolean
}

// Cache for adapter-configured models (loaded from ~/.claude/claude-code-adapters.json)
let adapterModelsCache: ThirdPartyModel[] | null = null

/** Reset the adapter models cache so next call reloads from disk. */
export function resetAdapterModelsCache(): void {
  adapterModelsCache = null
  _providersCache = undefined
}

/**
 * Load models from adapter config file (if it exists).
 * This supplements the hardcoded third-party models with user-configured providers.
 */
async function loadAdapterModels(): Promise<ThirdPartyModel[]> {
  if (adapterModelsCache) return adapterModelsCache

  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const os = await import('os')
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
    const indexPath = path.join(configDir, 'claude-code-adapters.json')
    const raw = await fs.readFile(indexPath, 'utf-8')
    const index = JSON.parse(raw) as {
      activeId: string | null
      providers: Array<{
        id: string
        name: string
        baseUrl: string
        apiFormat: string
        models: { main: string; haiku?: string; sonnet?: string; opus?: string }
      }>
    }

    const models: ThirdPartyModel[] = []
    for (const provider of index.providers) {
      // Add main model
      if (provider.models.main) {
        models.push({
          id: provider.models.main,
          name: provider.models.main,
          provider: 'custom' as ThirdPartyProvider,
          description: `${provider.name} (via adapter)`,
        })
      }
      // Add other models if configured
      for (const [key, modelId] of Object.entries(provider.models)) {
        if (modelId && key !== 'main' && !models.some(m => m.id === modelId)) {
          models.push({
            id: modelId,
            name: modelId,
            provider: 'custom' as ThirdPartyProvider,
            description: `${provider.name} ${key} (via adapter)`,
          })
        }
      }
    }

    adapterModelsCache = models
    return models
  } catch {
    return []
  }
}

/**
 * Synchronous version for isThirdPartyModel (uses hardcoded list + env vars only).
 * For full adapter model check, use isThirdPartyModelAsync().
 */
export function isThirdPartyModel(modelId: string): boolean {
  if (!modelId) return false

  // Check env vars for custom models
  const envModels = [
    process.env.ANTHROPIC_MODEL,
    process.env.ANTHROPIC_CUSTOM_MODEL_OPTION,
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
  ].filter(Boolean) as string[]

  if (envModels.includes(modelId)) {
    // If ANTHROPIC_BASE_URL is set to a non-Anthropic endpoint, it's third-party
    const baseUrl = process.env.ANTHROPIC_BASE_URL || ''
    const anthropicHosts = ['api.anthropic.com', 'open.bigmodel.cn']
    const isAnthropicHost = anthropicHosts.some(h => baseUrl.includes(h))
    if (baseUrl && !isAnthropicHost) {
      return true
    }
  }

  // Check hardcoded provider models
  const providers = getThirdPartyProvidersSync()
  for (const provider of Object.values(providers)) {
    if (provider.models.some(m => m.id === modelId)) {
      return true
    }
  }

  // Non-Anthropic model IDs that don't match known Claude aliases are likely third-party.
  // This is a heuristic — only apply it when in adapter mode or China environment
  // to avoid false positives in standard usage.
  if (shouldShowThirdPartyModels() && !modelId.startsWith('claude-')) {
    const knownAliases = ['sonnet', 'opus', 'haiku', 'best', 'fast']
    if (!knownAliases.includes(modelId.toLowerCase().split('[')[0])) {
      return true
    }
  }

  return false
}

/**
 * Get hardcoded third-party provider configs (synchronous).
 * Cached — returns the same object on repeated calls.
 */
let _providersCache: Record<ThirdPartyProvider, ThirdPartyProviderConfig> | undefined
function getThirdPartyProvidersSync(): Record<ThirdPartyProvider, ThirdPartyProviderConfig> {
  if (_providersCache) return _providersCache

  const chinaConfig = getChinaConfig()

  _providersCache = {
    ollama: {
      name: 'Ollama',
      baseUrl: chinaConfig.apiEndpoints.ollama!,
      defaultModel: chinaConfig.defaultModels.ollama!,
      supportStream: true,
      supportImages: true,
      supportsTools: false,
      models: [
        {
          id: 'qwen2.5:latest',
          name: 'Qwen2.5',
          provider: 'ollama',
          maxTokens: 128000,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          description: 'Qwen 2.5 大语言模型'
        },
        {
          id: 'deepseek-r1:latest',
          name: 'DeepSeek R1',
          provider: 'ollama',
          maxTokens: 128000,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          description: 'DeepSeek R1 推理模型（本地）'
        },
        {
          id: 'llama3.1:latest',
          name: 'Llama 3.1',
          provider: 'ollama',
          maxTokens: 131072,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          description: 'Meta Llama 3.1'
        },
      ]
    },
    minimax: {
      name: 'MiniMax',
      baseUrl: chinaConfig.apiEndpoints.minimax!,
      apiKey: process.env.MINIMAX_API_KEY,
      defaultModel: chinaConfig.defaultModels.minimax!,
      supportStream: true,
      supportImages: true,
      supportsTools: true,
      models: [
        {
          id: 'MiniMax-M2.7',
          name: 'MiniMax-M2.7',
          provider: 'minimax',
          maxTokens: 131072,
          costPer1kInput: 0.001,
          costPer1kOutput: 0.002,
          description: 'MiniMax-M2.7 大语言模型'
        },
        {
          id: 'abab6.5-chat',
          name: 'Abab 6.5 Chat',
          provider: 'minimax',
          maxTokens: 32768,
          costPer1kInput: 0.03,
          costPer1kOutput: 0.03,
          description: 'MiniMax Abab 6.5 对话模型'
        },
        {
          id: 'abab6.5s-chat',
          name: 'Abab 6.5S Chat',
          provider: 'minimax',
          maxTokens: 32768,
          costPer1kInput: 0.015,
          costPer1kOutput: 0.015,
          description: 'MiniMax Abab 6.5S 对话模型（更便宜）'
        },
        {
          id: 'abab-8xchat',
          name: 'Abab 8X Chat',
          provider: 'minimax',
          maxTokens: 16384,
          costPer1kInput: 0.08,
          costPer1kOutput: 0.08,
          description: 'MiniMax Abab 8X 对话模型（更强的推理能力）'
        }
      ]
    },
    zhipu: {
      name: '智谱AI',
      baseUrl: chinaConfig.apiEndpoints.zhipu!,
      apiKey: process.env.ZHIPU_API_KEY,
      defaultModel: chinaConfig.defaultModels.zhipu!,
      supportStream: true,
      supportImages: true,
      supportsTools: true,
      models: [
        {
          id: 'glm-4-plus',
          name: 'GLM-4-Plus',
          provider: 'zhipu',
          maxTokens: 128000,
          costPer1kInput: 0.05,
          costPer1kOutput: 0.05,
          description: '智谱 GLM-4-Plus（高性能）'
        },
        {
          id: 'glm-4-flash',
          name: 'GLM-4-Flash',
          provider: 'zhipu',
          maxTokens: 128000,
          costPer1kInput: 0.0001,
          costPer1kOutput: 0.0001,
          description: '智谱 GLM-4-Flash（免费/超低成本）'
        },
        {
          id: 'glm-4-9b',
          name: 'GLM-4-9B',
          provider: 'zhipu',
          maxTokens: 131072,
          costPer1kInput: 0.001,
          costPer1kOutput: 0.002,
          description: '智谱 GLM-4-9B（开源）'
        },
        {
          id: 'glm-4v',
          name: 'GLM-4V',
          provider: 'zhipu',
          maxTokens: 131072,
          costPer1kInput: 0.01,
          costPer1kOutput: 0.01,
          description: '智谱 GLM-4V（多模态）'
        },
      ]
    },
    deepseek: {
      name: 'DeepSeek',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-chat',
      supportStream: true,
      supportImages: false,
      supportsTools: true,
      models: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek V3',
          provider: 'deepseek',
          maxTokens: 128000,
          costPer1kInput: 0.0014,
          costPer1kOutput: 0.0028,
          description: 'DeepSeek V3 对话模型（含代码能力）'
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek R1',
          provider: 'deepseek',
          maxTokens: 128000,
          costPer1kInput: 0.004,
          costPer1kOutput: 0.016,
          description: 'DeepSeek R1 推理模型'
        },
      ]
    },
    kimi: {
      name: 'Kimi',
      baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
      apiKey: process.env.KIMI_API_KEY,
      defaultModel: process.env.KIMI_DEFAULT_MODEL || 'moonshot-v1-8k',
      supportStream: true,
      supportImages: true,
      supportsTools: true,
      models: [
        {
          id: 'moonshot-v1-8k',
          name: 'Kimi 8K',
          provider: 'kimi',
          maxTokens: 32768,
          costPer1kInput: 0.012,
          costPer1kOutput: 0.012,
          description: 'Kimi 8K 对话模型（8K上下文）'
        },
        {
          id: 'moonshot-v1-32k',
          name: 'Kimi 32K',
          provider: 'kimi',
          maxTokens: 32768,
          costPer1kInput: 0.024,
          costPer1kOutput: 0.024,
          description: 'Kimi 32K 对话模型（32K上下文）'
        },
        {
          id: 'moonshot-v1-128k',
          name: 'Kimi 128K',
          provider: 'kimi',
          maxTokens: 128000,
          costPer1kInput: 0.06,
          costPer1kOutput: 0.06,
          description: 'Kimi 128K 对话模型（128K上下文）'
        }
      ]
    }
  }
  return _providersCache
}
export function getThirdPartyProviders(): Record<ThirdPartyProvider, ThirdPartyProviderConfig> {
  return getThirdPartyProvidersSync()
}

/**
 * Check if third-party models should be shown in the model picker.
 * True when:
 * - CLAUDE_CODE_USE_ADAPTER=1 (explicit adapter mode), OR
 * - In China environment (auto-detect), OR
 * - ANTHROPIC_BASE_URL points to a non-Anthropic endpoint
 */
export function shouldShowThirdPartyModels(): boolean {
  if (process.env.CLAUDE_CODE_USE_ADAPTER === '1') return true
  if (isChinaEnvironment()) return true

  const baseUrl = process.env.ANTHROPIC_BASE_URL || ''
  if (baseUrl) {
    const anthropicHosts = ['api.anthropic.com', 'open.bigmodel.cn']
    if (!anthropicHosts.some(h => baseUrl.includes(h))) {
      return true
    }
  }

  return false
}

/**
 * 根据模型ID获取模型信息
 */
export function getModelById(modelId: string): ThirdPartyModel | undefined {
  const providers = getThirdPartyProviders()

  for (const provider of Object.values(providers)) {
    const model = provider.models.find(m => m.id === modelId)
    if (model) {
      return model
    }
  }

  return undefined
}

/**
 * 获取所有可用的第三方模型
 */
export function getAllThirdPartyModels(): ThirdPartyModel[] {
  const providers = getThirdPartyProviders()
  const models: ThirdPartyModel[] = []

  for (const provider of Object.values(providers)) {
    models.push(...provider.models)
  }

  return models
}
