import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Check } from 'lucide-react';
import { adapterService } from '../services/adapterService.js';
import { getThirdPartyProviders } from '../utils/model/third-party.js';
export function ProviderPicker({ initial, onSelect, onCancel }) {
    const [providers, setProviders] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadProviders();
    }, []);
    const loadProviders = async () => {
        try {
            const config = await adapterService.listProviders();
            const thirdPartyProviders = getThirdPartyProviders();
            // Combine saved providers with preset providers
            const allProviders = [
                ...config.providers.map(p => ({
                    id: p.id,
                    name: `${p.name} (custom)`,
                    apiFormat: p.apiFormat,
                    baseUrl: p.baseUrl
                })),
                // Add preset providers
                { id: 'preset-ollama', name: 'Ollama (本地)', apiFormat: 'ollama', baseUrl: 'http://localhost:11434' },
                { id: 'preset-minimax', name: 'MiniMax', apiFormat: 'openai_chat', baseUrl: 'https://api.minimax.chat' },
                { id: 'preset-zhipu', name: '智谱AI', apiFormat: 'openai_chat', baseUrl: 'https://open.bigmodel.cn' },
                { id: 'preset-deepseek', name: 'DeepSeek', apiFormat: 'openai_chat', baseUrl: 'https://api.deepseek.com' },
                { id: 'preset-kimi', name: 'Kimi', apiFormat: 'openai_chat', baseUrl: 'https://api.moonshot.cn' },
            ];
            setProviders(allProviders);
            setActiveId(config.activeId);
            setLoading(false);
        }
        catch (err) {
            console.error('Failed to load providers:', err);
            setLoading(false);
        }
    };
    if (loading) {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsx(Text, { children: "\u52A0\u8F7D\u4E2D..." }) }));
    }
    const handleSelect = (index) => {
        const provider = providers[index];
        if (provider) {
            onSelect(provider.id, provider.name);
        }
    };
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, marginBottom: 1, children: "\u9009\u62E9\u6A21\u578B\u63D0\u4F9B\u5546" }), _jsx(Text, { dimColor: true, marginBottom: 2, children: "\u9009\u62E9\u4E00\u4E2A\u7B2C\u4E09\u65B9\u6A21\u578B\u63D0\u4F9B\u5546\u6765\u66FF\u4EE3 Anthropic API" }), _jsx(Box, { flexDirection: "column", gap: 0, children: providers.map((provider, index) => {
                    const isActive = activeId === provider.id;
                    const isSelected = selectedIndex === index;
                    return (_jsxs(Box, { paddingX: 2, paddingY: 1, borderStyle: isSelected ? 'single' : 'round', borderColor: isSelected ? 'cyan' : 'gray', backgroundColor: isActive ? 'cyan' : undefined, children: [_jsxs(Text, { color: isActive ? 'black' : undefined, bold: isActive, onClick: () => handleSelect(index), children: [isActive && _jsx(Check, { size: 14 }), provider.name] }), _jsxs(Text, { dimColor: true, children: [" [", provider.apiFormat, "]"] })] }, provider.id));
                }) }), _jsxs(Box, { marginTop: 2, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "\u4F7F\u7528 /provider add \u6DFB\u52A0\u81EA\u5B9A\u4E49\u63D0\u4F9B\u5546" }), _jsx(Text, { dimColor: true, children: "\u6309 ESC \u53D6\u6D88" })] })] }));
}
