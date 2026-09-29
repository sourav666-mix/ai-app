// src/config/constants.js
// App constants, 5 MODES, SYSTEM_PROMPTS, storage keys, limits, suggestions (~230 lines) [Batch 1]
// ═══════════════════════════════════════════════════════════════
//  Nova AI Studio — Global constants
// ═══════════════════════════════════════════════════════════════

export const APP_NAME = 'Nova AI Studio';
export const APP_VERSION = '1.0.0';
export const APP_TAGLINE = 'One studio. Every frontier model.';
export const APP_DESCRIPTION =
  'Chat, deep research, web search, image generation, file & camera understanding, PDF/Markdown export and full-stack project building — powered by OpenRouter, local-first.';

// ── OpenRouter ────────────────────────────────────────────────
export const OPENROUTER = {
  BASE_URL: 'https://openrouter.ai/api/v1',
  KEYS_URL: 'https://openrouter.ai/keys',
  MODELS_URL: 'https://openrouter.ai/models',
  DOCS_URL: 'https://openrouter.ai/docs',
  CREDITS_URL: 'https://openrouter.ai/credits',
};
export const OPENROUTER_KEYS_URL = OPENROUTER.KEYS_URL;
export const OPENROUTER_MODELS_URL = OPENROUTER.MODELS_URL;
export const OPENROUTER_DOCS_URL = OPENROUTER.DOCS_URL;

// Appending ':online' to any OpenRouter model ID enables live web search
export const ONLINE_SUFFIX = ':online';

// ── Local storage keys ────────────────────────────────────────
export const STORAGE_KEYS = {
  API_KEY: 'nova:api-key',
  SETTINGS: 'nova:settings',
  CHATS: 'nova:chats',
  ACTIVE_CHAT_ID: 'nova:active-chat-id',
  CUSTOM_MODELS: 'nova:custom-models',
  FAVORITE_MODELS: 'nova:favorite-models',
};

// ── Default settings ──────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  defaultMode: 'chat',
  temperature: 0.7,
  maxTokens: null, // null = provider default
  streaming: true,
  sendOnEnter: true,
  showReasoning: true,
  autoTitle: true,
  enhanceImagePrompts: true,
  systemPromptOverride: '',
};

// ── Limits ────────────────────────────────────────────────────
export const LIMITS = {
  MAX_ATTACHMENTS: 10,
  MAX_FILE_MB: 15,
  TITLE_MAX_CHARS: 60,
};

// ── Accepted file types ───────────────────────────────────────
export const FILE_ACCEPT = {
  imageExts: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.heic'],
  textExts: [
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py',
    '.rb', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.cc', '.cs', '.php',
    '.swift', '.kt', '.sh', '.bash', '.zsh', '.sql', '.html', '.htm', '.css',
    '.scss', '.vue', '.svelte', '.yml', '.yaml', '.xml', '.csv', '.toml',
    '.ini', '.env', '.gitignore', '.dockerfile', '.graphql', '.gql', '.prisma',
  ],
  pdfExts: ['.pdf'],
};

// ── Cheap, fast model used to auto-generate chat titles ───────
export const TITLE_GENERATION_MODEL = 'openai/gpt-4o-mini';

