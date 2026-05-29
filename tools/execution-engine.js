const crypto = require('crypto');

const ANALYZE_PIPELINE = [
  { id: 'ingest',  label: '解析文件',         tool: 'parseFile',        progress: 10 },
  { id: 'reason',  label: '提取概念与关系',    tool: 'extractOntology',  progress: 60 },
  { id: 'report',  label: '生成 Agent 报告',   tool: 'generateReport',   progress: 85 },
  { id: 'render',  label: '渲染图谱',          tool: 'renderGraph',      progress: 95 },
  { id: 'done',    label: '完成',              tool: null,               progress: 100 },
];

class ExecutionEngine {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.jobs = new Map();
  }

  createJob(type, input) {
    const id = crypto.randomUUID();
    const pipeline = type === 'analyze' ? ANALYZE_PIPELINE : [];
    const steps = pipeline.map(s => ({
      id: s.id,
      label: s.label,
      tool: s.tool,
      targetProgress: s.progress,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      retries: 0,
      error: null
    }));
    const job = {
      id,
      type,
      status: 'running',
      steps,
      currentStep: null,
      currentStepIndex: 0,
      totalSteps: steps.length,
      progress: 0,
      log: [],
      result: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    this._addLog(job, 'info', `Job created: ${type}`);
    return id;
  }

  async runJob(jobId, sharedContext = {}) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    try {
      for (let i = 0; i < job.steps.length; i++) {
        const step = job.steps[i];
        if (step.id === 'done') {
          step.status = 'completed';
          job.currentStep = null;
          job.currentStepIndex = i;
          job.progress = 100;
          job.status = 'done';
          this._addLog(job, 'info', 'Pipeline complete');
          break;
        }

        if (!step.tool) {
          step.status = 'completed';
          step.completedAt = new Date().toISOString();
          this._addLog(job, 'info', `Step skipped (no tool): ${step.label}`);
          continue;
        }

        if (!this.toolRegistry.has(step.tool)) {
          step.status = 'completed';
          step.completedAt = new Date().toISOString();
          this._addLog(job, 'warn', `Tool not registered, skipping: ${step.tool}`);
          continue;
        }

        job.currentStep = step.id;
        job.currentStepIndex = i;
        this._updateJob(job, step);

        step.status = 'running';
        step.startedAt = new Date().toISOString();
        this._addLog(job, 'info', `Running: ${step.label}`);

        try {
          const result = await this._executeWithRetry(step, job, sharedContext);
          step.status = 'completed';
          step.completedAt = new Date().toISOString();
          sharedContext[step.id] = result;
          job.progress = step.targetProgress;
          this._addLog(job, 'info', `Completed: ${step.label}`);
        } catch (err) {
          step.status = 'failed';
          step.error = err.message;
          this._addLog(job, 'error', `Failed: ${step.label} — ${err.message}`);
          job.status = 'failed';
          job.result = { error: err.message };
          return;
        }

        this._updateJob(job, step);
      }
    } catch (err) {
      job.status = 'failed';
      job.result = { error: err.message };
      this._addLog(job, 'error', `Pipeline error: ${err.message}`);
    }

    if (job.status === 'done') {
      job.result = sharedContext;
    }
  }

  async _executeWithRetry(step, job, sharedContext) {
    const tool = this.toolRegistry.get(step.tool);
    const maxRetries = tool.retryConfig.maxRetries || 3;
    const baseDelay = tool.retryConfig.baseDelayMs || 1000;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        step.retries = attempt;
        return await this.toolRegistry.call(step.tool, sharedContext);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          this._addLog(job, 'warn', `Retry ${attempt + 1}/${maxRetries} for ${step.label} after ${delay}ms: ${err.message}`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError || new Error(`Max retries (${maxRetries}) exceeded for ${step.label}`);
  }

  getStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return {
      jobId: job.id,
      type: job.type,
      status: job.status,
      currentStep: job.currentStep,
      currentStepIndex: job.currentStepIndex,
      totalSteps: job.totalSteps,
      progress: job.progress,
      steps: job.steps.map(s => ({
        id: s.id,
        label: s.label,
        status: s.status,
        retries: s.retries,
        error: s.error
      })),
      log: job.log.slice(-20),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  getResult(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return {
      jobId: job.id,
      status: job.status,
      data: job.status === 'done' ? job.result : null,
      error: job.status === 'failed' ? job.result?.error : null,
    };
  }

  _updateJob(job, step) {
    job.updatedAt = new Date().toISOString();
    job.progress = step.targetProgress || job.progress;
  }

  _addLog(job, level, message) {
    job.log.push({ time: new Date().toISOString(), level, message });
  }

  cleanup(maxAgeMs = 30 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of this.jobs) {
      if (new Date(job.createdAt).getTime() < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}

module.exports = { ExecutionEngine, ANALYZE_PIPELINE };