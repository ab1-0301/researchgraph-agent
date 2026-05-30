const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ToolRegistry = require('./tools/tool-registry');
const { ExecutionEngine } = require('./tools/execution-engine');

const app = express();
const port = process.env.PORT || 3000;

app.set('json spaces', 2);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// ── Provider Config ─────────────────────────────────────────
function getProviderConfig() {
  const provider = process.env.API_PROVIDER || 'gmi';
  if (provider === 'local') {
    return {
      provider: 'local',
      apiBaseUrl: process.env.LOCAL_API_BASE_URL || 'http://127.0.0.1:11434',
      modelName: process.env.LOCAL_MODEL_NAME || 'qwen2.5:7b'
    };
  }
  return {
    provider: 'gmi',
    apiKey: process.env.GMI_API_KEY || process.env.API_KEY,
    apiBaseUrl: process.env.GMI_API_BASE_URL || process.env.API_BASE_URL || 'https://api.gmi-serving.com',
    modelName: process.env.GMI_MODEL_NAME || process.env.MODEL_NAME || 'deepseek-ai/DeepSeek-V4-Pro'
  };
}

// ── System Prompts ──────────────────────────────────────────
const systemPrompt = `You are ResearchGraph Agent. Analyze the user's academic text and return JSON with:
- concepts: [{id, name, definition, importance(1-5), category}]
- relationships: [{source, target, relationship(eg includes, depends_on, causes, contrasts_with), description}]
- agentReport: {summary, insights:[], gaps:[], actions:[], studyPlan:["0-10min step","10-20min step","20-30min step"], seminarQuestions:[], presentationOutline:[]}

Rules: Extract 5-15 concepts with accurate ids used by relationships. importance=5 for core topics, 3-4 for subtopics, 1-2 for supporting. If Chinese source, reply in Chinese; otherwise English.`;

const chatSystemPrompt = `You are ResearchGraph Agent, an AI research assistant for overseas students and researchers. The user has already uploaded material and received an analysis with concepts, relationships, and an agent report. Now they want to follow up with questions.

You have access to the original analysis context (concepts, relationships, report summary). Answer the user's follow-up questions based on that context. Be specific, cite concepts from the analysis when relevant, and keep answers concise (2-4 sentences unless the user asks for detail).

If the user asks to expand on a concept, provide a deeper explanation with examples.
If the user asks for a different angle, reframe the analysis accordingly.
If the user asks in Chinese, reply in Chinese; otherwise reply in English.`;

const deepDiveSystemPrompt = `You are ResearchGraph Agent's Deep Dive mode. The user struggled with a specific concept and needs deeper learning material.

Analyze the concept and the original context, then return deepening material in strict JSON:

{
  "subConcepts": [
    { "name": "sub concept name", "definition": "clear definition", "example": "concrete example" }
  ],
  "analogy": "A relatable everyday analogy that helps understand this concept",
  "prerequisites": ["prerequisite knowledge item 1", "prerequisite knowledge item 2"],
  "contrasts": [
    { "otherConcept": "related concept name", "difference": "how they differ" }
  ]
}

For layer 1 (first deepening): focus on subConcepts (2-4), 1 analogy, 2-3 prerequisites, 1-2 contrasts.
For layer 2 (second deepening): also include argumentChain (3-6 steps) and applicationScenarios (2-3 scenarios).

If the source text is Chinese, answer in Chinese; otherwise answer in English.`;

// ── Helpers ─────────────────────────────────────────────────
function parseAIContent(content) {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const data = JSON.parse(cleaned);

  if (!Array.isArray(data.concepts) || !Array.isArray(data.relationships)) {
    throw new Error('AI返回格式不完整');
  }

  const conceptIds = new Set(data.concepts.map((concept) => concept.id));
  data.relationships = data.relationships.filter((relationship) => (
    conceptIds.has(relationship.source) && conceptIds.has(relationship.target)
  ));

  if (!data.agentReport) {
    data.agentReport = {
      summary: `ResearchGraph Agent extracted ${data.concepts.length} concepts and ${data.relationships.length} relationships from the material.`,
      insights: data.concepts.slice(0, 3).map((concept) => `${concept.name} is a key concept in this material.`),
      gaps: ['Review isolated concepts and add missing definitions or examples.'],
      actions: ['Use the graph to explain the material structure, then prepare follow-up questions.']
    };
  }

  data.agentReport.studyPlan ||= [
    '0-10 min: Review the central concepts and definitions.',
    '10-20 min: Explain the strongest relationships in the graph.',
    '20-30 min: Convert gaps into discussion or reading questions.'
  ];
  data.agentReport.seminarQuestions ||= ['What concept or relationship is most important for discussion?'];
  data.agentReport.presentationOutline ||= [
    'Main learning problem',
    'Concept map and key relationships',
    'Learning gaps and next actions'
  ];

  return data;
}


