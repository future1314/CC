import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getThirdPartyProviders, getAllThirdPartyModels } from '../utils/model/third-party.js';
import { getChinaConfig } from '../utils/china-config.js';
export const ModelSelector = ({ currentModel, onModelSelect, onToggleMenu }) => {
    const { exit } = useApp();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [expandedProviders, setExpandedProviders] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [chinaConfig] = useState(getChinaConfig());
    const providers = getThirdPartyProviders();
    const allModels = getAllThirdPartyModels();
    // 过滤模型
    const filteredModels = allModels.filter(model => model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.id.toLowerCase().includes(searchTerm.toLowerCase()));
    useEffect(() => {
        // ESC 关闭菜单
        useInput((input, key) => {
            if (key.escape) {
                onToggleMenu?.();
            }
            else if (key.ctrl && input === 'c') {
                exit();
            }
        });
    }, [onToggleMenu, exit]);
    const handleSelect = () => {
        if (filteredModels[selectedIndex]) {
            onModelSelect(filteredModels[selectedIndex].id);
            onToggleMenu?.();
        }
    };
    const toggleProvider = (providerName) => {
        setExpandedProviders(prev => prev.includes(providerName)
            ? prev.filter(p => p !== providerName)
            : [...prev, providerName]);
    };
    const renderProvider = (providerId, providerConfig, startIndex) => {
        const isExpanded = expandedProviders.includes(providerId);
        const models = providerConfig.models;
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { width: 40, height: 1, paddingX: 1, borderStyle: currentModel?.startsWith(providerId) ? 'double' : 'single', borderColor: currentModel?.startsWith(providerId) ? 'green' : 'gray', onClick: () => toggleProvider(providerId), children: _jsxs(Text, { children: [isExpanded ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }), ' ', providerConfig.name] }) }), isExpanded && (_jsx(Box, { marginLeft: 2, flexDirection: "column", children: models.map((model, index) => {
                        const globalIndex = startIndex + index + 1;
                        const isSelected = selectedIndex === globalIndex;
                        return (_jsx(Box, { width: 38, height: 1, paddingX: 1, borderStyle: isSelected ? 'double' : 'single', borderColor: isSelected ? 'green' : 'gray', backgroundColor: isSelected ? 'green' : undefined, onClick: () => setSelectedIndex(globalIndex), children: _jsxs(Text, { children: [model.name, model.id === currentModel && ' (当前)'] }) }, model.id));
                    }) }))] }, providerId));
    };
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "double", borderColor: "blue", padding: 1, width: 60, children: [_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, children: "\u9009\u62E9\u6A21\u578B" }), _jsx(Text, { dimColor: true, children: "\u6309 ESC \u5173\u95ED\uFF0CEnter \u9009\u62E9" })] }), chinaConfig.enabled && (_jsx(Box, { marginBottom: 1, children: _jsx(Text, { dimColor: true, children: "\uD83D\uDCA1 \u4E2D\u56FD\u5927\u9646\u6A21\u5F0F\u5DF2\u542F\u7528" }) })), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { children: "\u641C\u7D22\u6A21\u578B: " }), _jsx(Text, { color: "yellow", children: searchTerm }), _jsx(Text, { dimColor: true, children: " (\u8F93\u5165\u6A21\u578B\u540D\u79F0\u8FC7\u6EE4)" })] }), _jsx(Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", children: Object.entries(providers).map(([providerId, providerConfig], index) => {
                    const isExpanded = expandedProviders.includes(providerId);
                    const startIndex = index === 0 ? 0 :
                        Object.entries(providers)
                            .slice(0, index)
                            .reduce((acc, [, p]) => acc + (isExpanded ? p.models.length + 1 : 1), 0);
                    return renderProvider(providerId, providerConfig, startIndex);
                }) }), _jsx(Box, { marginTop: 1, flexDirection: "row", children: _jsxs(Text, { dimColor: true, children: ["\u5F53\u524D\u9009\u62E9: ", currentModel || '未选择'] }) })] }));
};
