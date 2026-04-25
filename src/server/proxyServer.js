/**
 * Proxy Server — 本地代理服务器，将 Anthropic API 请求转换为第三方模型格式
 */
import { handleProxyRequest } from './proxy/handler.js';
const PORT = 3456;
let server = null;
/**
 * 启动代理服务器
 */
export async function startProxyServer() {
    if (server) {
        console.log('[Proxy Server] Already running on port', PORT);
        return;
    }
    const handler = async (req) => {
        const url = new URL(req.url);
        // Handle proxy requests
        if (url.pathname.startsWith('/proxy')) {
            return handleProxyRequest(req, url);
        }
        // Health check
        if (url.pathname === '/health') {
            return Response.json({ status: 'ok', timestamp: Date.now() });
        }
        return Response.json({ error: 'Not Found', message: 'Unknown endpoint' }, { status: 404 });
    };
    try {
        // Deno.serve is available in Bun (or Node with http module)
        // For compatibility, we'll use a simple HTTP server approach
        const http = await import('node:http');
        const serverInstance = http.createServer(handler);
        serverInstance.listen(PORT, () => {
            console.log(`[Proxy Server] Started on http://127.0.0.1:${PORT}`);
            console.log(`[Proxy Server] Proxy endpoint: http://127.0.0.1:${PORT}/proxy/v1/messages`);
        });
        server = serverInstance;
    }
    catch (err) {
        console.error('[Proxy Server] Failed to start:', err);
        throw err;
    }
}
/**
 * 停止代理服务器
 */
export async function stopProxyServer() {
    if (server) {
        server.close();
        server = null;
        console.log('[Proxy Server] Stopped');
    }
}
/**
 * 获取代理服务器端口
 */
export function getProxyPort() {
    return PORT;
}
