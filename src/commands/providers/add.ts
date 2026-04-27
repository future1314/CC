import type { Command } from '../../commands.js'
import type { ApiFormat } from '../../services/adapterService.js'

const add = {
  type: 'local',
  name: 'add',
  description: 'Add a new model provider',
  argumentHint: '[name] [baseUrl] [apiKey] [apiFormat]',
  async run(args: string[]) {
    if (args.length < 3) {
      console.log('\n用法: /provider add <name> <baseUrl> <apiKey> [apiFormat] [mainModel]')
      console.log('\n示例:')
      console.log('  /provider add Ollama http://localhost:11434 "" ollama qwen2.5:latest')
      console.log('  /provider add DeepSeek https://api.deepseek.com sk-xxx openai_chat deepseek-chat')
      console.log('  /provider add 智谱AI https://open.bigmodel.cn/api/paas/v4 xxx.zhipu openai_chat glm-4-9b')
      console.log('  /provider add MiniMax https://api.minimaxi.com/anthropic your-key anthropic MiniMax-M2.7')
      console.log('  /provider add Kimi https://api.moonshot.cn/v1 your-key openai_chat moonshot-v1-8k')
      console.log('')
      console.log('API格式选项: anthropic, openai_chat, openai_responses, ollama')
      console.log('  - anthropic:        Anthropic 兼容 API（默认）')
      console.log('  - openai_chat:      OpenAI Chat Completions 兼容 API')
      console.log('  - openai_responses: OpenAI Responses API')
      console.log('  - ollama:           Ollama 本地 API')
      return []
    }

    const [name, baseUrl, apiKey, apiFormatRaw, mainModel] = args
    const apiFormat: ApiFormat = (apiFormatRaw || 'anthropic') as ApiFormat
    const validFormats: ApiFormat[] = ['anthropic', 'openai_chat', 'openai_responses', 'ollama']
    if (!validFormats.includes(apiFormat)) {
      console.log(`\n✗ 无效的API格式: ${apiFormat}`)
      console.log('  可选: anthropic, openai_chat, openai_responses, ollama')
      return []
    }

    try {
      const { adapterService } = await import('../../services/adapterService.js')
      const provider = await adapterService.addProvider({
        name,
        baseUrl,
        apiKey,
        apiFormat,
        models: {
          main: mainModel || '',
        },
      })
      console.log(`\n✓ 提供商添加成功: ${provider.name}`)
      console.log(`  ID:     ${provider.id}`)
      console.log(`  端点:   ${provider.baseUrl}`)
      console.log(`  格式:   ${provider.apiFormat}`)
      console.log(`  模型:   ${provider.models.main || '(未设置)'}`)
      console.log('\n使用 /provider activate ' + provider.id + ' 激活此提供商')
    } catch (err) {
      console.log('\n✗ 添加失败:', err instanceof Error ? err.message : String(err))
    }

    return []
  },
} satisfies Command

export default add
