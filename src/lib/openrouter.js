// src/lib/openrouter.js
// API client: streaming SSE, image gen, live catalog, key check, titles (~470 lines) [Batch 1+2+4 -- B2 patch: generateImage w/ images[] (edit); B4 patch: optional-Authority headers]
// ═══════════════════════════════════════════════════════════════
//  OpenRouter API client
//  • Streaming chat (SSE) with reasoning, citations & images
//  • Image generation (modalities: ['image','text'])
//  • Live model catalog (/models) → add ANY model later
//  • Key/account check (/auth/key)
// ═══════════════════════════════════════════════════════════════

import { APP_NAME, OPENROUTER, ONLINE_SUFFIX, TITLE_GENERATION_MODEL } from '../config/constants';

// ── Errors ────────────────────────────────────────────────────

export class OpenRouterError extends Error {
  constructor(message, status = 0, code = null) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.code = code;
    this.hint = hintFor(status);
  }
}

function hintFor(status) {
  switch (status) {
    case 401:
      return 'Your API key is invalid or missing. Check it in Settings → API Key.';
    case 402:
      return 'Insufficient credits on your OpenRouter account. Add credits at openrouter.ai/credits.';
    case 403:
      return 'This model may require moderation approval, or your key lacks access to it.';
    case 404:
      return 'Model not found. It may have been renamed — add the correct ID in the Model Manager.';
    case 408:
      return 'The upstream provider timed out. Try again or pick another model.';
    case 429:
      return 'Rate limited. Wait a moment or switch to a different model.';
    case 502:
    case 503:
      return 'The model provider is temporarily down or overloaded. Try another model.';
    default:
      return '';
  }
}

async function throwHttpError(res) {
  let message = `Request failed (${res.status})`;
  let code = res.status;
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      message = j?.error?.message || j?.message || message;
      if (j?.error?.code != null) code = j.error.code;
    } catch {
      if (text) message = text.slice(0, 300);
    }
  } catch {
    /* ignore read errors */
  }
  throw new OpenRouterError(message, res.status, code);
}

// ── Headers ───────────────────────────────────────────────────

function buildHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (typeof window !== 'undefined') {
    headers['HTTP-Referer'] = window.location.origin || 'https://localhost';
    headers['X-Title'] = APP_NAME;
  }
  return headers;
}

// ── Account / key check ───────────────────────────────────────

export async function checkConnection(apiKey) {
  const res = await fetch(`${OPENROUTER.BASE_URL}/auth/key`, {
    headers: buildHeaders(apiKey),
  });
  if (!res.ok) await throwHttpError(res);
  const json = await res.json();
  const d = json.data || {};
  return {
    label: d.label || 'OpenRouter key',
    usage: typeof d.usage === 'number' ? d.usage : null,
    limit: typeof d.limit === 'number' ? d.limit : null,
    isFreeTier: !!d.is_free_tier,
    rateLimit: d.rate_limit || null,
  };
}

// ── Live model catalog (for the Model Manager) ────────────────

const toNum = (v) => (v == null ? null : parseFloat(v));

export function normalizeOpenRouterModel(raw) {
  const arch = raw.architecture || {};
  const inputMods = arch.input_modalities || [];
  const outputMods = arch.output_modalities || [];
  const params = raw.supported_parameters || [];
  const pricing = raw.pricing || {};
  return {
    id: raw.id,
    name: raw.name || raw.id,
    description: raw.description || '',
    contextLength: raw.context_length || null,
    pricing: {
      prompt: toNum(pricing.prompt),
      completion: toNum(pricing.completion),
    },
    capabilities: {
      vision: inputMods.includes('image'),
      imageGen: outputMods.includes('image'),
      reasoning: params.includes('reasoning') || params.includes('include_reasoning'),
      tools: params.includes('tools'),
      webSearch: false,
      code: true,
    },
    modality: arch.modality || '',
    supportedParameters: params,
    createdAt: raw.created || null,
  };
}

