// src/config/models.js
// 30-model registry, PROVIDERS, helpers (~350 lines) [Batch 1 + Batch 3 patch: getModelLabel, modelHasWebSearch, stripOnlineSuffix]
// ═══════════════════════════════════════════════════════════════
//  Model Registry — built-in catalog + your custom models merged
//  Custom models (added later in the Model Manager, Batch 4) are
//  stored in localStorage and merged at runtime by getAllModels().
// ═══════════════════════════════════════════════════════════════

import { getCustomModels } from '../lib/storage';

// ── Provider metadata ─────────────────────────────────────────
export const PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    badge: 'from-emerald-500 to-teal-600',
    initial: 'O',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97757',
    badge: 'from-orange-500 to-amber-600',
    initial: 'A',
  },
  google: {
    id: 'google',
    name: 'Google',
    color: '#4285f4',
    badge: 'from-blue-500 to-sky-600',
    initial: 'G',
  },
  'z-ai': {
    id: 'z-ai',
    name: 'Z.AI (GLM)',
    color: '#5b8cff',
    badge: 'from-indigo-500 to-blue-600',
    initial: 'Z',
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen',
    color: '#7c6cf6',
    badge: 'from-violet-500 to-purple-600',
    initial: 'Q',
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    color: '#f43f5e',
    badge: 'from-rose-500 to-red-600',
    initial: 'M',
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    color: '#20b8cd',
    badge: 'from-cyan-500 to-teal-600',
    initial: 'P',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    color: '#a1a1aa',
    badge: 'from-zinc-500 to-zinc-700',
    initial: '+',
  },
};

// ── Model factory ─────────────────────────────────────────────
function model(id, name, description, opts = {}) {
  return {
    id,
    name,
    provider: id.split('/')[0],
    description,
    contextLength: opts.contextLength ?? 128000,
    maxOutputTokens: opts.maxOutputTokens ?? 16384,
    capabilities: {
      vision: true,
      reasoning: false,
      webSearch: false,
      imageGen: false,
      tools: true,
      code: true,
      ...(opts.capabilities || {}),
    },
    tags: opts.tags || [],
    featured: opts.featured || false,
    builtin: true,
  };
}

