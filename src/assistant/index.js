function readAssistantModeFlag() {
    return (process.env.CLAUDE_CODE_ASSISTANT_MODE === '1' ||
        process.env.CLAUDE_CODE_ASSISTANT_MODE === 'true');
}
export function isAssistantMode() {
    return readAssistantModeFlag();
}
export function isAssistantModeEnabled() {
    return readAssistantModeFlag();
}
