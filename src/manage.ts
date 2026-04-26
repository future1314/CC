/**
 * Model management CLI tool — 模型管理 CLI 工具
 *
 * Usage: bun run src/manage.ts [command]
 *
 * Commands:
 *   web          启动 Web 管理界面 (含代理服务器)
 *   proxy        仅启动代理服务器
 *   status       查看当前状态
 *   providers    列出所有提供商
 *   activate     激活提供商
 */

import { startProxyServer, stopProxyServer, getProxyPort } from './server/proxyServer.js'
import { startWebServer, stopWebServer, getWebPort } from './server/webServer.js'
import { adapterService } from './services/adapterService.js'
import { getChinaConfig } from './utils/china-config.js'

const cmd = process.argv[2] || 'web'

async function main(): Promise<void> {
  switch (cmd) {
    case 'web': {
      await startProxyServer()
      const webPort = await startWebServer()
      console.log()
      console.log('╔══════════════════════════════════════════════════╗')
      console.log('║     Claude Code 模型管理中心                     ║')
      console.log('╠══════════════════════════════════════════════════╣')
      console.log(`║  Web 管理界面: http://127.0.0.1:${webPort}              ║`)
      console.log(`║  API 端点:   http://127.0.0.1:${webPort}/api          ║`)
      console.log(`║  代理服务器:   http://127.0.0.1:${getProxyPort()}              ║`)
      console.log('╠══════════════════════════════════════════════════╣')
      console.log('║  环境变量设置:                                  ║')
      console.log('║  export ANTHROPIC_BASE_URL=http://127.0.0.1:' + getProxyPort() + '  ║')
      console.log('║  export ANTHROPIC_AUTH_TOKEN=your-api-key       ║')
      console.log('╚══════════════════════════════════════════════════╝')
      console.log()
      console.log('按 Ctrl+C 退出')

      // Keep alive
      process.on('SIGINT', async () => {
        console.log('\n正在停止服务...')
        await Promise.all([stopProxyServer(), stopWebServer()])
        process.exit(0)
      })
      process.on('SIGTERM', async () => {
        await Promise.all([stopProxyServer(), stopWebServer()])
        process.exit(0)
      })
      break
    }

    case 'proxy': {
      await startProxyServer()
      console.log()
      console.log(`代理服务器已启动: http://127.0.0.1:${getProxyPort()}`)
      console.log('按 Ctrl+C 退出')

      process.on('SIGINT', async () => {
        console.log('\n正在停止代理服务器...')
        await stopProxyServer()
        process.exit(0)
      })
      process.on('SIGTERM', async () => {
        await stopProxyServer()
        process.exit(0)
      })
      break
    }

    case 'status': {
      const china = getChinaConfig()
      const auth = await adapterService.checkAuthStatus()

      console.log()
      console.log('═══════════════════════════════════════════')
      console.log('  Claude Code 状态')
      console.log('═══════════════════════════════════════════')
      console.log(`  中国大陆模式:   ${china.enabled ? '✓ 已启用' : '✗ 未启用'}`)
      if (china.enabled) {
        console.log(`  代理:          ${china.useProxy ? '✓ 启用' : '✗ 禁用'}`)
        console.log(`  Anthropic镜像: ${china.apiEndpoints.anthropic}`)
      }
      console.log('───────────────────────────────────────────')
      console.log(`  API 认证:      ${auth.hasAuth ? `✓ (${auth.source}${auth.activeProvider ? ', ' + auth.activeProvider : ''})` : '✗ 无'}`)
      console.log(`  ANTHROPIC_BASE_URL: ${process.env.ANTHROPIC_BASE_URL || '(未设置 => 使用默认)'}`)
      console.log(`  ANTHROPIC_MODEL:    ${process.env.ANTHROPIC_MODEL || '(未设置 => 使用默认)'}`)
      console.log('═══════════════════════════════════════════')
      console.log()
      break
    }

    case 'providers': {
      const config = await adapterService.getConfigForUI()
      console.log()
      if (config.providers.length === 0) {
        console.log('暂未配置提供商')
        console.log()
        console.log('快速添加:')
        console.log('  bun run src/manage.ts web    # 启动 Web 界面添加')
        console.log('  # 或在 Claude Code CLI 中:')
        console.log('  /provider add Ollama http://localhost:11434 "" ollama qwen2.5:latest')
      } else {
        console.log(`已配置 ${config.providers.length} 个提供商:`)
        console.log()
        for (const p of config.providers) {
          const isActive = p.id === config.activeId
          console.log(`  ${isActive ? '★' : ' '} ${p.name}`)
          console.log(`    ID:       ${p.id}`)
          console.log(`    端点:     ${p.baseUrl}`)
          console.log(`    格式:     ${p.apiFormat}`)
          console.log(`    主模型:   ${p.models.main || '(未设置)'}`)
          if (isActive) console.log('    [当前激活]')
          console.log()
        }
      }
      break
    }

    default: {
      console.log('用法: bun run src/manage.ts [command]')
      console.log()
      console.log('Commands:')
      console.log('  web          启动 Web 管理界面 (浏览器管理 + 代理服务器)')
      console.log('  proxy        仅启动 API 格式代理服务器')
      console.log('  status       查看当前状态')
      console.log('  providers    列出所有已配置的模型提供商')
      console.log()
      console.log('环境变量:')
      console.log('  CLAUDE_CODE_CHINA_MODE=1    启用中国大陆模式')
      console.log('  ANTHROPIC_BASE_URL          API端点')
      console.log('  ANTHROPIC_AUTH_TOKEN        API密钥')
      break
    }
  }
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