// ── Built-in catalog (all requested models + image-gen models) ─
export const MODELS = [
  // ══ OpenAI ══
  model(
    'openai/gpt-6-astra',
    'GPT-6 Astra',
    "OpenAI's frontier flagship — deepest reasoning, agentic coding and true multimodal understanding for the hardest problems.",
    { contextLength: 400000, maxOutputTokens: 128000, capabilities: { reasoning: true }, tags: ['flagship', 'reasoning', 'coding', 'long-context'], featured: true }
  ),
  model(
    'openai/gpt-5.6-sol',
    'GPT-5.6 Sol',
    'Balanced frontier model — excellent reasoning, writing and code at high speed.',
    { contextLength: 400000, maxOutputTokens: 128000, capabilities: { reasoning: true }, tags: ['flagship', 'reasoning'], featured: true }
  ),
  model(
    'openai/gpt-5.6-luna',
    'GPT-5.6 Luna',
    'Fast, efficient frontier model — the daily driver for chat, code and analysis.',
    { contextLength: 272000, maxOutputTokens: 100000, capabilities: { reasoning: true }, tags: ['flagship', 'fast'], featured: true }
  ),
  model(
    'openai/gpt-5.6-luna-pro',
    'GPT-5.6 Luna Pro',
    'Luna with extended compute — higher quality on complex multi-step tasks.',
    { contextLength: 272000, maxOutputTokens: 100000, capabilities: { reasoning: true }, tags: ['flagship', 'reasoning'] }
  ),
  model(
    'openai/gpt-6-luna',
    'GPT-6 Luna',
    'Next-gen Luna — flagship speed with a big jump in reasoning and coding.',
    { contextLength: 400000, maxOutputTokens: 128000, capabilities: { reasoning: true }, tags: ['flagship', 'fast', 'reasoning'], featured: true }
  ),
  model(
    'openai/gpt-5.5',
    'GPT-5.5',
    'Previous-gen OpenAI flagship — still a superb all-rounder.',
    { contextLength: 400000, maxOutputTokens: 128000, capabilities: { reasoning: true }, tags: ['reasoning', 'coding'] }
  ),
  model(
    'openai/gpt-oss-120b',
    'GPT-OSS 120B',
    "OpenAI's open-weight 120B MoE — strong reasoning and agentic tool use at very low cost.",
    { contextLength: 131072, maxOutputTokens: 32768, capabilities: { reasoning: true }, tags: ['open-source', 'cheap', 'reasoning'] }
  ),
  model(
    'openai/gpt-4o-mini',
    'GPT-4o Mini',
    'Tiny, fast and cheap workhorse — great for titles, quick edits and utilities.',
    { contextLength: 128000, maxOutputTokens: 16384, tags: ['fast', 'cheap'] }
  ),

  // ══ Anthropic ══
  model(
    'anthropic/claude-opus-5',
    'Claude Opus 5',
    "Anthropic's most capable model — state-of-the-art coding, agentic work and nuanced analysis.",
    { contextLength: 200000, maxOutputTokens: 64000, capabilities: { reasoning: true }, tags: ['flagship', 'coding', 'reasoning', 'agentic'], featured: true }
  ),
  model(
    'anthropic/claude-sonnet-5',
    'Claude Sonnet 5',
    'The best balance of intelligence, speed and cost — the default for serious building.',
    { contextLength: 200000, maxOutputTokens: 64000, capabilities: { reasoning: true }, tags: ['coding', 'reasoning', 'agentic'], featured: true }
  ),
  model(
    'anthropic/claude-fable-5.1',
    'Claude Fable 5.1',
    'Tuned for long-form creative writing — fiction, scripts and rich narrative voice.',
    { contextLength: 200000, maxOutputTokens: 64000, capabilities: { reasoning: true }, tags: ['creative', 'writing'] }
  ),

  // ══ Google ══
  model(
    'google/gemini-3.8-flash',
    'Gemini 3.8 Flash',
    "Google's newest flash model — blazing fast multimodal reasoning with 1M context.",
    { contextLength: 1000000, maxOutputTokens: 65536, tags: ['fast', 'long-context'], featured: true }
  ),
  model(
    'google/gemini-3.7-flash',
    'Gemini 3.7 Flash',
    'Fast, cheap and multimodal — great for vision, summarization and chat.',
    { contextLength: 1000000, maxOutputTokens: 65536, tags: ['fast', 'long-context'] }
  ),
  model(
    'google/gemini-2.5-pro',
    'Gemini 2.5 Pro',
    'Pro reasoning with massive 1M context — superb for huge codebases and documents.',
    { contextLength: 1000000, maxOutputTokens: 65536, capabilities: { reasoning: true }, tags: ['long-context', 'reasoning'] }
  ),

  // ══ Z.AI (GLM) ══
  model(
    'z-ai/glm-5.3-flash',
    'GLM 5.3 Flash',
    'Ultra-fast GLM — near-instant responses for chat and light coding.',
    { contextLength: 128000, maxOutputTokens: 32768, tags: ['fast', 'cheap'] }
  ),
  model(
    'z-ai/glm-5.3',
    'GLM 5.3',
    'Z.AI flagship — strong agentic coding, tool use and reasoning.',
    { contextLength: 200000, maxOutputTokens: 98304, capabilities: { reasoning: true }, tags: ['flagship', 'coding', 'agentic'], featured: true }
  ),
  model(
    'z-ai/glm-5.2',
    'GLM 5.2',
    'Reliable generalist with solid coding and multilingual strength.',
    { contextLength: 128000, maxOutputTokens: 65536 }
  ),
  model(
    'z-ai/glm-5.1',
    'GLM 5.1',
    'Efficient GLM generation for everyday tasks at low cost.',
    { contextLength: 128000, maxOutputTokens: 32768, tags: ['cheap'] }
  ),

  // ══ Qwen ══
  model(
    'qwen/qwen3.8-flash',
    'Qwen3.8 Flash',
    "Alibaba's fast multimodal model with long context and strong coding.",
    { contextLength: 262144, maxOutputTokens: 32768, tags: ['fast', 'coding'] }
  ),
  model(
    'qwen/qwen3.7-flash',
    'Qwen3.7 Flash',
    'Fast Qwen generation — great value for chat and vision.',
    { contextLength: 262144, maxOutputTokens: 32768, tags: ['fast'] }
  ),
  model(
    'qwen/qwen3.8-max-0902',
    'Qwen3.8 Max',
    "Qwen's maximum-capability model — top-tier reasoning and knowledge.",
    { contextLength: 262144, maxOutputTokens: 65536, capabilities: { reasoning: true }, tags: ['flagship', 'reasoning'] }
  ),
  model(
    'qwen/qwen3.8-27b',
    'Qwen3.8 27B',
    'Compact open-weight Qwen — efficient and surprisingly capable.',
    { contextLength: 131072, maxOutputTokens: 32768, tags: ['open-source', 'cheap'] }
  ),

  // ══ MiniMax ══
  model(
    'minimax/minimax-m3',
    'MiniMax M3',
    'MiniMax flagship — long-context agentic model with strong tool use.',
    { contextLength: 1000000, maxOutputTokens: 65536, capabilities: { reasoning: true }, tags: ['flagship', 'agentic', 'long-context'] }
  ),
  model(
    'minimax/minimax-m2.7',
    'MiniMax M2.7',
    'Efficient MiniMax generation for everyday reasoning and coding.',
    { contextLength: 262144, maxOutputTokens: 32768, tags: ['cheap'] }
  ),

  // ══ Perplexity — built-in live web search ══
  model(
    'perplexity/sonar',
    'Sonar',
    'Fast answers grounded in live web search with citations.',
    { contextLength: 127072, maxOutputTokens: 8192, capabilities: { webSearch: true }, tags: ['search', 'fast'] }
  ),
  model(
    'perplexity/sonar-pro',
    'Sonar Pro',
    'Advanced web search — more sources, deeper grounding, better synthesis.',
    { contextLength: 200000, maxOutputTokens: 16384, capabilities: { webSearch: true }, tags: ['search'], featured: true }
  ),
  model(
    'perplexity/sonar-pro-search',
    'Sonar Pro Search',
    'Agentic search — plans queries, browses iteratively and synthesizes.',
    { contextLength: 200000, maxOutputTokens: 16384, capabilities: { webSearch: true }, tags: ['search', 'agentic'] }
  ),
  model(
    'perplexity/sonar-deep-research',
    'Sonar Deep Research',
    'Autonomous deep-research agent — exhaustive multi-step reports with sources.',
    { contextLength: 200000, maxOutputTokens: 65536, capabilities: { webSearch: true, reasoning: true }, tags: ['search', 'research', 'agentic'], featured: true }
  ),

  // ══ Image generation (image-output models on OpenRouter) ══
  model(
    'google/gemini-2.5-flash-image-preview',
    'Gemini Image (Nano Banana)',
    'Fast, high-quality image generation and conversational image editing.',
    { contextLength: 32768, maxOutputTokens: 32768, capabilities: { imageGen: true }, tags: ['image'], featured: true }
  ),
  model(
    'google/gemini-3-pro-image-preview',
    'Gemini 3 Pro Image (Nano Banana Pro)',
    'State-of-the-art image generation — text rendering, precision editing, up to 4K.',
    { contextLength: 65536, maxOutputTokens: 65536, capabilities: { imageGen: true }, tags: ['image'], featured: true }
  ),
];