// ── Power modes ───────────────────────────────────────────────
export const MODES = {
  chat: {
    id: 'chat',
    name: 'Chat',
    icon: 'MessageSquare',
    gradient: 'from-violet-500 to-purple-600',
    description: 'General conversation, answers & help',
    defaultModel: 'openai/gpt-5.6-luna',
    temperature: 0.7,
    supportsAttachments: true,
    supportsStreaming: true,
  },
  research: {
    id: 'research',
    name: 'Deep Research',
    icon: 'Microscope',
    gradient: 'from-cyan-500 to-blue-600',
    description: 'Exhaustive, source-backed research reports',
    defaultModel: 'perplexity/sonar-deep-research',
    temperature: 0.3,
    supportsAttachments: true,
    supportsStreaming: true,
  },
  search: {
    id: 'search',
    name: 'Web Search',
    icon: 'Globe',
    gradient: 'from-sky-500 to-cyan-500',
    description: 'Fresh answers grounded in live web results',
    defaultModel: 'perplexity/sonar-pro',
    temperature: 0.3,
    supportsAttachments: true,
    supportsStreaming: true,
  },
  image: {
    id: 'image',
    name: 'Image Gen',
    icon: 'Image',
    gradient: 'from-fuchsia-500 to-pink-600',
    description: 'Generate & edit images from text',
    defaultModel: 'google/gemini-2.5-flash-image-preview',
    temperature: 0.8,
    supportsAttachments: true, // send an image to edit it
    supportsStreaming: false,
  },
  build: {
    id: 'build',
    name: 'Build',
    icon: 'Hammer',
    gradient: 'from-amber-500 to-orange-600',
    description: 'Complete websites, apps, games & full-stack projects',
    defaultModel: 'anthropic/claude-sonnet-5',
    temperature: 0.2,
    supportsAttachments: true,
    supportsStreaming: true,
  },
};

export const MODE_LIST = Object.values(MODES);

// ── System prompts per mode ───────────────────────────────────
export const SYSTEM_PROMPTS = {
  chat: `You are Nova, an elite AI assistant inside Nova AI Studio. You are deeply knowledgeable across software engineering, science, business, and creative work.

Guidelines:
- Be accurate, direct and genuinely helpful. Match the user's language.
- Use rich Markdown: headings, bullet lists, tables, and fenced code blocks with language tags.
- For code: provide complete, runnable implementations following best practices; add comments only where non-obvious.
- If a request is ambiguous, state your assumption briefly and proceed.
- Never invent sources, APIs or facts — say clearly when you are unsure.`,

  research: `You are Nova Deep Research — an elite research analyst. Produce an exhaustive, well-structured research report in Markdown with EXACTLY these sections:

1. **Executive Summary** — 5-8 crisp bullet points
2. **Key Findings** — numbered, each backed by evidence
3. **Detailed Analysis** — logical sections with headings, data, and comparison tables where useful
4. **Landscape / Timeline** — key players, milestones, versions (when relevant)
5. **Risks, Limitations & Open Questions**
6. **Recommendations & Outlook**
7. **Sources** — numbered list of the URLs actually used

Rules:
- Only claim facts supported by search results or well-established knowledge; mark uncertainty explicitly.
- Prefer recent data and include dates. Quantify wherever possible.
- Remain neutral and balanced. Cite sources inline like [1], [2] mapping to the Sources list.`,

  search: `You are Nova with live web access. Answer using the freshest, most relevant web results.

Rules:
- Be concise but complete. Lead with the direct answer.
- Cite claims inline with markdown links like [Source Name](url).
- Prefer primary/authoritative sources; note publication dates.
- If results conflict, say so and present both sides.
- End with a **Sources:** section listing the key links.`,

  image: `You are a world-class prompt engineer for text-to-image models. Transform the user's idea into ONE vivid English image prompt of 40-80 words describing: subject and action, environment, style/medium, lighting, color palette, composition/camera angle, and quality tags.

Return ONLY the prompt text — no quotes, no preamble, no options, no explanations. If the user's prompt is already detailed and explicit, return it lightly polished.`,
};

