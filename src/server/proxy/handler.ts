/**
 * Proxy Handler — protocol-translating reverse proxy for OpenAI-compatible APIs.
 *
 * Receives Anthropic Messages API requests from the CLI, transforms them to
 * OpenAI Chat Completions or Responses API format, forwards to the upstream
 * provider, and transforms the response back to Anthropic format.
 */

import { adapterService } from '../../services/adapterService.js'
import { anthropicToOpenaiChat } from './transform/anthropicToOpenaiChat.js'
import { anthropicToOpenaiResponses } from './transform/anthropicToOpenaiResponses.js'
import { openaiChatToAnthropic } from './transform/openaiChatToAnthropic.js'
import { openaiResponsesToAnthropic } from './transform/openaiResponsesToAnthropic.js'
import { openaiChatStreamToAnthropic } from './streaming/openaiChatStreamToAnthropic.js'
import { openaiResponsesStreamToAnthropic } from './streaming/openaiResponsesStreamToAnthropic.js'
import type { AnthropicRequest } from './transform/types.js'

export async function handleProxyRequest(req: Request, url: URL): Promise<Response> {
  // Health check
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    return Response.json({ status: 'ok', timestamp: Date.now(), proxy: 'running' })
  }

  // Handle Anthropic SDK paths: /v1/messages and /proxy/v1/messages
  // The SDK sends to {baseURL}/v1/messages by default
  if (req.method !== 'POST' || !(url.pathname === '/v1/messages' || url.pathname === '/proxy/v1/messages')) {
    return Response.json(
      { type: 'error', error: { type: 'invalid_request_error', message: `Proxy only handles POST /v1/messages (got ${req.method} ${url.pathname})` } },
      { status: 404 },
    )
  }

  // Read active provider config
  const config = await adapterService.getActiveProviderForProxy()
  if (!config) {
    return Response.json(
      { type: 'error', error: { type: 'invalid_request_error', message: 'No active provider configured for proxy' } },
      { status: 400 },
    )
  }

  if (config.apiFormat === 'anthropic') {
    // Native Anthropic-compatible endpoint — direct connection, no proxy needed
    return Response.json(
      { type: 'error', error: { type: 'invalid_request_error', message: 'Anthropic-compatible provider uses direct connection, no proxy needed' } },
      { status: 400 },
    )
  }

  // Parse request body
  let body: AnthropicRequest
  try {
    body = (await req.json()) as AnthropicRequest
  } catch {
    return Response.json(
      { type: 'error', error: { type: 'invalid_request_error', message: 'Invalid JSON in request body' } },
      { status: 400 },
    )
  }

  const isStream = body.stream === true
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  try {
    if (config.apiFormat === 'openai_chat' || config.apiFormat === 'ollama') {
      // Ollama supports OpenAI-compatible /v1/chat/completions
      return await handleOpenaiChat(body, baseUrl, config.apiKey, isStream)
    } else if (config.apiFormat === 'openai_responses') {
      return await handleOpenaiResponses(body, baseUrl, config.apiKey, isStream)
    } else {
      // Unknown format — default to OpenAI chat
      return await handleOpenaiChat(body, baseUrl, config.apiKey, isStream)
    }
  } catch (err) {
    console.error('[Proxy] Upstream request failed:', err)
    return Response.json(
      {
        type: 'error',
        error: {
          type: 'api_error',
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 502 },
    )
  }
}

async function handleOpenaiChat(
  body: AnthropicRequest,
  baseUrl: string,
  apiKey: string,
  isStream: boolean,
): Promise<Response> {
  const transformed = anthropicToOpenaiChat(body)
  const url = `${baseUrl}/v1/chat/completions`

  // Build headers, only include Authorization if apiKey is non-empty
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(transformed),
    // Streaming: 5 min timeout (long completions), non-streaming: 5 min timeout
    signal: AbortSignal.timeout(isStream ? 300_000 : 300_000),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return Response.json(
      {
        type: 'error',
        error: {
          type: 'api_error',
          message: `Upstream returned HTTP ${upstream.status}: ${errText.slice(0, 500)}`,
        },
      },
      { status: upstream.status },
    )
  }

  if (isStream) {
    if (!upstream.body) {
      return Response.json(
        { type: 'error', error: { type: 'api_error', message: 'Upstream returned no body for stream' } },
        { status: 502 },
      )
    }
    const anthropicStream = openaiChatStreamToAnthropic(upstream.body, body.model)
    return new Response(anthropicStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // Non-streaming
  const responseBody = await upstream.json()
  const anthropicResponse = openaiChatToAnthropic(responseBody, body.model)
  return Response.json(anthropicResponse)
}

async function handleOpenaiResponses(
  body: AnthropicRequest,
  baseUrl: string,
  apiKey: string,
  isStream: boolean,
): Promise<Response> {
  const transformed = anthropicToOpenaiResponses(body)
  const url = `${baseUrl}/v1/responses`

  // Build headers, only include Authorization if apiKey is non-empty
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(transformed),
    signal: AbortSignal.timeout(isStream ? 300_000 : 300_000),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return Response.json(
      {
        type: 'error',
        error: {
          type: 'api_error',
          message: `Upstream returned HTTP ${upstream.status}: ${errText.slice(0, 500)}`,
        },
      },
      { status: upstream.status },
    )
  }

  if (isStream) {
    if (!upstream.body) {
      return Response.json(
        { type: 'error', error: { type: 'api_error', message: 'Upstream returned no body for stream' } },
        { status: 502 },
      )
    }
    const anthropicStream = openaiResponsesStreamToAnthropic(upstream.body, body.model)
    return new Response(anthropicStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // Non-streaming
  const responseBody = await upstream.json()
  const anthropicResponse = openaiResponsesToAnthropic(responseBody, body.model)
  return Response.json(anthropicResponse)
}