// ── Default model per task ────────────────────────────────────
export const DEFAULT_MODELS = {
  chat: 'openai/gpt-5.6-luna',
  reasoning: 'openai/gpt-6-astra',
  coding: 'anthropic/claude-sonnet-5',
  vision: 'google/gemini-2.5-pro',
  fast: 'z-ai/glm-5.3-flash',
  cheap: 'openai/gpt-4o-mini',
  webSearch: 'perplexity/sonar-pro',
  research: 'perplexity/sonar-deep-research',
  imageGen: 'google/gemini-2.5-flash-image-preview',
  creative: 'anthropic/claude-fable-5.1',
};

// ── Helpers ───────────────────────────────────────────────────

/** Normalize a user-added custom model into the standard shape. */
export function normalizeCustomModel(c) {
  const provider = (c.id || '').split('/')[0];
  return {
    id: c.id,
    name: c.name || c.id.split('/').pop(),
    provider: PROVIDERS[provider] ? provider : 'custom',
    description: c.description || 'Custom OpenRouter model added by you.',
    contextLength: c.contextLength ?? 128000,
    maxOutputTokens: c.maxOutputTokens ?? 16384,
    capabilities: {
      vision: false,
      reasoning: false,
      webSearch: false,
      imageGen: false,
      tools: true,
      code: true,
      ...(c.capabilities || {}),
    },
    tags: c.tags && c.tags.length ? c.tags : ['custom'],
    featured: false,
    builtin: false,
  };
}

