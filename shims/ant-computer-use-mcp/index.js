export const DEFAULT_GRANT_FLAGS = {
    accessibility: false,
    screenRecording: false,
};
export const API_RESIZE_PARAMS = {};
export function targetImageSize(width, height) {
    return [width, height];
}
export function buildComputerUseTools() {
    return [];
}
export function createComputerUseMcpServer() {
    return {
        async connect() { },
        setRequestHandler() { },
        async close() { },
    };
}
export function bindSessionContext() {
    return async () => ({
        is_error: true,
        content: [
            {
                type: 'text',
                text: 'Computer use is unavailable in the restored development build.',
            },
        ],
    });
}
