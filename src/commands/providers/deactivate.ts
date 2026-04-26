import type { Command } from '../../commands.js'

const deactivate = {
  type: 'local',
  name: 'deactivate',
  description: 'Deactivate current provider and use official Anthropic',
  async run() {
    try {
      const { adapterService } = await import('../../services/adapterService.js')
      const config = await adapterService.listProviders()

      if (!config.activeId) {
        console.log('\n当前没有激活的第三方提供商')
        console.log('使用官方 Anthropic API')
      } else {
        await adapterService.activateOfficial()
        console.log('\n✓ 已切换回官方 Anthropic API')
      }
    } catch (err) {
      console.log('✗ 操作失败:', err instanceof Error ? err.message : String(err))
    }

    return []
  },
} satisfies Command

export default deactivate