/** Built-in catalog + your locally added custom models (de-duplicated). */
export function getAllModels() {
  const custom = getCustomModels().map(normalizeCustomModel);
  const builtinIds = new Set(MODELS.map((m) => m.id));
  return [...MODELS, ...custom.filter((c) => !builtinIds.has(c.id))];
}

export function getModelById(id, all) {
  const list = all || getAllModels();
  return list.find((m) => m.id === id) || null;
}

export function getModelsByProvider(provider, all) {
  return (all || getAllModels()).filter((m) => m.provider === provider);
}

export function groupModelsByProvider(models) {
  const list = models || getAllModels();
  return Object.keys(PROVIDERS)
    .map((pid) => ({
      provider: pid,
      info: PROVIDERS[pid],
      models: list.filter((m) => m.provider === pid),
    }))
    .filter((g) => g.models.length > 0);
}

export function searchModels(query, models) {
  const q = (query || '').trim().toLowerCase();
  const list = models || getAllModels();
  if (!q) return list;
  return list.filter(
    (m) =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.tags || []).some((t) => t.toLowerCase().includes(q)) ||
      (PROVIDERS[m.provider]?.name || '').toLowerCase().includes(q)
  );
}

export function hasCapability(modelId, cap) {
  const m = getModelById(modelId);
  return !!m && !!m.capabilities?.[cap];
}

/** Perplexity sonar models search natively — no ':online' suffix needed. */
export function supportsNativeWebSearch(modelId) {
  return hasCapability(modelId, 'webSearch');
}

/** e.g. 400000 -> "400K", 1000000 -> "1M" */
export function formatContextLength(n) {
  if (n == null) return '—';
  if (n >= 1000000) {
    const v = n / 1000000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}



// ── Model label / web-search helpers (Batch 3) ────────────────

/** 'anthropic/claude-sonnet-5:online' → 'anthropic/claude-sonnet-5' */
export function stripOnlineSuffix(id = '') {
  return String(id).replace(/:online$/, '');
}

/** Best human name for any model id (built-in, custom, or unknown). */
export function getModelLabel(id = '') {
  const clean = stripOnlineSuffix(id);
  const m = getModelById(clean);
  if (m) return m.name;
  return clean.includes('/') ? clean.split('/').pop() : clean || '—';
}

/** Native sonar search OR an ':online'-suffixed model. */
export function modelHasWebSearch(id = '') {
  return supportsNativeWebSearch(stripOnlineSuffix(id)) || /:online$/.test(id);
}