export async function fetchAvailableModels(apiKey) {
  const res = await fetch(`${OPENROUTER.BASE_URL}/models`, {
    headers: buildHeaders(apiKey),
  });
  if (!res.ok) await throwHttpError(res);
  const json = await res.json();
  return (json.data || []).map(normalizeOpenRouterModel);
}

// ── Web search helper ─────────────────────────────────────────

/** Append/strip the ':online' suffix to enable OpenRouter web search on ANY model. */
export function applyWebSearch(modelId, enabled) {
  if (!modelId) return modelId;
  if (!enabled) return modelId.replace(/:online$/, '');
  return modelId.endsWith(ONLINE_SUFFIX) ? modelId : `${modelId}${ONLINE_SUFFIX}`;
}

// ── Reasoning details helper ──────────────────────────────────

function extractReasoningText(details) {
  if (!Array.isArray(details)) return '';
  return details
    .map((d) => (typeof d === 'string' ? d : d?.text || d?.summary || ''))
    .join('');
}

// ── Streaming chat ────────────────────────────────────────────

/**
 * Stream a chat completion.
 * @param {Object} p
 * @param {string} p.apiKey
 * @param {string} p.model            e.g. 'anthropic/claude-sonnet-5' (may include ':online')
 * @param {Array}  p.messages         OpenAI-format messages
 * @param {number} [p.temperature]
 * @param {number} [p.maxTokens]
 * @param {AbortSignal} [p.signal]
 * @param {(delta: string, full: string) => void} [p.onText]
 * @param {(delta: string, full: string) => void} [p.onReasoning]
 * @param {(images: string[]) => void} [p.onImages]
 * @param {(annotations: object[]) => void} [p.onAnnotations]
 * @param {(usage: object) => void} [p.onUsage]
 * @returns {Promise<{content, reasoning, images, annotations, usage, finishReason, model}>}
 */
