/**
 * Model Provider Adapter Service
 * 管理第三方模型提供商配置
 *
 * 配置文件：~/.claude/claude-code-adapters.json
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
const MANAGED_ENV_KEYS = [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
];
const DEFAULT_INDEX = { activeId: null, providers: [] };
class AdapterService {
    getConfigDir() {
        return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    }
    getIndexPath() {
        return path.join(this.getConfigDir(), 'claude-code-adapters.json');
    }
    async readIndex() {
        try {
            const raw = await fs.readFile(this.getIndexPath(), 'utf-8');
            return JSON.parse(raw);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return { ...DEFAULT_INDEX, providers: [] };
            }
            throw new Error(`Failed to read adapter config: ${err}`);
        }
    }
    async writeIndex(index) {
        const filePath = this.getIndexPath();
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        const tmpFile = `${filePath}.tmp.${Date.now()}`;
        try {
            await fs.writeFile(tmpFile, JSON.stringify(index, null, 2) + '\n', 'utf-8');
            await fs.rename(tmpFile, filePath);
        }
        catch (err) {
            await fs.unlink(tmpFile).catch(() => { });
            throw new Error(`Failed to write adapter config: ${err}`);
        }
    }
    maskSecret(value) {
        if (!value)
            return value;
        if (value.length <= 4)
            return '****';
        return '****' + value.slice(-4);
    }
    isMasked(value) {
        return !!value && value.startsWith('****');
    }
    // --- CRUD ---
    async listProviders() {
        const index = await this.readIndex();
        return { providers: index.providers, activeId: index.activeId };
    }
    async getProvider(id) {
        const index = await this.readIndex();
        const provider = index.providers.find((p) => p.id === id);
        if (!provider)
            throw new Error(`Provider not found: ${id}`);
        return provider;
    }
    async addProvider(input) {
        const index = await this.readIndex();
        const provider = {
            id: crypto.randomUUID(),
            name: input.name,
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
            apiFormat: input.apiFormat ?? 'anthropic',
            models: input.models,
            ...(input.notes !== undefined && { notes: input.notes }),
        };
        index.providers.push(provider);
        await this.writeIndex(index);
        return provider;
    }
    async updateProvider(id, input) {
        const index = await this.readIndex();
        const idx = index.providers.findIndex((p) => p.id === id);
        if (idx === -1)
            throw new Error(`Provider not found: ${id}`);
        const existing = index.providers[idx];
        const updated = {
            ...existing,
            ...(input.name !== undefined && { name: input.name }),
            ...(input.apiKey !== undefined && {
                apiKey: this.isMasked(input.apiKey) ? existing.apiKey : input.apiKey
            }),
            ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
            ...(input.apiFormat !== undefined && { apiFormat: input.apiFormat }),
            ...(input.models !== undefined && { models: { ...existing.models, ...input.models } }),
            ...(input.notes !== undefined && { notes: input.notes }),
        };
        index.providers[idx] = updated;
        await this.writeIndex(index);
        if (index.activeId === id) {
            await this.syncToSettings(updated);
        }
        return updated;
    }
    async deleteProvider(id) {
        const index = await this.readIndex();
        const idx = index.providers.findIndex((p) => p.id === id);
        if (idx === -1)
            throw new Error(`Provider not found: ${id}`);
        if (index.activeId === id) {
            throw new Error('Cannot delete active provider. Switch to another provider first.');
        }
        index.providers.splice(idx, 1);
        await this.writeIndex(index);
    }
    // --- Activation ---
    async activateProvider(id) {
        const index = await this.readIndex();
        const provider = index.providers.find((p) => p.id === id);
        if (!provider)
            throw new Error(`Provider not found: ${id}`);
        index.activeId = id;
        await this.writeIndex(index);
        await this.syncToSettings(provider);
    }
    async activateOfficial() {
        const index = await this.readIndex();
        index.activeId = null;
        await this.writeIndex(index);
        await this.clearProviderFromSettings();
    }
    // --- Settings sync ---
    async syncToSettings(provider) {
        const settingsPath = path.join(this.getConfigDir(), 'settings.json');
        try {
            const raw = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(raw);
            const env = settings.env || {};
            const baseUrl = provider.apiFormat === 'ollama'
                ? provider.baseUrl
                : provider.apiFormat !== 'anthropic'
                    ? `http://127.0.0.1:3456/proxy`
                    : provider.baseUrl;
            const mergedEnv = {
                ...env,
                ANTHROPIC_BASE_URL: baseUrl,
                ANTHROPIC_AUTH_TOKEN: provider.apiKey,
                ANTHROPIC_MODEL: provider.models.main,
                ANTHROPIC_DEFAULT_HAIKU_MODEL: provider.models.haiku || '',
                ANTHROPIC_DEFAULT_SONNET_MODEL: provider.models.sonnet || '',
                ANTHROPIC_DEFAULT_OPUS_MODEL: provider.models.opus || '',
            };
            settings.env = mergedEnv;
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
        }
        catch (err) {
            // 设置文件不存在或格式错误，创建新配置
            const newSettings = {
                env: {
                    ANTHROPIC_BASE_URL: provider.baseUrl,
                    ANTHROPIC_AUTH_TOKEN: provider.apiKey,
                    ANTHROPIC_MODEL: provider.models.main,
                    ANTHROPIC_DEFAULT_HAIKU_MODEL: provider.models.haiku || '',
                    ANTHROPIC_DEFAULT_SONNET_MODEL: provider.models.sonnet || '',
                    ANTHROPIC_DEFAULT_OPUS_MODEL: provider.models.opus || '',
                }
            };
            await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2) + '\n', 'utf-8');
        }
    }
    async clearProviderFromSettings() {
        const settingsPath = path.join(this.getConfigDir(), 'settings.json');
        try {
            const raw = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(raw);
            const env = settings.env || {};
            for (const key of MANAGED_ENV_KEYS) {
                delete env[key];
            }
            settings.env = env;
            if (Object.keys(env).length === 0) {
                delete settings.env;
            }
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
        }
        catch {
            // 文件不存在，无需处理
        }
    }
    // --- Get config for UI (masked) ---
    async getConfigForUI() {
        const index = await this.readIndex();
        const maskedProviders = index.providers.map(p => ({
            ...p,
            apiKey: this.maskSecret(p.apiKey)
        }));
        return { providers: maskedProviders, activeId: index.activeId };
    }
    // --- Auth status ---
    async checkAuthStatus() {
        // 1. Check adapter active provider
        const index = await this.readIndex();
        if (index.activeId) {
            const provider = index.providers.find(p => p.id === index.activeId);
            if (provider?.apiKey && provider.apiKey !== '****') {
                return { hasAuth: true, source: 'adapter', activeProvider: provider.name };
            }
        }
        // 2. Check process.env
        if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
            return { hasAuth: true, source: 'env' };
        }
        // 3. Check original settings
        try {
            const settingsPath = path.join(this.getConfigDir(), 'settings.json');
            const raw = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(raw);
            const env = settings.env ?? {};
            if (env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY) {
                return { hasAuth: true, source: 'original-settings' };
            }
        }
        catch {
            // File doesn't exist or invalid
        }
        return { hasAuth: false, source: 'none' };
    }
    // --- Get active provider for proxy ---
    async getActiveProviderForProxy() {
        const index = await this.readIndex();
        if (!index.activeId)
            return null;
        const provider = index.providers.find((p) => p.id === index.activeId);
        if (!provider)
            return null;
        return {
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            apiFormat: provider.apiFormat ?? 'anthropic',
        };
    }
}
export const adapterService = new AdapterService();
