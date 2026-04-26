/**
 * 中国大陆网络配置支持
 */

import { isEnvTruthy } from './envUtils.js'

export type ChinaConfig = {
  enabled: boolean
  // 是否使用代理
  useProxy: boolean
  // API端点配置
  apiEndpoints: {
    anthropic?: string
    ollama?: string
    minimax?: string
    zhipu?: string
  }
  // 默认模型配置
  defaultModels: {
    ollama?: string
    minimax?: string
    zhipu?: string
  }
}

/**
 * 检测是否在中国大陆环境
 */
export function isChinaEnvironment(): boolean {
  // 检测环境变量
  if (isEnvTruthy(process.env.CLAUDE_CODE_CHINA_MODE)) {
    return true
  }

  // 检测系统语言
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE || ''
  if (lang.includes('zh_CN') || lang.includes('zh_CN.UTF-8')) {
    return true
  }

  // 可以添加更多的检测逻辑，如IP检测等
  return false
}

/**
 * 获取中国大陆配置
 */
export function getChinaConfig(): ChinaConfig {
  const enabled = isChinaEnvironment()

  return {
    enabled,
    useProxy: enabled && !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_PROXY),
    apiEndpoints: {
      // 国内镜像地址
      anthropic: process.env.ANTHROPIC_BASE_URL_CN || 'https://open.bigmodel.cn/api/anthropic',
      ollama: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      minimax: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
      zhipu: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    },
    defaultModels: {
      ollama: process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:latest',
      minimax: process.env.MINIMAX_DEFAULT_MODEL || 'abab6.5-chat',
      zhipu: process.env.ZHIPU_DEFAULT_MODEL || 'glm-4-9b',
    }
  }
}

/**
 * 获取适配的API端点
 */
export function getAdaptedApiEndpoint(service: keyof ChinaConfig['apiEndpoints']): string {
  const config = getChinaConfig()

  if (!config.enabled) {
    // 如果不是中国大陆环境，使用默认端点
    switch (service) {
      case 'anthropic':
        return 'https://api.anthropic.com'
      default:
        return config.apiEndpoints[service] || ''
    }
  }

  return config.apiEndpoints[service] || ''
}