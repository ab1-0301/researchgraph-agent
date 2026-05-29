class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(name, config) {
    if (!name || typeof name !== 'string') throw new Error('Tool name is required');
    if (!config.handler || typeof config.handler !== 'function') throw new Error(`Tool ${name}: handler must be a function`);
    this.tools.set(name, {
      name,
      description: config.description || '',
      inputSchema: config.inputSchema || {},
      outputSchema: config.outputSchema || {},
      boundaries: config.boundaries || 'No explicit boundaries defined.',
      handler: config.handler,
      retryConfig: config.retryConfig || { maxRetries: 3, baseDelayMs: 1000 },
      runLocation: config.runLocation || 'server'
    });
    return this;
  }

  get(name) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return [...this.tools.keys()];
  }

  getSchema(name) {
    const tool = this.get(name);
    return {
      name: tool.name,
      description: tool.description,
      input: tool.inputSchema,
      output: tool.outputSchema,
      boundaries: tool.boundaries,
      runLocation: tool.runLocation
    };
  }

  getAllSchemas() {
    return [...this.tools.keys()].map(name => this.getSchema(name));
  }

  async call(name, input) {
    const tool = this.get(name);
    return tool.handler(input);
  }
}

module.exports = ToolRegistry;