/**
 * 第三方模型配置支持
 */
import { getChinaConfig } from '../china-config.js';
/**
 * 获取第三方模型配置
 */
export function getThirdPartyProviders() {
    const chinaConfig = getChinaConfig();
    return {
        ollama: {
            name: 'Ollama',
            baseUrl: chinaConfig.apiEndpoints.ollama,
            defaultModel: chinaConfig.defaultModels.ollama,
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
                    id: 'llama3.1:latest',
                    name: 'Llama 3.1',
                    provider: 'ollama',
                    maxTokens: 131072,
                    costPer1kInput: 0,
                    costPer1kOutput: 0,
                    description: 'Meta Llama 3.1'
                },
                {
                    id: 'mistral:latest',
                    name: 'Mistral',
                    provider: 'ollama',
                    maxTokens: 8192,
                    costPer1kInput: 0,
                    costPer1kOutput: 0,
                    description: 'Mistral 7B'
                }
            ]
        },
        minimax: {
            name: 'MiniMax',
            baseUrl: chinaConfig.apiEndpoints.minimax,
            apiKey: process.env.MINIMAX_API_KEY,
            defaultModel: chinaConfig.defaultModels.minimax,
            supportStream: true,
            supportImages: true,
            supportsTools: true,
            models: [
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
            baseUrl: chinaConfig.apiEndpoints.zhipu,
            apiKey: process.env.ZHIPU_API_KEY,
            defaultModel: chinaConfig.defaultModels.zhipu,
            supportStream: true,
            supportImages: false,
            supportsTools: true,
            models: [
                {
                    id: 'glm-4-9b',
                    name: 'GLM-4-9B',
                    provider: 'zhipu',
                    maxTokens: 131072,
                    costPer1kInput: 0.001,
                    costPer1kOutput: 0.002,
                    description: '智谱 GLM-4-9B'
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
                {
                    id: 'glm-3-turbo',
                    name: 'GLM-3-Turbo',
                    provider: 'zhipu',
                    maxTokens: 128000,
                    costPer1kInput: 0.0005,
                    costPer1kOutput: 0.001,
                    description: '智谱 GLM-3-Turbo（更经济）'
                }
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
                    name: 'DeepSeek Chat',
                    provider: 'deepseek',
                    maxTokens: 128000,
                    costPer1kInput: 0.0014,
                    costPer1kOutput: 0.0028,
                    description: 'DeepSeek 对话模型'
                },
                {
                    id: 'deepseek-coder',
                    name: 'DeepSeek Coder',
                    provider: 'deepseek',
                    maxTokens: 128000,
                    costPer1kInput: 0.0014,
                    costPer1kOutput: 0.0028,
                    description: 'DeepSeek 代码模型'
                }
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
    };
}
/**
 * 根据模型ID获取模型信息
 */
export function getModelById(modelId) {
    const providers = getThirdPartyProviders();
    for (const provider of Object.values(providers)) {
        const model = provider.models.find(m => m.id === modelId);
        if (model) {
            return model;
        }
    }
    return undefined;
}
/**
 * 检查模型是否为第三方模型
 */
export function isThirdPartyModel(modelId) {
    const providers = getThirdPartyProviders();
    for (const provider of Object.values(providers)) {
        if (provider.models.some(m => m.id === modelId)) {
            return true;
        }
    }
    return false;
}
/**
 * 获取所有可用的第三方模型
 */
export function getAllThirdPartyModels() {
    const providers = getThirdPartyProviders();
    const models = [];
    for (const provider of Object.values(providers)) {
        models.push(...provider.models);
    }
    return models;
}
