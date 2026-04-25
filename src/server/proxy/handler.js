/**
 * Proxy Handler — protocol-translating reverse proxy for OpenAI-compatible APIs.
 *
 * Receives Anthropic Messages API requests from the CLI, transforms them to
 * OpenAI Chat Completions or Responses API format, forwards to the upstream
 * provider, and transforms the response back to Anthropic format.
 */
import { adapterService } from '../../services/adapterService.js';
import { anthropicToOpenaiChat } from './transform/anthropicToOpenaiChat.js';
import { anthropicToOpenaiResponses } from './transform/anthropicToOpenaiResponses.js';
import { openaiChatToAnthropic } from './transform/openaiChatToAnthropic.js';
import { openaiResponsesToAnthropic } from './transform/openaiResponsesToAnthropic.js';
import { openaiChatStreamToAnthropic } from './streaming/openaiChatStreamToAnthropic.js';
import { openaiResponsesStreamToAnthropic } from './streaming/openaiResponsesStreamToAnthropic.js';
export async function handleProxyRequest(req, url) {
    // Only handle POST /proxy/v1/messages
    if (req.method !== 'POST' || url.pathname !== '/proxy/v1/messages') {
        return Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'Proxy only handles POST /proxy/v1/messages' } }, { status: 404 });
    }
    // Read active provider config
    const config = await adapterService.getActiveProviderForProxy();
    if (!config) {
        return Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'No active provider configured for proxy' } }, { status: 400 });
    }
    if (config.apiFormat === 'anthropic' || config.apiFormat === 'ollama') {
        // For native Anthropic format or Ollama, proxy not needed - use direct connection
        // Ollama may still need the base URL to be set correctly
        if (config.apiFormat === 'ollama') {
            console.log('[Proxy] Ollama provider detected, using direct connection');
        }
        return Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'Provider uses direct connection format' } }, { status: 400 });
    }
    // Parse request body
    let body;
    try {
        body = (await req.json());
    }
    catch {
        return Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'Invalid JSON in request body' } }, { status: 400 });
    }
    const isStream = body.stream === true;
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    try {
        if (config.apiFormat === 'openai_chat') {
            return await handleOpenaiChat(body, baseUrl, config.apiKey, isStream);
        }
        else if (config.apiFormat === 'openai_responses') {
            return await handleOpenaiResponses(body, baseUrl, config.apiKey, isStream);
        }
        else {
            // Custom format - try OpenAI chat first, then fall back
            return await handleOpenaiChat(body, baseUrl, config.apiKey, isStream);
        }
    }
    catch (err) {
        console.error('[Proxy] Upstream request failed:', err);
        return Response.json({
            type: 'error',
            error: {
                type: 'api_error',
                message: err instanceof Error ? err.message : String(err),
            },
        }, { status: 502 });
    }
}
async function handleOpenaiChat(body, baseUrl, apiKey, isStream) {
    const transformed = anthropicToOpenaiChat(body);
    const url = `${baseUrl}/v1/chat/completions`;
    const upstream = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(transformed),
        signal: isStream ? AbortSignal.timeout(30_000) : AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        return Response.json({
            type: 'error',
            error: {
                type: 'api_error',
                message: `Upstream returned HTTP ${upstream.status}: ${errText.slice(0, 500)}`,
            },
        }, { status: upstream.status });
    }
    if (isStream) {
        if (!upstream.body) {
            return Response.json({ type: 'error', error: { type: 'api_error', message: 'Upstream returned no body for stream' } }, { status: 502 });
        }
        const anthropicStream = openaiChatStreamToAnthropic(upstream.body, body.model);
        return new Response(anthropicStream, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    }
    // Non-streaming
    const responseBody = await upstream.json();
    const anthropicResponse = openaiChatToAnthropic(responseBody, body.model);
    return Response.json(anthropicResponse);
}
async function handleOpenaiResponses(body, baseUrl, apiKey, isStream) {
    const transformed = anthropicToOpenaiResponses(body);
    const url = `${baseUrl}/v1/responses`;
    const upstream = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(transformed),
        signal: isStream ? AbortSignal.timeout(30_000) : AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        return Response.json({
            type: 'error',
            error: {
                type: 'api_error',
                message: `Upstream returned HTTP ${upstream.status}: ${errText.slice(0, 500)}`,
            },
        }, { status: upstream.status });
    }
    if (isStream) {
        if (!upstream.body) {
            return Response.json({ type: 'error', error: { type: 'api_error', message: 'Upstream returned no body for stream' } }, { status: 502 });
        }
        const anthropicStream = openaiResponsesStreamToAnthropic(upstream.body, body.model);
        return new Response(anthropicStream, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    }
    // Non-streaming
    const responseBody = await upstream.json();
    const anthropicResponse = openaiResponsesToAnthropic(responseBody, body.model);
    return Response.json(anthropicResponse);
}