export async function streamChat({
  apiKey,
  model,
  messages,
  temperature = 0.7,
  maxTokens,
  signal,
  onText,
  onReasoning,
  onImages,
  onAnnotations,
  onUsage,
}) {
  const body = {
    model,
    messages,
    stream: true,
    temperature,
    usage: { include: true },
  };
  if (maxTokens) body.max_tokens = maxTokens;

  let res;
  try {
    res = await fetch(`${OPENROUTER.BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new OpenRouterError('Network error — check your internet connection.', 0, 'network');
  }

  if (!res.ok) await throwHttpError(res);
  if (!res.body) throw new OpenRouterError('Streaming is not supported in this browser.', 0, 'stream');

  const result = {
    content: '',
    reasoning: '',
    images: [],
    annotations: [],
    usage: null,
    finishReason: null,
    model: null,
  };

  function handleChunkObject(obj) {
    if (obj.error) {
      throw new OpenRouterError(
        obj.error.message || 'Stream error',
        typeof obj.error.code === 'number' ? obj.error.code : 500,
        obj.error.code ?? null
      );
    }
    if (obj.model) result.model = obj.model;
    if (obj.usage) {
      result.usage = obj.usage;
      onUsage?.(obj.usage);
    }
    const choices = obj.choices || [];
    for (const choice of choices) {
      const delta = choice.delta || choice.message || {};

      if (typeof delta.content === 'string' && delta.content) {
        result.content += delta.content;
        onText?.(delta.content, result.content);
      } else if (Array.isArray(delta.content)) {
        for (const part of delta.content) {
          if (part?.type === 'text' && part.text) {
            result.content += part.text;
            onText?.(part.text, result.content);
          }
        }
      }

      if (typeof delta.reasoning === 'string' && delta.reasoning) {
        result.reasoning += delta.reasoning;
        onReasoning?.(delta.reasoning, result.reasoning);
      }
      const rd = extractReasoningText(delta.reasoning_details);
      if (rd) {
        result.reasoning += rd;
        onReasoning?.(rd, result.reasoning);
      }

      const imgs = delta.images || (choice.message && choice.message.images);
      if (Array.isArray(imgs) && imgs.length) {
        for (const im of imgs) {
          const url = im?.image_url?.url || im?.url;
          if (url && !result.images.includes(url)) result.images.push(url);
        }
        onImages?.(result.images);
      }

      const ann = delta.annotations || (choice.message && choice.message.annotations);
      if (Array.isArray(ann) && ann.length) {
        for (const a of ann) {
          const c = a?.url_citation || a;
          if (c?.url && !result.annotations.some((x) => x.url === c.url)) {
            result.annotations.push(c);
          }
        }
        onAnnotations?.(result.annotations);
      }

      if (choice.finish_reason) result.finishReason = choice.finish_reason;
    }
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line || line.startsWith(':')) continue; // heartbeat comments
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;

      let obj;
      try {
        obj = JSON.parse(data);
      } catch {
        continue; // skip malformed fragments
      }
      try {
        handleChunkObject(obj);
      } catch (err) {
        if (err instanceof OpenRouterError) throw err;
        console.warn('[openrouter] chunk handling error', err);
      }
    }
  }

  return result;
}

// ── Non-streaming chat ────────────────────────────────────────

export async function chatComplete({
  apiKey,
  model,
  messages,
  temperature = 0.7,
  maxTokens,
  signal,
  modalities,
  extra,
}) {
  const body = {
    model,
    messages,
    temperature,
    ...(modalities ? { modalities } : {}),
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...extra,
  };

  let res;
  try {
    res = await fetch(`${OPENROUTER.BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new OpenRouterError('Network error — check your internet connection.', 0, 'network');
  }

  if (!res.ok) await throwHttpError(res);
  const json = await res.json();

  const choice = json.choices?.[0] || {};
  const msg = choice.message || {};

  let content = msg.content;
  if (Array.isArray(content)) {
    content = content.map((p) => (p?.type === 'text' ? p.text : '')).join('');
  }

  const images = (msg.images || [])
    .map((im) => im?.image_url?.url || im?.url)
    .filter(Boolean);

  const annotations = (msg.annotations || [])
    .map((a) => a?.url_citation || a)
    .filter(Boolean);

  return {
    content: content || '',
    reasoning: msg.reasoning || extractReasoningText(msg.reasoning_details),
    images,
    annotations,
    usage: json.usage || null,
    finishReason: choice.finish_reason || null,
  };
}

// ── Image generation ──────────────────────────────────────────

/**
 * Generate images with an image-output model (e.g. gemini-2.5-flash-image-preview).
 * @returns {Promise<{images: string[], text: string}>} images = data URLs
 */
export async function generateImage({ apiKey, model, prompt, signal, systemPrompt }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const out = await chatComplete({
    apiKey,
    model,
    messages,
    signal,
    modalities: ['image', 'text'],
  });

  return { images: out.images, text: out.content };
}

// ── Auto chat title ───────────────────────────────────────────

export function fallbackTitle(text) {
  const words = (text || '').trim().split(/\s+/).slice(0, 5).join(' ');
  return (words || 'New chat').slice(0, 60);
}

export async function generateChatTitle(apiKey, userMessage, signal) {
  try {
    const { content } = await chatComplete({
      apiKey,
      model: TITLE_GENERATION_MODEL,
      maxTokens: 24,
      temperature: 0.4,
      signal,
      messages: [
        {
          role: 'system',
          content:
            'Create a very short chat title (2-5 words) for the user message. Reply with ONLY the title — no quotes, no trailing punctuation.',
        },
        { role: 'user', content: (userMessage || '').slice(0, 500) },
      ],
    });
    const t = (content || '')
      .trim()
      .replace(/^["'#*\s]+|["'.\s]+$/g, '');
    return t ? t.slice(0, 60) : fallbackTitle(userMessage);
  } catch {
    return fallbackTitle(userMessage);
  }
}