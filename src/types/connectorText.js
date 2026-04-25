export function isConnectorTextBlock(value) {
    return !!value && typeof value === 'object' && 'text' in value;
}
