import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { Check } from 'lucide-react'
import { adapterService } from '../services/adapterService.js'
import { getThirdPartyProviders, type ThirdPartyProvider } from '../utils/model/third-party.js'

interface ProviderPickerProps {
  initial?: string | null
  onSelect: (providerId: string, providerName: string) => void
  onCancel: () => void
}

export function ProviderPicker({ initial, onSelect, onCancel }: ProviderPickerProps) {
  const [providers, setProviders] = useState<Array<{ id: string; name: string; apiFormat: string; baseUrl: string }>>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      const config = await adapterService.listProviders()
      const thirdPartyProviders = getThirdPartyProviders()

      // Combine saved providers with preset providers (sourced from third-party.ts)
      const allProviders = [
        ...config.providers.map(p => ({
          id: p.id,
          name: `${p.name} (custom)`,
          apiFormat: p.apiFormat,
          baseUrl: p.baseUrl
        })),
        // Add preset providers from third-party.ts definitions (single source of truth)
        ...Object.entries(thirdPartyProviders).map(([id, cfg]) => ({
          id: `preset-${id}`,
          name: cfg.name,
          apiFormat: cfg.supportsTools ? 'openai_chat' : 'ollama',
          baseUrl: cfg.baseUrl,
        })),
      ]

      setProviders(allProviders)
      setActiveId(config.activeId)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load providers:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>加载中...</Text>
      </Box>
    )
  }

  const handleSelect = (index: number) => {
    const provider = providers[index]
    if (provider) {
      onSelect(provider.id, provider.name)
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold marginBottom={1}>选择模型提供商</Text>
      <Text dimColor marginBottom={2}>选择一个第三方模型提供商来替代 Anthropic API</Text>

      <Box flexDirection="column" gap={0}>
        {providers.map((provider, index) => {
          const isActive = activeId === provider.id
          const isSelected = selectedIndex === index

          return (
            <Box
              key={provider.id}
              paddingX={2}
              paddingY={1}
              borderStyle={isSelected ? 'single' : 'round'}
              borderColor={isSelected ? 'cyan' : 'gray'}
              backgroundColor={isActive ? 'cyan' : undefined}
            >
              <Text
                color={isActive ? 'black' : undefined}
                bold={isActive}
                onClick={() => handleSelect(index)}
              >
                {isActive && <Check size={14} />}
                {provider.name}
              </Text>
              <Text dimColor> [{provider.apiFormat}]</Text>
            </Box>
          )
        })}
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text dimColor>使用 /provider add 添加自定义提供商</Text>
        <Text dimColor>按 ESC 取消</Text>
      </Box>
    </Box>
  )
}