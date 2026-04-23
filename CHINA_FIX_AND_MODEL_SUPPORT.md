# 中国大陆修复和第三方模型支持

## 已完成的工作

### 1. 研究借鉴项目
- 分析了 [ClaudeBox](https://github.com/braverior/ClaudeBox) 项目
- 分析了 [cc-haha](https://github.com/NanmiCoder/cc-haha) 项目
- 学习了两个项目的实现方式

**关键发现：**
- cc-haha 使用 Provider Service 管理多个模型提供商
- 配置存储在 `~/.claude/cc-haha/providers.json`
- 激活的提供商通过环境变量同步
- 支持本地代理服务器转换 API 格式

### 2. 创建的文件

#### src/utils/china-config.ts
- 中国大陆网络环境检测
- API 端点配置
- 默认模型配置
- 支持环境变量覆盖

#### src/utils/model/third-party.ts
- 第三方模型类型定义
- Ollama、MiniMax、智谱AI 三个模型提供商配置
- 模型信息管理功能

#### src/components/ModelSelector.tsx
- 模型选择器 UI 组件
- 支持搜索和分类显示
- 集成中国模式显示

#### src/services/adapterService.ts
- 模型提供商适配器服务
- 支持增删改查操作
- 配置文件管理：`~/.claude/claude-code-adapters.json`
- 支持将配置同步到环境变量

#### 更新的文件

##### src/utils/model/providers.ts
- 添加 `thirdParty` 到 APIProvider 类型
- 更新 `getAPIProvider()` 函数支持第三方提供商
- 在 `isFirstPartyAnthropicBaseUrl()` 中添加国内镜像域名支持

##### src/utils/model/model.ts
- 导入新的配置服务模块
- 为后续集成第三方模型做准备

## 还需要完成的工作

### 1. 模型命令集成
- 添加 `/providers` 命令用于管理提供商
- 添加 `/provider-add` 命令用于添加新提供商
- 添加 `/provider-remove` 命令用于删除提供商
- 添加 `/provider-activate` 命令用于激活提供商
- 添加 `/provider-list` 命令用于列出所有提供商

### 2. 代理服务器实现
参考 cc-haha 的实现方式：
- 创建 API 转换代理服务器
- 实现 Anthropic 格式到其他格式的转换
- 实现响应格式的反向转换

### 3. 网页版集成
参考 ClaudeBox 的实现方式：
- 在设置页面添加模型提供商管理
- 支持通过 UI 添加、删除、激活提供商
- 实时显示当前激活的提供商

### 4. 测试验证
- 测试中国网络环境检测
- 测试第三方模型调用
- 测试模型切换功能

## 使用说明

### 环境变量配置

```bash
# 启用中国模式
export CLAUDE_CODE_CHINA_MODE=1

# 使用代理（如果需要）
export HTTPS_PROXY=http://your-proxy:port

# 禁用默认代理
export CLAUDE_CODE_DISABLE_PROXY=1
```

### API 端点配置

```bash
# Ollama (本地模型)
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_DEFAULT_MODEL=qwen2.5:latest

# MiniMax
export MINIMAX_BASE_URL=https://api.minimax.chat/v1
export MINIMAX_API_KEY=your-api-key
export MINIMAX_DEFAULT_MODEL=abab6.5-chat

# 智谱AI
export ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
export ZHIPU_API_KEY=your-api-key
export ZHIPU_DEFAULT_MODEL=glm-4-9b

# Anthropic 国内镜像
export ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
```

## 注意事项

1. 配置文件路径：`~/.claude/claude-code-adapters.json`
2. 第三方模型需要配置相应的 API Key
3. 中国模式会自动使用国内镜像端点
4. Ollama 模型需要本地运行 Ollama 服务