// ── Content Extractor ──────────────────────────────────────
function extractContent(data) {
  // Responses API format (local_deepseek)
  if (data.output?.[0]?.content?.[0]?.text) {
    return data.output[0].content[0].text;
  }
  // Chat Completions format (OpenAI / GMI)
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  throw new Error('Unrecognized API response format');
}

async function callAI(text, systemPromptOverride) {
  const config = getProviderConfig();
  const prompt = systemPromptOverride || systemPrompt;

  if (config.provider === 'local') {
    // Ollama local API
    const response = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        stream: false
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.error || '本地模型调用失败');
    }
    return parseAIContent(extractContent(data));
  }

  // GMI Cloud API
  if (!config.apiKey) throw new Error('服务端未配置 GMI_API_KEY');

  const response = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ResearchGraph-Agent/1.0',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 4096
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[GMI] API error:', response.status, JSON.stringify(data).slice(0,300));
    throw new Error(data.error?.message || data.error || 'API调用失败');
  }

  const result = extractContent(data);
  if (!result || result.trim().length < 10) {
    console.error('[GMI] Empty response, raw:', JSON.stringify(data).slice(0,400));
    throw new Error('GMI返回空内容，可能reasoning消耗了全部token');
  }

  return parseAIContent(result);
}

// ── Tool Registry ───────────────────────────────────────────
const registry = new ToolRegistry();

registry.register('parseFile', {
  description: 'Parse uploaded files (PDF, DOCX, PPTX, TXT, images) and extract text content. Runs client-side.',
  inputSchema: { file: 'File object from browser' },
  outputSchema: { text: 'Extracted text string' },
  boundaries: '20MB max file size. .doc and .ppt old formats not supported. Scanned PDFs need OCR fallback.',
  handler: async (ctx) => ({ text: ctx.text || '' }),
  runLocation: 'client'
});

registry.register('extractOntology', {
  description: 'Extract core concepts and their relationships from text using GMI Cloud inference. Falls back to empty result (frontend uses local rules).',
  inputSchema: { text: 'Source text to analyze (max 8000 chars)' },
  outputSchema: { concepts: 'Array of concept objects', relationships: 'Array of relationship objects', agentReport: 'Full agent report', needsFallback: 'boolean — true when GMI unavailable, frontend should use local rules' },
  boundaries: 'Max 8000 chars. Quality depends on text clarity. GMI auth required for online mode.',
  handler: async (ctx) => {
    const text = ctx.ingest?.text || ctx.text || '';
    if (!text) throw new Error('No text to analyze');
    try {
      return await callAI(text);
    } catch (err) {
      console.warn('GMI unavailable, returning fallback placeholder:', err.message);
      return { concepts: [], relationships: [], agentReport: null, needsFallback: true };
    }
  },
  retryConfig: { maxRetries: 2, baseDelayMs: 1500 }
});

registry.register('generateReport', {
  description: 'Extract and format the agent report from the ontology extraction results.',
  inputSchema: { reason: 'Output from extractOntology tool' },
  outputSchema: { agentReport: 'Structured report with summary, insights, gaps, actions, studyPlan, seminarQuestions, presentationOutline', needsFallback: 'boolean' },
  boundaries: 'Report quality depends on concept extraction quality. Falls back to placeholder when GMI unavailable.',
  handler: async (ctx) => {
    const reasonResult = ctx.reason;
    if (!reasonResult) throw new Error('No reasoning result available for report generation');
    if (reasonResult.needsFallback) {
      return { agentReport: null, needsFallback: true };
    }
    return { agentReport: reasonResult.agentReport };
  }
});

registry.register('chatFollowup', {
  description: 'Handle multi-turn follow-up questions about the analysis results.',
  inputSchema: { messages: 'Chat history array', context: 'Analysis context with concepts, relationships, summary' },
  outputSchema: { reply: 'Agent response text' },
  boundaries: 'Session-scoped only. Falls back to local rules when GMI unavailable.',
  handler: async (ctx) => {
    const config = getProviderConfig();
    if (!config.apiKey) throw new Error('GMI API key not configured');

    const contextSummary = ctx.context
      ? `Original analysis context:\nConcepts: ${(ctx.context.concepts || []).map(c => c.name).join(', ')}\nKey relationships: ${(ctx.context.relationships || []).slice(0, 5).map(r => `${r.source} → ${r.relationship} → ${r.target}`).join('; ')}\nReport summary: ${ctx.context.summary || 'N/A'}\n`
      : '';

    const response = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ResearchGraph-Agent/1.0',
      Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: chatSystemPrompt + '\n\n' + contextSummary },
          ...(ctx.messages || [])
        ],
        temperature: 0.4
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.error || data.message || 'API调用失败');
    }
    return { reply: extractContent(data) };
  },
  runLocation: 'server'
});