// Build mode prompt is defined separately (it is long and machine-parsed)
SYSTEM_PROMPTS.build = `You are Nova Build — a principal-level full-stack engineer, UI designer and game developer. You output COMPLETE, production-quality projects as multiple files. NEVER output placeholders, TODOs, "rest of the code here", or truncated files — every file must be full, finished and runnable.

## OUTPUT FORMAT (STRICT — this is machine-parsed)
For EVERY file, output exactly this structure:

### FILE: <relative/path/with/extension>
\`\`\`<language>
<complete file content>
\`\`\`

Rules:
- One "### FILE:" marker + one fenced code block per file. No prose between files.
- Paths are relative to the project root (e.g. index.html, css/style.css, src/main.jsx, server/index.js, package.json).
- After the LAST file, output a run guide starting with:

### RUN
1. ...numbered install/run steps with exact commands...

## PROJECT RULES
1. ALWAYS include: package.json (real, existing dependency versions + npm scripts), .env.example whenever env vars are used, and README.md (features, tech stack, setup, run instructions).
2. Static-first: for games, dashboards, tools, landing pages and demos, prefer ONE self-contained index.html (vanilla JS or CDN libraries such as Tailwind CDN, Three.js, Chart.js) so it can be previewed instantly in-app.
3. Full-stack apps: structure as client/ + server/ (Node.js + Express). Include a database layer (better-sqlite3 with schema + seed, or an in-memory store), REST API with validation and error handling, CORS configured, and scripts that run both client and server with one command. Keep the client usable even when the server is optional where possible.
4. UI quality bar: modern, beautiful, mobile-first responsive, smooth micro-interactions, accessible (semantic HTML, labels, contrast, keyboard support), with loading, empty and error states. Dark-mode friendly by default.
5. Games: requestAnimationFrame loop, polished game feel (easing, particles, screen shake, score popups), WebAudio sound effects (no external audio files), keyboard + touch controls, start / pause / game-over / restart screens, local high scores.
6. Security: never hardcode secrets — read from process.env. Validate and sanitize all user input on the server. Escape any user-generated HTML.
7. If the request is under-specified, pick sensible modern defaults and BUILD — do not ask clarifying questions. State key assumptions in the README.
8. Always finish: the project must run end-to-end exactly as documented in the RUN section.`;

// ── Project-builder parse markers (used by Batch 2 project.js) ─
export const PROJECT = {
  FILE_MARKER: '### FILE:',
  RUN_MARKER: '### RUN',
};

// ── Capability badges metadata ────────────────────────────────
export const CAPABILITY_META = {
  vision: { label: 'Vision' },
  reasoning: { label: 'Reasoning' },
  webSearch: { label: 'Live Web' },
  imageGen: { label: 'Images' },
  tools: { label: 'Tools' },
  code: { label: 'Code' },
};

// ── Welcome-screen suggestions ────────────────────────────────
export const SUGGESTED_PROMPTS = [
  {
    icon: 'Rocket',
    label: 'Build a full-stack app',
    prompt:
      'Build a complete full-stack task management web app: Node.js + Express + SQLite backend with JWT auth and full CRUD REST APIs, and a modern React frontend with a drag & drop project board, dark mode and search. Include all files, seeds and run instructions.',
  },
  {
    icon: 'Globe',
    label: 'Deep research a topic',
    prompt:
      'Do deep research on the state of AI agents in 2026: key players, leading frameworks, benchmarks, real-world adoption, and where the field is heading in the next 24 months. Include a sources list.',
  },
  {
    icon: 'Gamepad2',
    label: 'Create a polished game',
    prompt:
      'Build a polished single-file browser game: Neon Snake with power-ups, particle effects, WebAudio sounds, screen shake, touch controls, local high scores and a slick start/game-over UI. One index.html, instantly playable.',
  },
  {
    icon: 'Image',
    label: 'Generate an image',
    prompt:
      'A futuristic city at dusk, neon reflections on rain-wet streets, flying vehicles with light trails, cinematic wide-angle composition, ultra detailed, volumetric lighting, 4k',
  },
  {
    icon: 'Code2',
    label: 'Architect a SaaS',
    prompt:
      'Design and build the foundation of a multi-tenant SaaS starter: Express + PostgreSQL-style data layer with in-memory fallback, JWT auth with refresh tokens, role-based access, rate limiting, and a React client with login/signup/dashboard. Full files + README.',
  },
];