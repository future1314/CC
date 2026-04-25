import type { Command } from '../../commands.js'

const list = {
  type: 'local',
  name: 'list',
  aliases: ['ls'],
  description: 'List all configured model providers',
  argumentHint: '',
  async run() {
    try {
      const { adapterService } = await import('../../services/adapterService.js')
      const config = await adapterService.getConfigForUI()

      if (config.providers.length === 0) {
        console.log('\n暂无配置的提供商')
        console.log('使用 /provider add <name> <baseUrl> <apiKey> [apiFormat] 添加提供商')
        console.log('')
        console.log('快捷示例:')
        console.log('  /provider add Ollama http://localhost:11434 "" ollama')
        console.log('  /provider add DeepSeek https://api.deepseek.com sk-xxx openai_chat')
        return []
      }

      console.log('\n已配置的模型提供商:')
      console.log('─'.repeat(60))
      for (const provider of config.providers) {
        const isActive = provider.id === config.activeId
        const marker = isActive ? ' ★ [活跃]' : ''
        console.log(`\n  ${provider.name}${marker}`)
        console.log(`  ID:     ${provider.id}`)
        console.log(`  端点:   ${provider.baseUrl}`)
        console.log(`  API密钥: ${provider.apiKey}`)
        console.log(`  格式:   ${provider.apiFormat}`)
        console.log(`  主模型: ${provider.models.main || '(未设置)'}`)
        if (provider.models.haiku) console.log(`  Haiku:  ${provider.models.haiku}`)
        if (provider.models.sonnet) console.log(`  Sonnet: ${provider.models.sonnet}`)
        if (provider.models.opus) console.log(`  Opus:   ${provider.models.opus}`)
        if (provider.notes) console.log(`  备注:   ${provider.notes}`)
      }
      console.log('\n' + '─'.repeat(60))

      if (!config.activeId) {
        console.log('\n当前使用: 官方 Anthropic API')
      }

      console.log('\n命令:')
      console.log('  /provider activate <id>   激活提供商')
      console.log('  /provider deactivate      切换回官方API')
      console.log('  /provider remove <id>     删除提供商')
    } catch (err) {
      console.log('\n✗ 读取配置失败:', err instanceof Error ? err.message : String(err))
    }

    return []
  },
} satisfies Command

export default list