registry.register('deepDive', {
  description: 'Deep-dive analysis on a specific concept the user struggled with. Generates sub-concepts, analogies, prerequisites, contrasts, and (for deeper layers) argument chains and application scenarios.',
  inputSchema: { conceptName: 'string', originalContext: 'string', layer: 'number (1 or 2)' },
  outputSchema: { subConcepts: 'array', analogy: 'string', prerequisites: 'array', contrasts: 'array', argumentChain: 'array (layer >= 2)', applicationScenarios: 'array (layer >= 2)' },
  boundaries: 'Concept must exist in the original analysis. Layer max is 2.',
  handler: async (ctx) => {
    const { conceptName, originalContext, layer = 1 } = ctx;
    if (!conceptName) throw new Error('Concept name is required');

    const config = getProviderConfig();
    if (!config.apiKey) throw new Error('GMI API key not configured');

    const prompt = `Concept to deepen: "${conceptName}"
Original material context: "${(originalContext || '').slice(0, 1500)}"
Deepening layer: ${layer} ${layer === 1 ? '(first deepening: sub-concepts, analogy, prerequisites, contrasts)' : '(second deepening: include argument chain and application scenarios)'}

${deepDiveSystemPrompt}`;

    const response = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ResearchGraph-Agent/1.0',
      Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Please deepen my understanding of "${conceptName}" at layer ${layer}.` }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.error || 'Deep dive API call failed');
    }
    const result = JSON.parse(
      extractContent(data).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    );
    return {
      subConcepts: result.subConcepts || [],
      analogy: result.analogy || '',
      prerequisites: result.prerequisites || [],
      contrasts: result.contrasts || [],
      argumentChain: result.argumentChain || [],
      applicationScenarios: result.applicationScenarios || []
    };
  },
  retryConfig: { maxRetries: 1, baseDelayMs: 1500 }
});

// ── Execution Engine ────────────────────────────────────────
const engine = new ExecutionEngine(registry);

// ── Routes ──────────────────────────────────────────────────

// Provider status (unchanged)
app.get('/api/provider', (req, res) => {
  const config = getProviderConfig();
  res.json({
    provider: config.provider,
    baseUrlConfigured: Boolean(config.apiBaseUrl),
    model: config.modelName,
    tokenConfigured: Boolean(config.apiKey),
    tokenHint: config.apiKey ? config.apiKey.slice(-8) : null
  });
});

// Backward-compatible extract (unchanged external contract)
app.post('/api/extract', async (req, res) => {
  try {
    const { text, accessCode = '' } = req.body;

    if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: '访问码不正确' });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供要分析的文本' });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: '文本过长，请控制在8000字以内' });
    }

    const result = await callAI(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// Backward-compatible chat (unchanged)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, context, accessCode = '' } = req.body;

    if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: '访问码不正确' });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '请提供对话消息' });
    }

    try {
      const result = await registry.call('chatFollowup', { messages, context });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// NEW: Execute pipeline
app.post('/api/execute', async (req, res) => {
  try {
    const { jobType = 'analyze', text, accessCode = '' } = req.body;

    if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: '访问码不正确' });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供要分析的文本' });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: '文本过长，请控制在8000字以内' });
    }

    const jobId = engine.createJob(jobType, { text });

    // Run asynchronously (don't await — frontend polls)
    engine.runJob(jobId, { ingest: { text }, text }).catch(err => {
      console.error(`[job ${jobId}] pipeline error:`, err.message);
    });

    res.json({ jobId, status: 'running' });
  } catch (error) {
    res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// NEW: Job status
app.get('/api/status/:jobId', (req, res) => {
  const status = engine.getStatus(req.params.jobId);
  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(status);
});

// NEW: Job result
app.get('/api/result/:jobId', (req, res) => {
  const result = engine.getResult(req.params.jobId);
  if (!result) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(result);
});

// NEW: Tool schemas (for debugging/demo)
app.get('/api/tools', (req, res) => {
  res.json(registry.getAllSchemas());
});

// NEW: Deep dive
app.post('/api/deepdive', async (req, res) => {
  try {
    const { conceptName, conceptId, originalContext, layer = 1, accessCode = '' } = req.body;

    if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: '访问码不正确' });
    }
    if (!conceptName || typeof conceptName !== 'string') {
      return res.status(400).json({ error: '请提供概念名称' });
    }

    const result = await registry.call('deepDive', { conceptName, originalContext, layer: Math.min(layer, 2) });
    res.json(result);
  } catch (error) {
    console.error('[deepdive] error:', error.message);
    res.status(500).json({ error: error.message || '加深分析失败' });
  }
});

// ── Start ───────────────────────────────────────────────────
if (require.main === module) {
  app.listen(port, () => {
    console.log(`ResearchGraph Agent running at http://localhost:${port}`);
    console.log(`  Tools registered: ${registry.list().join(', ')}`);
    console.log(`  Endpoints: /api/extract /api/execute /api/status/:id /api/result/:id /api/chat /api/tools`);
  });
}

module.exports = app;