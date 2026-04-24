import type { Command } from '../../commands.js'

const activate = {
  type: 'local',
  name: 'activate',
  description: 'Activate a model provider',
  argumentHint: '[id]',
  async run(args: string[]) {
    if (args.length < 1) {
      console.log('\n用法: /provider activate [providerId]')
      console.log('\n使用 /provider list 查看所有提供商及其ID')
      return []
    }

    const [providerId] = args
    console.log(`\n正在激活提供商: ${providerId}`)

    try {
      const { adapterService } = await import('../../../services/adapterService.js')
      await adapterService.activateProvider(providerId)
      console.log('✓ 提供商激活成功')
    } catch (err) {
      console.log('✗ 激活失败:', err instanceof Error ? err.message : String(err))
    }

    return []
  },
} satisfies Command

export default activate