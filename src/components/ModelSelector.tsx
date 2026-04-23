import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp, BoxNode } from 'ink'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getThirdPartyProviders, getAllThirdPartyModels, ThirdPartyModel } from '../utils/model/third-party.js'
import { getChinaConfig } from '../utils/china-config.js'

interface ModelSelectorProps {
  currentModel?: string
  onModelSelect: (model: string) => void
  onToggleMenu?: () => void
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  onModelSelect,
  onToggleMenu
}) => {
  const { exit } = useApp()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [expandedProviders, setExpandedProviders] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [chinaConfig] = useState(getChinaConfig())

  const providers = getThirdPartyProviders()
  const allModels = getAllThirdPartyModels()

  // 过滤模型
  const filteredModels = allModels.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    // ESC 关闭菜单
    useInput((input, key) => {
      if (key.escape) {
        onToggleMenu?.()
      } else if (key.ctrl && input === 'c') {
        exit()
      }
    })
  }, [onToggleMenu, exit])

  const handleSelect = () => {
    if (filteredModels[selectedIndex]) {
      onModelSelect(filteredModels[selectedIndex].id)
      onToggleMenu?.()
    }
  }

  const toggleProvider = (providerName: string) => {
    setExpandedProviders(prev =>
      prev.includes(providerName)
        ? prev.filter(p => p !== providerName)
        : [...prev, providerName]
    )
  }

  const renderProvider = (providerId: string, providerConfig: any, startIndex: number) => {
    const isExpanded = expandedProviders.includes(providerId)
    const models = providerConfig.models

    return (
      <Box key={providerId} flexDirection="column">
        <Box
          width={40}
          height={1}
          paddingX={1}
          borderStyle={currentModel?.startsWith(providerId) ? 'double' : 'single'}
          borderColor={currentModel?.startsWith(providerId) ? 'green' : 'gray'}
          onClick={() => toggleProvider(providerId)}
        >
          <Text>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {' '}
            {providerConfig.name}
          </Text>
        </Box>

        {isExpanded && (
          <Box marginLeft={2} flexDirection="column">
            {models.map((model: ThirdPartyModel, index: number) => {
              const globalIndex = startIndex + index + 1
              const isSelected = selectedIndex === globalIndex

              return (
                <Box
                  key={model.id}
                  width={38}
                  height={1}
                  paddingX={1}
                  borderStyle={isSelected ? 'double' : 'single'}
                  borderColor={isSelected ? 'green' : 'gray'}
                  backgroundColor={isSelected ? 'green' : undefined}
                  onClick={() => setSelectedIndex(globalIndex)}
                >
                  <Text>
                    {model.name}
                    {model.id === currentModel && ' (当前)'}
                  </Text>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="blue" padding={1} width={60}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>选择模型</Text>
        <Text dimColor>按 ESC 关闭，Enter 选择</Text>
      </Box>

      {chinaConfig.enabled && (
        <Box marginBottom={1}>
          <Text dimColor>💡 中国大陆模式已启用</Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text>搜索模型: </Text>
        <Text color="yellow">{searchTerm}</Text>
        <Text dimColor> (输入模型名称过滤)</Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="gray">
        {Object.entries(providers).map(([providerId, providerConfig], index) => {
          const isExpanded = expandedProviders.includes(providerId)
          const startIndex = index === 0 ? 0 :
            Object.entries(providers)
              .slice(0, index)
              .reduce((acc, [, p]) => acc + (isExpanded ? p.models.length + 1 : 1), 0)

          return renderProvider(providerId, providerConfig, startIndex)
        })}
      </Box>

      <Box marginTop={1} flexDirection="row">
        <Text dimColor>
          当前选择: {currentModel || '未选择'}
        </Text>
      </Box>
    </Box>
  )
}