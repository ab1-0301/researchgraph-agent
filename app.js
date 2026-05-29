// 本体论笔记助手 - 核心逻辑
class OntologyNoteHelper {
    constructor() {
        this.cy = null;
        this.currentData = null;
        this.chatHistory = [];
        this.chatLoading = false;
        this.settings = this.loadSettings();
        this.ankiEngine = typeof AnkiEngine !== 'undefined' ? new AnkiEngine() : null;
        this.pendingDeepDives = [];
        this.studyQuizAnswers = {};
        this.studyGoals = {};
        this.init();
    }

    init() {
        this.initPaneSwitching();
        this.initCytoscape();
        this.initStudyReview();
        this.initAnkiEvents();
        this.bindEvents();
        this.loadSettingsToUI();
        this.refreshReviewStats();
        this._renderHistoryList();
    }

    initPaneSwitching() {
        const switchPane = (id) => {
            document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
            document.getElementById(id)?.classList.add('active');
            document.querySelectorAll('.sidebar-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.pane === id);
            });
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.pane === id);
            });

            // 切换到图谱面板时自动适配
            if (id === 'graph-pane') {
                setTimeout(() => {
                    if (this.cy && this.cy.nodes().length > 0) {
                        this.cy.fit(50);
                    } else if (this.currentData && this.cy) {
                        this.cy.fit(50);
                    }
                }, 100);
            }
        };
        document.querySelectorAll('.sidebar-btn[data-pane]').forEach(btn => {
            btn.addEventListener('click', () => switchPane(btn.dataset.pane));
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchPane(btn.dataset.pane));
        });
        // auto-switch to chat pane when sendChat is triggered
        this._switchToChat = () => switchPane('chat-pane');
    }

    // 初始化图谱
    initCytoscape() {
        if (!window.cytoscape) {
            const emptyState = document.getElementById('emptyState');
            emptyState.innerHTML = `
                <i class="fa fa-exclamation-triangle text-4xl mb-4 text-yellow-400"></i>
                <p class="text-sm text-yellow-200">图谱可视化库加载失败</p>
                <p class="text-xs mt-1 opacity-70">请刷新页面，或检查浏览器是否拦截 CDN 脚本。</p>
            `;
            return;
        }

        this.cy = cytoscape({
            container: document.getElementById('cy'),
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'background-opacity': 0.92,
                        'label': 'data(label)',
                        'color': '#f8fafc',
                        'font-size': (ele) => ele.data('importance') >= 5 ? '13px' : '11px',
                        'font-weight': (ele) => ele.data('importance') >= 4 ? '700' : '500',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'width': (ele) => 34 + (ele.data('importance') || 1) * 12,
                        'height': (ele) => 34 + (ele.data('importance') || 1) * 12,
                        'border-width': (ele) => ele.data('isGap') ? 4 : ele.data('importance') >= 5 ? 3 : 2,
                        'border-color': (ele) => ele.data('isGap') ? '#fbbf24' : '#e2e8f0',
                        'border-opacity': 0.85,
                        'shadow-blur': (ele) => ele.data('importance') >= 4 || ele.data('isGap') ? 18 : 8,
                        'shadow-color': 'data(color)',
                        'shadow-opacity': 0.45,
                        'shadow-offset-x': 0,
                        'shadow-offset-y': 0,
                        'text-wrap': 'wrap',
                        'text-max-width': 92,
                        'text-outline-width': 2,
                        'text-outline-color': '#0f172a'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': (ele) => ele.data('isActionPath') ? 4 : 2,
                        'line-color': 'data(color)',
                        'target-arrow-color': 'data(color)',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'label': 'data(relationship)',
                        'font-size': (ele) => ele.data('isActionPath') ? '11px' : '9px',
                        'font-weight': (ele) => ele.data('isActionPath') ? '700' : '500',
                        'color': '#cbd5e1',
                        'text-background-color': '#0f172a',
                        'text-background-opacity': 0.75,
                        'text-background-padding': 3,
                        'text-rotation': 'autorotate',
                        'text-margin-y': -11,
                        'line-style': (ele) => ele.data('isActionPath') ? 'solid' : 'dashed',
                        'opacity': (ele) => ele.data('isActionPath') ? 0.95 : 0.72
                    }
                },
                {
                    selector: ':selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#f59e0b',
                        'line-color': '#f59e0b',
                        'target-arrow-color': '#f59e0b',
                        'transition-property': 'border-width, border-color',
                        'transition-duration': '0.3s'
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 1000,
                nodeRepulsion: 4000,
                nodeOverlap: 20,
                idealEdgeLength: 100,
                edgeElasticity: 100,
                padding: 30
            }
        });

        // 节点点击事件
        this.cy.on('tap click', 'node', (e) => {
            console.log('Node clicked:', e.target.id());
            this.showNodeInfo(e.target);
        });
        this.cy.on('tap click', 'edge', (e) => {
            console.log('Edge clicked');
            this.showEdgeInfo(e.target);
        });

        // 边点击事件
        this.cy.on('tap click', 'edge', (e) => {
            this.showEdgeInfo(e.target);
        });

        // 点击空白处清除选中
        this.cy.on('tap', (e) => {
            if (e.target === this.cy) {
                this.cy.elements().unselect();
            }
        });
    }

    // 绑定事件
    bindEvents() {
        // 设置相关
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.add('show');
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('show');
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
            document.getElementById('settingsModal').classList.remove('show');
        });

        // 帮助相关
        document.getElementById('helpBtn').addEventListener('click', () => {
            document.getElementById('helpModal').classList.add('show');
        });

        document.getElementById('closeHelp').addEventListener('click', () => {
            document.getElementById('helpModal').classList.remove('show');
        });

        // 输入区域
        const noteInput = document.getElementById('noteInput');
        noteInput.addEventListener('input', () => {
            document.getElementById('charCount').textContent = noteInput.value.length;
        });

        // 清空按钮
        document.getElementById('clearBtn').addEventListener('click', () => {
            noteInput.value = '';
            document.getElementById('charCount').textContent = '0';
            this.clearGraph();
        });

        // 示例按钮
        document.getElementById('exampleBtn').addEventListener('click', () => {
            noteInput.value = this.getExampleText();
            document.getElementById('charCount').textContent = noteInput.value.length;
        });

        // 提取按钮
        document.getElementById('extractBtn')?.addEventListener('click', () => this.extractOntology());

        // 演示按钮
        document.getElementById('demoBtnInPane')?.addEventListener('click', () => this.runDemo());

        // 学习模式按钮
        document.getElementById('learnModeBtn')?.addEventListener('click', () => this._startGuidedLearning());

        // 追问面板
        document.getElementById('chatSendBtn').addEventListener('click', () => this.sendChat());
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
        });
        document.querySelectorAll('.chat-suggest').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('chatInput').value = btn.dataset.suggest;
                this.sendChat();
            });
        });

        // 追问区文件上传
        const chatFileInput = document.getElementById('chatFileInput');
        const chatDropZone = document.getElementById('chatDropZone');
        if (chatFileInput && chatDropZone) {
            chatFileInput.addEventListener('change', (e) => this.handleChatFileSelect(e.target.files[0]));
            chatDropZone.addEventListener('dragover', (e) => { e.preventDefault(); chatDropZone.classList.add('border-primary'); });
            chatDropZone.addEventListener('dragleave', () => { chatDropZone.classList.remove('border-primary'); });
            chatDropZone.addEventListener('drop', (e) => { e.preventDefault(); chatDropZone.classList.remove('border-primary'); this.handleChatFileSelect(e.dataTransfer.files[0]); });
        }

        // 图谱控制
        document.getElementById('fitBtn').addEventListener('click', () => {
            if (!this.cy) {
                this.showToast('图谱库尚未加载，请刷新页面重试');
                return;
            }
            this.cy.fit(50);
        });

        document.getElementById('resetLayoutBtn').addEventListener('click', () => {
            if (!this.cy) {
                this.showToast('图谱库尚未加载，请刷新页面重试');
                return;
            }
            this.relayout();
        });

        // 导出按钮
        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            this.exportJson();
        });

        document.getElementById('exportImgBtn').addEventListener('click', () => {
            this.exportImage();
        });

        const fileInput = document.getElementById('fileInput');
        const dropZone = document.getElementById('dropZone');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-primary');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-primary');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
            this.handleFileSelect(e.dataTransfer.files[0]);
        });

        // 点击模态框外部关闭
        ['settingsModal', 'helpModal'].forEach(id => {
            document.getElementById(id).addEventListener('click', (e) => {
                if (e.target.id === id) {
                    e.target.classList.remove('show');
                }
            });
        });

        // 全局快捷键
        document.addEventListener('keydown', (e) => {
            const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (isInput && document.activeElement.id === 'chatInput') {
                    this.sendChat();
                } else {
                    this.extractOntology();
                }
            }
            if (e.key === 'Escape' && !isInput) {
                document.getElementById('settingsModal').classList.remove('show');
                document.getElementById('helpModal').classList.remove('show');
                document.getElementById('conceptPanel').classList.add('hidden');
            }
        });

        // Markdown 导出按钮
        document.getElementById('exportMdBtn').addEventListener('click', () => {
            this.exportMarkdown();
        });

        // 概念筛选标签点击（报告面板中的普通概念/扩展概念）
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.concept-filter');
            if (!target || !this.currentData) return;
            const filter = target.dataset.filter || '';
            const concepts = this.currentData.concepts || [];
            let filtered = [];
            if (filter.startsWith('imp-')) {
                const level = parseInt(filter.replace('imp-', ''));
                filtered = concepts.filter(c => c.importance === level);
            } else if (filter.startsWith('cat-')) {
                const cat = filter.replace('cat-', '');
                filtered = concepts.filter(c => c.category === cat);
            }
            if (filtered.length > 0) {
                const names = filtered.map(c => c.name).join('、');
                this.showToast(`筛选：共 ${filtered.length} 个概念 — ${names.slice(0, 60)}${names.length > 60 ? '...' : ''}`);
            }
        });
    }

    async handleFileSelect(file) {
        if (!file) return;

        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showLimitDialog('文件过大', '当前仅支持上传 20MB 以内的文件。请压缩文件或拆分内容后再上传。');
            return;
        }

        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.ppt')) {
            this.showLimitDialog('暂不支持 .ppt 旧格式', '请在 PowerPoint/WPS 中将文件另存为 .pptx 格式后重新上传。');
            return;
        }
        if (lowerName.endsWith('.doc')) {
            this.showLimitDialog('暂不支持 .doc 旧格式', '请在 Word/WPS 中将文件另存为 .docx 格式后重新上传。');
            return;
        }

        this.showFileInfo(`正在解析：${file.name}`);
        this.showStatus('正在读取文件内容...');

        try {
            const text = await this.extractTextFromFile(file);
            if (!text.trim()) {
                this.showLimitDialog('没有提取到文字', '如果这是扫描版 PDF，浏览器无法直接读取其中的文字。建议将页面截图后以图片形式上传，使用 OCR 识别。');
                throw new Error('未能从文件中提取到文字');
            }

            const noteInput = document.getElementById('noteInput');
            noteInput.value = text.trim();
            document.getElementById('charCount').textContent = noteInput.value.length;
            this.showFileInfo(`已导入：${file.name}，提取 ${noteInput.value.length} 个字符`);
            this.showStatus('文件解析完成，可生成知识图谱', false);
            this.hideStatus();
        } catch (error) {
            console.error('文件解析失败:', error);
            this.showFileInfo(`解析失败：${error.message}`);
            document.getElementById('statusBar').classList.add('hidden');
            this.showToast('文件解析失败：' + error.message);
        }
    }

    // 追问区文件上传
    async handleChatFileSelect(file) {
        if (!file) return;
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.ppt')) { this.showLimitDialog('暂不支持 .ppt 旧格式', '请另存为 .pptx 后上传。'); return; }
        if (lowerName.endsWith('.doc')) { this.showLimitDialog('暂不支持 .doc 旧格式', '请另存为 .docx 后上传。'); return; }

        const infoEl = document.getElementById('chatFileInfo');
        if (infoEl) { infoEl.classList.remove('hidden'); infoEl.textContent = `正在解析：${file.name}...`; }

        try {
            const text = await this.extractTextFromFile(file);
            if (!text.trim()) {
                this.showLimitDialog('没有提取到文字', '扫描版 PDF 建议截图后用图片 OCR。');
                return;
            }
            if (infoEl) infoEl.textContent = `已导入：${file.name}（${text.length} 字符）`;

            // 如果已有分析结果，自动触发追问
            const noteInput = document.getElementById('noteInput');
            if (noteInput) noteInput.value = text;
            if (this.currentData) {
                document.getElementById('chatInput').value = `我刚上传了「${file.name}」，请基于这份新材料继续分析。`;
                this.sendChat();
            } else {
                document.getElementById('chatInput').value = text;
                this.showToast('文件已导入，点击 Run Agent Analysis 进行分析');
                if (this._switchToChat) this._switchToChat();
            }
        } catch (error) {
            console.warn('追问区文件解析失败:', error);
            if (infoEl) infoEl.textContent = `解析失败：${error.message}`;
            this.showToast('文件解析失败');
        }
    }

    showFileInfo(message) {
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.classList.remove('hidden');
        fileInfo.textContent = message;
    }

    showLimitDialog(title, message) {
        const dialog = document.createElement('div');
        dialog.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4';
        dialog.innerHTML = `
            <div class="bg-slate-800 border border-amber-500/30 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                        <i class="fa fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-white">${title}</h3>
                        <p class="text-sm text-gray-300 mt-2 leading-6">${message}</p>
                    </div>
                </div>
                <button class="w-full gradient-bg py-2 rounded-lg font-medium hover:opacity-90 transition">知道了</button>
            </div>
        `;
        dialog.querySelector('button').addEventListener('click', () => dialog.remove());
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.remove();
        });
        document.body.appendChild(dialog);
    }

    async extractTextFromFile(file) {
        const name = file.name.toLowerCase();
        const type = file.type;

        if (name.endsWith('.txt') || name.endsWith('.md') || type.startsWith('text/')) {
            return await file.text();
        }

        if (name.endsWith('.pdf') || type === 'application/pdf') {
            return await this.extractPdfText(file);
        }

        if (name.endsWith('.docx')) {
            return await this.extractDocxText(file);
        }

        if (name.endsWith('.pptx')) {
            return await this.extractPptxText(file);
        }

        if (type.startsWith('image/') || /\.(png|jpg|jpeg)$/i.test(name)) {
            return await this.extractImageText(file);
        }

        if (name.endsWith('.ppt')) {
            throw new Error('暂不支持 .ppt 旧格式，请另存为 .pptx 后上传');
        }

        if (name.endsWith('.doc')) {
            throw new Error('暂不支持 .doc 旧格式，请另存为 .docx 后上传');
        }

        throw new Error('暂不支持该文件类型');
    }

    async extractPdfText(file) {
        const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs';
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const pages = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            pages.push(content.items.map((item) => item.str).join(' '));
        }

        return pages.join('\n\n');
    }

    async extractDocxText(file) {
        if (!window.mammoth) throw new Error('Word 解析库加载失败，请刷新页面重试');
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    async extractPptxText(file) {
        if (!window.JSZip) throw new Error('PPTX 解析库加载失败，请刷新页面重试');
        const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
        const slideFiles = Object.keys(zip.files)
            .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
            .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));

        const slides = [];
        for (const path of slideFiles) {
            const xml = await zip.files[path].async('text');
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const texts = [...doc.getElementsByTagName('a:t')].map((node) => node.textContent).filter(Boolean);
            if (texts.length) slides.push(texts.join(' '));
        }

        return slides.join('\n\n');
    }

    async extractImageText(file) {
        if (!window.Tesseract) throw new Error('图片 OCR 库加载失败，请刷新页面重试');
        this.showLimitDialog('图片 OCR 可能较慢', '首次识别图片需要加载 OCR 模型，可能等待几十秒。图片越清晰，识别效果越好。');
        this.showStatus('正在识别图片文字，可能需要几十秒...');
        const result = await window.Tesseract.recognize(file, 'chi_sim+eng');
        return result.data.text;
    }

    // 获取示例文本
    getExampleText() {
        return `International graduate students often read papers, lecture slides, and project documents across different courses. They need to quickly understand unfamiliar concepts, compare theories, and decide what to study next.

Artificial intelligence can help learners organize research notes into structured knowledge. Knowledge graphs connect concepts, definitions, methods, datasets, and application scenarios. Ontology modeling makes those connections explicit and easier to review.

A ResearchGraph Agent should not only extract keywords. It should identify central concepts, explain relationships, summarize the material, reveal knowledge gaps, and recommend next actions such as reading prerequisite concepts, comparing methods, or preparing a presentation outline.

For overseas learners, this workflow is useful when they study in a second language, join interdisciplinary courses, or prepare research discussions with limited time.`;
    }

    // 运行演示
    runDemo() {
        this._endLearning();
        const noteInput = document.getElementById('noteInput');
        noteInput.value = this.getExampleText();
        document.getElementById('charCount').textContent = noteInput.value.length;
        this.renderGraph(this.getDemoData());
        this.showToast('已加载演示知识图谱！');
    }

    // 获取演示图谱数据
    getDemoData() {
        return {
            concepts: [
                { id: 'researchgraph_agent', name: 'ResearchGraph Agent', definition: '把学习材料转化为概念图谱、洞察和行动建议的研究学习智能体。', importance: 5, category: 'Agent 产品' },
                { id: 'overseas_learners', name: 'Overseas learners', definition: '需要跨语言、跨学科理解课程和研究材料的国际学生与研究者。', importance: 5, category: '目标用户' },
                { id: 'knowledge_graph', name: 'Knowledge graph', definition: '用节点和边表示概念、定义、方法与应用场景之间的结构。', importance: 4, category: '知识表示' },
                { id: 'ontology_modeling', name: 'Ontology modeling', definition: '把概念和关系显式化，帮助学习者形成稳定的知识结构。', importance: 4, category: '分析方法' },
                { id: 'research_notes', name: 'Research notes', definition: '论文、讲义、项目材料和课堂笔记等输入材料。', importance: 3, category: '输入材料' },
                { id: 'lecture_slides', name: 'Lecture slides', definition: '海外课程中高密度、碎片化但必须快速理解的课堂材料。', importance: 3, category: '输入材料' },
                { id: 'knowledge_gaps', name: 'Knowledge gaps', definition: '材料中隐含但学习者可能尚未掌握的前置知识或薄弱环节。', importance: 4, category: 'Agent 洞察' },
                { id: 'ocr_risks', name: 'OCR risks', definition: '扫描版 PDF 或图片材料可能造成识别误差，需要学习者复核。', importance: 3, category: 'Agent 风险' },
                { id: 'next_actions', name: 'Next actions', definition: 'Agent 推荐的阅读、比较、复盘或展示准备任务。', importance: 4, category: 'Agent 行动' },
                { id: 'seminar_questions', name: 'Seminar questions', definition: '把学习缺口转化为课堂讨论和研究组交流问题。', importance: 4, category: 'Agent 行动' },
                { id: 'presentation_outline', name: 'Presentation outline', definition: '将图谱结构转化为可汇报的课堂展示大纲。', importance: 4, category: 'Agent 行动' },
                { id: 'gmi_cloud', name: 'GMI Cloud', definition: '比赛版后端接入的 Inference Engine API 平台。', importance: 3, category: '模型平台' }
            ],
            relationships: [
                { source: 'researchgraph_agent', target: 'research_notes', relationship: '读取', description: 'Agent 接收课程、论文和项目材料作为分析输入。' },
                { source: 'researchgraph_agent', target: 'lecture_slides', relationship: '读取', description: 'Agent 支持海外课程讲义和 PPT 材料导入。' },
                { source: 'researchgraph_agent', target: 'knowledge_graph', relationship: '生成', description: 'Agent 将非结构化文本转化为可视化知识图谱。' },
                { source: 'knowledge_graph', target: 'ontology_modeling', relationship: '基于', description: '图谱结构依赖本体论建模来定义概念和关系。' },
                { source: 'researchgraph_agent', target: 'knowledge_gaps', relationship: '识别', description: 'Agent 发现材料中的前置知识缺口和理解风险。' },
                { source: 'lecture_slides', target: 'ocr_risks', relationship: '可能产生', description: '扫描版或图片化材料会带来 OCR 识别风险。' },
                { source: 'knowledge_gaps', target: 'next_actions', relationship: '转化为', description: '识别到的缺口会被转化为可执行学习行动。' },
                { source: 'next_actions', target: 'seminar_questions', relationship: '生成', description: '行动建议进一步形成课堂讨论问题。' },
                { source: 'next_actions', target: 'presentation_outline', relationship: '生成', description: '行动建议也可以转化为课堂汇报大纲。' },
                { source: 'overseas_learners', target: 'researchgraph_agent', relationship: '使用', description: '海外学习者使用 Agent 快速理解英文材料和跨学科内容。' },
                { source: 'researchgraph_agent', target: 'gmi_cloud', relationship: '调用', description: '比赛版通过后端调用 GMI Cloud Inference Engine。' }
            ],
            agentReport: {
                summary: 'ResearchGraph Agent helps international students turn dense academic materials into concept maps, learning gaps, seminar-ready questions, and presentation-ready action plans.',
                insights: [
                    'The target users are not general note takers, but global learners who must understand English and interdisciplinary academic materials under time pressure.',
                    'The product value is not keyword extraction; it converts fragmented reading into an end-to-end workflow from understanding to classroom or research action.',
                    'The GMI Cloud API is called from the backend, which keeps model credentials away from the public frontend.'
                ],
                gaps: [
                    'The public GitHub Pages demo uses local fallback, while the local backend has already verified GMI Cloud inference.',
                    'Scanned PDFs still depend on OCR quality, so complex academic layouts may need stronger document parsing.'
                ],
                actions: [
                    'Use the concept graph to explain the material in a 2-minute class discussion.',
                    'Review the top 3 prerequisite concepts before reading the next paper.',
                    'Export the graph and report for seminar preparation or advisor discussion.'
                ],
                studyPlan: [
                    '0-10 min: Review the central concepts and their definitions.',
                    '10-20 min: Follow relationship edges to explain how methods, users, and outcomes connect.',
                    '20-30 min: Turn learning gaps into questions for class, advisor, or group discussion.'
                ],
                seminarQuestions: [
                    'What makes international learners different from general note-taking users?',
                    'Which knowledge gaps should the Agent detect before recommending actions?',
                    'How can concept maps support literature review and seminar preparation?'
                ],
                presentationOutline: [
                    'Slide 1: Overseas learning pain point and target users.',
                    'Slide 2: Ingest → Reason → Act Agent workflow.',
                    'Slide 3: Knowledge graph and action-oriented study report.',
                    'Slide 4: GMI Cloud backend integration and commercialization path.'
                ]
            }
        };
    }

    // 保存设置
    saveSettings() {
        this.settings = {
            backendUrl: document.getElementById('backendUrl').value.trim().replace(/\/$/, ''),
            accessCode: document.getElementById('accessCode').value
        };
        localStorage.setItem('ontologySettings', JSON.stringify(this.settings));
        this.showToast('设置已保存！');
    }

    // 加载设置
    loadSettings() {
        const saved = localStorage.getItem('ontologySettings');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            backendUrl: '',
            accessCode: ''
        };
    }

    // 设置加载到UI
    loadSettingsToUI() {
        document.getElementById('backendUrl').value = this.settings.backendUrl || '';
        document.getElementById('accessCode').value = this.settings.accessCode || '';
    }

    // 显示状态
    showStatus(text, loading = true) {
        const statusBar = document.getElementById('statusBar');
        const statusText = document.getElementById('statusText');
        const statusIcon = document.getElementById('statusIcon');

        statusBar.classList.remove('hidden');
        statusText.textContent = text;

        if (loading) {
            statusIcon.innerHTML = '<i class="fa fa-circle-o-notch text-primary"></i>';
            statusIcon.classList.add('animate-spin');
        } else {
            statusIcon.innerHTML = '<i class="fa fa-check text-green-500"></i>';
            statusIcon.classList.remove('animate-spin');
        }
    }

    // 隐藏状态
    hideStatus() {
        setTimeout(() => {
            document.getElementById('statusBar').classList.add('hidden');
            this.hidePipelineProgress();
        }, 3000);
    }

    // 显示Toast
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // 提取本体论
    async extractOntology() {
        const text = document.getElementById('noteInput').value.trim();
        if (!text) { this.showToast('请先输入笔记内容！'); return; }

        // 先清理但不破坏 DOM 结构
        if (this.cy) { try { this.cy.elements().remove(); } catch(e) {} }
        if (this._graph3d) {
            try { this._graph3d._destructor && this._graph3d._destructor(); } catch(e) {}
            this._graph3d = null;
        }
        this.currentData = null;

        document.getElementById('emptyState')?.classList.add('hidden');

        this.showStatus('正在生成图谱...');

        // 本地规则秒出（不依赖后端，不依赖 3D 库）
        const localResult = this.extractWithLocalRules(text);
        this.renderGraph(localResult);
        this.showStatus('图谱已生成', false);

        // 后台调 GMI（不阻塞 UI）
        try {
            const baseUrl = this.settings.backendUrl || '';
            const resp = await fetch(`${baseUrl}/api/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, accessCode: this.settings.accessCode || '' })
            });
            if (resp.ok) {
                const gmiData = await resp.json();
                this.renderGraph(gmiData);
                this.showToast('GMI Cloud 已优化图谱');
            }
        } catch (e) {}
        this.hideStatus();
    }

    async pollJob(jobId) {
        const baseUrl = this.settings.backendUrl || '';
        const maxPolls = 60;
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const resp = await fetch(`${baseUrl}/api/status/${jobId}`);
            const status = await resp.json();
            this.updatePipelineProgress(status);
            if (status.status === 'done' || status.status === 'failed') {
                const resultResp = await fetch(`${baseUrl}/api/result/${jobId}`);
                return resultResp.json();
            }
        }
        throw new Error('分析超时');
    }

    showPipelineProgress() {
        const bar = document.getElementById('pipelineBar');
        if (!bar) return;
        bar.classList.remove('hidden');
        const steps = ['ingest', 'reason', 'report', 'render', 'done'];
        const labels = { ingest: '解析文本', reason: '提取概念', report: '生成报告', render: '渲染图谱', done: '完成' };
        bar.innerHTML = steps.map(id =>
            `<span id="pipe-${id}" class="pipe-step text-xs px-2 py-1 rounded bg-slate-700 text-gray-500">${labels[id]}</span>`
        ).join('<span class="text-gray-600 mx-1">→</span>');
    }

    updatePipelineProgress(status) {
        if (!status || !status.steps) return;
        const bar = document.getElementById('pipelineBar');
        if (!bar) return;
        status.steps.forEach(s => {
            const el = document.getElementById(`pipe-${s.id}`);
            if (!el) return;
            if (s.status === 'completed') {
                el.className = 'pipe-step text-xs px-2 py-1 rounded bg-green-700 text-green-200';
            } else if (s.status === 'running') {
                el.className = 'pipe-step text-xs px-2 py-1 rounded bg-primary text-white animate-pulse';
            } else if (s.status === 'failed') {
                el.className = 'pipe-step text-xs px-2 py-1 rounded bg-red-700 text-red-200';
            }
        });
    }

    hidePipelineProgress() {
        setTimeout(() => {
            const bar = document.getElementById('pipelineBar');
            if (bar) bar.classList.add('hidden');
        }, 3000);
    }

    // 本地规则提取，适合 GitHub Pages 展示版
    extractWithLocalRules(text) {
        const stopWords = new Set(['我们', '你们', '他们', '这个', '那个', '一种', '一个', '以及', '并且', '因此', '如果', '但是', '因为', '所以', '通过', '进行', '可以', '需要', '通常', '主要', '重要', '领域', '系统', '方法', '技术', '内容', '问题', '方面', '过程', '结果', '具有', '能够', '之间', '用于']);
        const domainWords = ['人工智能', '机器学习', '深度学习', '神经网络', '自然语言处理', '大语言模型', '知识图谱', '因果推断', '本体论', '概念', '关系', '教育', '学习', '编程', '数据', '模型', '算法', '智能体', '决策', '推荐', '诊断'];
        const frequency = new Map();
        const contextMap = new Map();
        const sentences = text.split(/[。！？.!?\n]/).map((item) => item.trim()).filter(Boolean);

        const addCandidate = (name, sentence, weight = 1) => {
            const cleaned = name.replace(/[，。！？、；：,.!?;:\s]/g, '').trim();
            if (cleaned.length < 2 || cleaned.length > 12 || stopWords.has(cleaned)) return;
            if (/^[0-9]+$/.test(cleaned)) return;
            frequency.set(cleaned, (frequency.get(cleaned) || 0) + weight);
            if (!contextMap.has(cleaned)) contextMap.set(cleaned, sentence);
        };

        sentences.forEach((sentence) => {
            domainWords.forEach((word) => {
                if (sentence.includes(word)) addCandidate(word, sentence, 4);
            });

            const bracketMatches = sentence.match(/[一-龥A-Za-z]{2,12}[（(][A-Za-z0-9\-]{2,12}[）)]/g) || [];
            bracketMatches.forEach((item) => addCandidate(item.replace(/[（(].*?[）)]/g, ''), sentence, 3));

            const nounMatches = sentence.match(/[一-龥A-Za-z]{2,8}(系统|模型|算法|方法|工具|助手|平台|图谱|网络|机制|框架|理论|能力|路径|数据|知识|智能体)/g) || [];
            nounMatches.forEach((item) => addCandidate(item, sentence, 2));

            const shortMatches = sentence.match(/[一-龥A-Za-z]{2,6}/g) || [];
            shortMatches.forEach((item) => addCandidate(item, sentence, 1));
        });

        const concepts = [...frequency.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
            .filter(([name], index, arr) => !arr.slice(0, index).some(([existing]) => existing.includes(name) && existing !== name))
            .slice(0, 12)
            .map(([name, score], index) => ({
                id: `concept_${index + 1}`,
                name,
                definition: this.buildLocalDefinition(name, contextMap.get(name), score),
                importance: Math.max(1, Math.min(5, Math.ceil(score / 2))),
                category: index < 3 ? '核心概念' : index < 8 ? '关联概念' : '扩展概念'
            }));

        if (concepts.length === 0) {
            return this.getDemoData();
        }

        const relationships = this.buildLocalRelationships(sentences, concepts);
        return {
            concepts,
            relationships,
            agentReport: this.buildLocalAgentReport(text, concepts, relationships)
        };
    }

    buildLocalDefinition(name, sentence, score) {
        if (!sentence) return `文本中的关键概念，综合权重 ${score}。`;
        const summary = sentence.length > 42 ? sentence.slice(0, 42) + '...' : sentence;
        return `来自语境：“${summary}”`;
    }

    buildLocalAgentReport(text, concepts, relationships) {
        const topConcepts = concepts.slice(0, 4).map((concept) => concept.name);
        return {
            summary: `The Agent identified ${concepts.length} core concepts and ${relationships.length} relationships. The material mainly focuses on: ${topConcepts.join(', ')}.`,
            insights: [
                `The central concept is “${concepts[0]?.name || 'N/A'}”, so learners should use it as the anchor for reviewing the material.`,
                relationships.length > concepts.length ? 'The material has dense concept connections, which makes it suitable for seminar explanation or presentation mapping.' : 'The concept network is still sparse, so learners should add definitions, examples, and application contexts.',
                text.length > 1500 ? 'The input is long enough to be split into modules for deeper reading.' : 'The input is short enough for quick pre-class or pre-seminar preparation.'
            ],
            gaps: [
                'Local fallback cannot fully reason over deep academic meaning; switch to GMI Cloud inference when quota is available.',
                'Any isolated concept in the graph suggests missing definitions, causal links, or application examples.'
            ],
            actions: [
                'Start from the top concepts, then follow graph edges to retell the material logic.',
                'Turn the gaps into questions for class discussion, advisor meetings, or peer study groups.',
                'Export the graph and report for seminar preparation, literature review, or project presentation.'
            ],
            studyPlan: [
                `0-10 min: Review the top concepts: ${topConcepts.slice(0, 3).join(', ')}.`,
                '10-20 min: Explain the strongest relationships in your own words.',
                '20-30 min: Write down unanswered questions and decide what to read next.'
            ],
            seminarQuestions: [
                `Why is “${concepts[0]?.name || 'the central concept'}” important in this material?`,
                'Which relationship in the graph is the hardest to justify from the original text?',
                'What prerequisite concept should a learner review before discussing this material?'
            ],
            presentationOutline: [
                'Slide 1: Main topic and target learning problem.',
                'Slide 2: Core concepts and knowledge graph structure.',
                'Slide 3: Learning gaps and discussion questions.',
                'Slide 4: Next actions and follow-up reading plan.'
            ]
        };
    }

    buildLocalRelationships(sentences, concepts) {
        const relationships = [];
        const relationPatterns = [
            { keyword: '属于', relation: '属于' },
            { keyword: '包括', relation: '包含' },
            { keyword: '包含', relation: '包含' },
            { keyword: '基于', relation: '基于' },
            { keyword: '依赖', relation: '依赖' },
            { keyword: '应用', relation: '应用于' },
            { keyword: '用于', relation: '用于' },
            { keyword: '影响', relation: '影响' },
            { keyword: '导致', relation: '导致' },
            { keyword: '支撑', relation: '支撑' },
            { keyword: '促进', relation: '促进' },
            { keyword: '是', relation: '定义/归属' }
        ];

        sentences.forEach((sentence) => {
            const appeared = concepts
                .filter((concept) => sentence.includes(concept.name))
                .sort((a, b) => sentence.indexOf(a.name) - sentence.indexOf(b.name));

            if (appeared.length < 2) return;

            for (let i = 0; i < appeared.length - 1 && relationships.length < 20; i++) {
                const source = appeared[i];
                const target = appeared[i + 1];
                const pattern = relationPatterns.find((item) => sentence.includes(item.keyword));
                this.addRelationship(relationships, source, target, pattern ? pattern.relation : '相关于', sentence);
            }
        });

        if (relationships.length === 0 && concepts.length > 1) {
            concepts.slice(1).forEach((concept) => {
                this.addRelationship(relationships, concepts[0], concept, '相关于', `“${concept.name}”与核心概念“${concepts[0].name}”存在文本关联。`);
            });
        }

        return relationships;
    }

    addRelationship(relationships, source, target, relationship, sentence) {
        if (source.id === target.id) return;
        if (relationships.some((item) => item.source === source.id && item.target === target.id)) return;
        const summary = sentence.length > 46 ? sentence.slice(0, 46) + '...' : sentence;
        relationships.push({
            source: source.id,
            target: target.id,
            relationship,
            description: `关系依据：“${summary}”`
        });
    }

    // 调用后端API
    async callLocalAPI(text) {
        const baseUrl = this.settings.backendUrl || '';
        const response = await fetch(`${baseUrl}/api/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                accessCode: this.settings.accessCode || ''
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'API调用失败');
        }
        return data;
    }


    // 渲染图谱
    renderGraph(data) {
        this.currentData = data;
        this.renderAgentReport(data.agentReport);

        // 自动生成 Anki 卡片和 Study 材料
        this.onAnalysisComplete(data);
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('statsPanel').classList.remove('hidden');

        // 3D 图谱（当 ForceGraph3D 可用且 cytoscape 未初始化时）
        if (typeof ForceGraph3D !== 'undefined' && !this.cy) {
            this.renderGraph3D(data);
            return;
        }

        if (!this.cy) {
            this.renderGraphFallback(data);
            this.updateStatsFallback(data);
            document.getElementById('legend').classList.remove('hidden');
            document.getElementById('mapZones').classList.add('hidden');
            return;
        }

        this.cy.elements().remove();

        const enrichedConcepts = data.concepts.map((concept) => ({
            ...concept,
            mapRole: this.getMapRole(concept)
        }));
        const positions = this.buildLearningMapPositions(enrichedConcepts);

        // 添加节点
        const nodes = enrichedConcepts.map(c => ({
            data: {
                id: c.id,
                label: c.name,
                definition: c.definition,
                importance: c.importance,
                category: c.category,
                mapRole: c.mapRole,
                color: this.getRoleColor(c.mapRole),
                isGap: c.mapRole === 'gap'
            },
            position: positions[c.id]
        }));

        // 添加边
        const edges = data.relationships.map(r => {
            const relationshipText = `${r.relationship || ''} ${r.description || ''}`.toLowerCase();
            const target = enrichedConcepts.find((concept) => concept.id === r.target);
            const isActionPath = target?.mapRole === 'action' || relationshipText.includes('action') || relationshipText.includes('recommend') || relationshipText.includes('转化');
            return {
                data: {
                    id: `${r.source}-${r.target}`,
                    source: r.source,
                    target: r.target,
                    relationship: r.relationship,
                    description: r.description,
                    isActionPath,
                    color: isActionPath ? '#34d399' : '#64748b'
                }
            };
        });

        this.cy.add([...nodes, ...edges]);

        // 应用布局
        this.relayout(true);

        // 根据 Anki 掌握度更新节点颜色
        this._applyGraphMasteryColors();

        // 双击节点 → 跳转复习
        this.cy.removeListener('dblclick');
        this.cy.on('dblclick', 'node', (e) => {
            const name = e.target.data('label');
            if (this.ankiEngine) {
                const mastery = this.ankiEngine.getConceptMastery(name);
                if (mastery) {
                    document.querySelector('[data-pane="review-pane"]')?.click();
                    setTimeout(() => this.renderReviewTab('tree'), 150);
                    this.showToast(`📖 "${name}" 掌握度: ${mastery.mastery}`);
                } else {
                    // 无卡片 → 立即生成一张
                    const data = this.currentData;
                    const concept = data?.concepts?.find(c => c.name === name);
                    if (concept && this.ankiEngine) {
                        const front = `什么是「${name}」？`;
                        const exists = this.ankiEngine.data.cards.find(c => c.front === front);
                        if (!exists) {
                            this.ankiEngine._createCard({ front, back: concept.definition || '', sourceType: 'concept', sourceId: concept.id, layer: 0 });
                            this.showToast(`🃏 已生成「${name}」的抽认卡`);
                            this.refreshReviewStats();
                        } else {
                            this.showToast(`「${name}」已有卡片，去 Review 查看`);
                        }
                    }
                }
            }
        });

        // 更新统计
        this.updateStats();
        this.renderAgentReport(data.agentReport);

        // 显示图例和统计面板
        document.getElementById('legend').classList.remove('hidden');
        document.getElementById('statsPanel').classList.remove('hidden');
        document.getElementById('mapZones').classList.remove('hidden');
    }

    /**
     * 根据 Anki 掌握度更新图谱节点颜色
     */
    _applyGraphMasteryColors() {
        if (!this.cy || !this.ankiEngine) return;
        this.cy.nodes().forEach(node => {
            const name = node.data('label');
            const mastery = this.ankiEngine.getConceptMastery(name);
            if (mastery) {
                node.style('background-color', mastery.color);
                node.style('border-color', mastery.borderColor);
                node.style('border-width', 3);
                // 加发光效果
                node.style('shadow-blur', 20);
                node.style('shadow-color', mastery.color);
                node.style('shadow-opacity', 0.5);
                // 右键菜单数据
                node.data('mastery', mastery.mastery);
            } else {
                node.data('mastery', 'none');
            }
        });

        // 更新图例 — 添加掌握度说明
        const legend = document.getElementById('legend');
        if (legend) {
            const existing = legend.querySelector('.mastery-legend');
            if (!existing) {
                const div = document.createElement('div');
                div.className = 'mastery-legend flex flex-wrap gap-3 text-xs mt-2 pt-2 border-t border-slate-700/50';
                div.innerHTML = `
                    <div class="flex items-center space-x-2"><div class="w-3 h-3 rounded-full bg-[#22c55e]"></div><span class="text-gray-400">已掌握</span></div>
                    <div class="flex items-center space-x-2"><div class="w-3 h-3 rounded-full bg-[#eab308]"></div><span class="text-gray-400">复习中</span></div>
                    <div class="flex items-center space-x-2"><div class="w-3 h-3 rounded-full bg-[#ef4444]"></div><span class="text-gray-400">薄弱</span></div>
                    <div class="flex items-center space-x-2 text-gray-500"><i class="fa fa-hand-pointer-o"></i><span>双击节点跳转复习</span></div>
                `;
                legend.appendChild(div);
            }
        }
    }

    renderGraph3D(data) {
        const container = document.getElementById('cy');
        if (!container) return;
        container.innerHTML = '';
        container.style.overflow = 'hidden';
        container.style.minHeight = '500px';
        container.style.height = 'calc(100vh - 220px)';

        const concepts = data.concepts || [];
        const relationships = data.relationships || [];

        const getColor = (role) => ({
            input: '#22d3ee',
            user: '#38bdf8',
            reason: '#8b5cf6',
            gap: '#f59e0b',
            action: '#34d399'
        }[role] || '#8b5cf6');

        const getMapRole = (c) => {
            const t = `${c.id || ''} ${c.name || ''} ${c.category || ''}`.toLowerCase();
            if (/gap|risk|缺口|风险/.test(t)) return 'gap';
            if (/action|plan|outline|action/.test(t)) return 'action';
            if (/note|paper|slide|input|材料/.test(t)) return 'input';
            if (/learner|student|user|用户/.test(t)) return 'user';
            return 'reason';
        };

        const nodes = concepts.map(c => ({
            id: c.id,
            name: c.name,
            definition: c.definition || '',
            importance: c.importance || 3,
            category: c.category || '',
            mapRole: getMapRole(c),
            color: getColor(getMapRole(c)),
            val: (c.importance || 3) * 2
        }));

        const links = relationships
            .filter(r => nodes.some(n => n.id === r.source) && nodes.some(n => n.id === r.target))
            .map(r => ({
                source: r.source,
                target: r.target,
                relationship: r.relationship || '',
                color: '#64748b'
            }));

        if (this._graph3d) {
            try { this._graph3d.graphData({ nodes, links }); } catch(e) {}
            return;
        }

        try {
            this._graph3d = ForceGraph3D({
                controlType: 'orbit',
                rendererConfig: { antialias: true, alpha: true }
            })(container)
                .graphData({ nodes, links })
                .nodeLabel(n => `${n.name}\n${n.definition || ''}`)
                .nodeAutoColorBy(n => n.color)
                .nodeVal(n => n.val)
                .nodeRelSize(6)
                .linkColor(l => l.color)
                .linkWidth(0.5)
                .linkOpacity(0.5)
                .linkDirectionalParticles(1)
                .linkDirectionalParticleSpeed(0.005)
                .linkDirectionalParticleWidth(2)
                .backgroundColor('#0f172a')
                .showNavInfo(false)
                .d3AlphaDecay(0.02)
                .d3VelocityDecay(0.3);

            this._graph3d.onNodeClick((node) => {
                const n = nodes.find(nn => nn.id === node.id);
                this.showNodeInfo({
                    data: () => ({
                        label: node.name,
                        definition: node.definition,
                        importance: n?.importance || 3,
                        category: node.category,
                        mapRole: n?.mapRole || 'reason',
                        color: node.color
                    }),
                    connectedEdges: () => ({ length: links.filter(l => l.source === node.id || l.target === node.id).length })
                });
            });

            // 自适应
            setTimeout(() => {
                const rect = container.getBoundingClientRect();
                if (rect.width && rect.height) {
                    this._graph3d.width(rect.width).height(rect.height);
                }
            }, 100);

            // 窗口变化自适应
            const onResize = () => {
                if (!this._graph3d) return;
                const rect = container.getBoundingClientRect();
                if (rect.width && rect.height) {
                    this._graph3d.width(rect.width).height(rect.height);
                }
            };
            window.addEventListener('resize', onResize);
        } catch (e) {
            console.warn('3D 图谱加载失败:', e);
            container.innerHTML = '';
            return;
        }

        this.updateStats3D(nodes.length, links.length);
    }

    updateStats3D(nodeCount, edgeCount) {
        document.getElementById('nodeCount').textContent = nodeCount;
        document.getElementById('edgeCount').textContent = edgeCount;
        const maxEdges = nodeCount * (nodeCount - 1) / 2;
        const density = maxEdges > 0 ? ((edgeCount / maxEdges) * 100).toFixed(1) : 0;
        document.getElementById('density').textContent = density + '%';
    }

    renderGraphFallback(data) {
        const container = document.getElementById('cy');
        const concepts = data.concepts || [];
        const relationships = data.relationships || [];
        container.innerHTML = `
            <div class="p-4 h-full overflow-auto">
                <div class="mb-4">
                    <div class="text-xs uppercase tracking-wide text-yellow-300 mb-1">Fallback view</div>
                    <h3 class="font-bold text-lg">Research Learning Map</h3>
                    <p class="text-sm text-gray-400">图谱库未加载时，系统仍可展示 Agent 抽取的概念、关系和报告。</p>
                </div>
                <div class="grid grid-cols-1 gap-3">
                    <div class="bg-slate-800/50 rounded-lg p-3">
                        <div class="font-medium mb-2">Core concepts</div>
                        <ul class="space-y-2 text-sm text-gray-300">
                            ${concepts.map((concept) => `<li><span class="text-primary font-medium">${concept.name}</span> · ${concept.definition || ''}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-3">
                        <div class="font-medium mb-2">Relationships</div>
                        <ul class="space-y-2 text-sm text-gray-300">
                            ${relationships.map((relationship) => `<li>${relationship.source} <span class="text-emerald-300">${relationship.relationship}</span> ${relationship.target}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    getMapRole(concept) {
        const text = `${concept.id || ''} ${concept.name || ''} ${concept.category || ''} ${concept.definition || ''}`.toLowerCase();
        if (/gap|risk|缺口|风险|薄弱|missing|unclear/.test(text)) return 'gap';
        if (/action|plan|question|outline|presentation|seminar|recommend|next|行动|计划|问题|汇报|建议/.test(text)) return 'action';
        if (/note|paper|slide|document|pdf|word|ppt|image|material|input|材料|讲义|论文|文档|图片/.test(text)) return 'input';
        if (/learner|student|researcher|user|用户|学生|研究者/.test(text)) return 'user';
        return 'reason';
    }

    getRoleColor(role) {
        return {
            input: '#22d3ee',
            user: '#38bdf8',
            reason: '#8b5cf6',
            gap: '#f59e0b',
            action: '#34d399'
        }[role] || '#8b5cf6';
    }

    buildLearningMapPositions(concepts) {
        const zones = {
            input: { x: -260, y: -160 },
            user: { x: -265, y: 120 },
            reason: { x: 40, y: -40 },
            gap: { x: -40, y: 185 },
            action: { x: 270, y: 150 }
        };
        const grouped = concepts.reduce((acc, concept) => {
            acc[concept.mapRole] ||= [];
            acc[concept.mapRole].push(concept);
            return acc;
        }, {});
        const positions = {};
        Object.entries(grouped).forEach(([role, items]) => {
            const center = zones[role] || zones.reason;
            const radius = role === 'reason' ? 118 : 76;
            items.forEach((concept, index) => {
                const angle = (Math.PI * 2 * index) / Math.max(items.length, 1) - Math.PI / 2;
                positions[concept.id] = {
                    x: center.x + Math.cos(angle) * radius,
                    y: center.y + Math.sin(angle) * radius
                };
            });
        });
        return positions;
    }

    renderAgentReport(report) {
        const content = document.getElementById('agentContent');
        if (!report) {
            content.innerHTML = '<div class="empty-state" style="min-height:200px;"><i class="fa fa-file-text-o text-4xl mb-3 opacity-30"></i><p class="text-sm">Run an analysis to see the report</p></div>';
            return;
        }

        const list = (items = []) => items.map((item) => `<li>${item}</li>`).join('');
        content.innerHTML = `
            <div class="report-card full">
                <h4>Summary</h4>
                <p>${report.summary || '暂无摘要'}</p>
            </div>
            <div class="report-card">
                <h4>Key insights</h4>
                <ul>${list(report.insights)}</ul>
            </div>
            <div class="report-card">
                <h4>Learning gaps / risks</h4>
                <ul>${list(report.gaps)}</ul>
            </div>
            <div class="report-card">
                <h4>Next actions</h4>
                <ul>${list(report.actions)}</ul>
            </div>
            <div class="report-card">
                <h4>30-min study plan</h4>
                <ul>${list(report.studyPlan)}</ul>
            </div>
            <div class="report-card">
                <h4>Seminar questions</h4>
                <ul>${list(report.seminarQuestions)}</ul>
            </div>
            <div class="report-card">
                <h4>Presentation outline</h4>
                <ul>${list(report.presentationOutline)}</ul>
            </div>
        `;
        content.classList.remove('report-grid');
        void content.offsetWidth;
        content.classList.add('report-grid');
        // Report 面板的引导条
        const guide = this._getGuidance();
        if (guide && guide.target === 'study-pane') {
            const guideBar = document.createElement('div');
            guideBar.className = 'glass mb-3 p-3 flex items-center justify-between';
            guideBar.style.borderLeft = '3px solid #a855f7';
            guideBar.innerHTML = `
                <span class="text-xs text-gray-300">${guide.text}</span>
                <button class="guidance-btn text-xs px-3 py-1.5 bg-primary rounded text-white font-medium">${guide.btn}</button>
            `;
            guideBar.querySelector('.guidance-btn').addEventListener('click', () => {
                document.querySelector('[data-pane="study-pane"]')?.click();
                setTimeout(() => this.renderStudyTab('concepts'), 150);
            });
            content.prepend(guideBar);
        }
        this.resetChat();
    }

    resetChat() {
        this.chatHistory = [];
        const messages = document.getElementById('chatMessages');
        if (!messages) return;
        messages.innerHTML = `
            <div class="chat-bubble agent">
                <div class="label">Agent</div>
                可以继续向 Agent 提问，例如展开某个概念、换汇报角度或要求 5 分钟讲稿。
            </div>`;
        const input = document.getElementById('chatInput');
        if (input) input.value = '';
    }

    appendChatMessage(role, text) {
        const messages = document.getElementById('chatMessages');
        if (!messages) return;
        const isUser = role === 'user';
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isUser ? 'user' : 'agent'}`;
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = isUser ? 'You' : 'Agent';
        const body = document.createElement('div');
        body.style.cssText = 'white-space:pre-wrap;word-break:break-word;';
        body.textContent = text;
        bubble.appendChild(label);
        bubble.appendChild(body);
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
        return bubble;
    }

    async sendChat() {
        if (this.chatLoading) return;
        const input = document.getElementById('chatInput');
        const question = input.value.trim();
        if (!question) return;
        if (!this.currentData) {
            this.showToast('请先运行 Agent 分析');
            return;
        }

        if (this._switchToChat) this._switchToChat();
        this.chatLoading = true;
        input.value = '';
        this.appendChatMessage('user', question);
        this.chatHistory.push({ role: 'user', content: question });

        const thinking = this.appendChatMessage('assistant', '思考中…');

        try {
            const baseUrl = this.settings.backendUrl || '';
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: this.chatHistory,
                    context: {
                        concepts: (this.currentData.concepts || []).map(c => ({ id: c.id, name: c.name })),
                        relationships: this.currentData.relationships || [],
                        summary: this.currentData.agentReport?.summary || ''
                    },
                    accessCode: this.settings.accessCode || ''
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '请求失败');
            const reply = data.reply || '(无回复)';
            thinking.querySelector('div:last-child').textContent = reply;
            this.chatHistory.push({ role: 'assistant', content: reply });
        } catch (err) {
            console.warn('后端追问失败，使用本地规则回复:', err);
            const reply = this.answerWithLocalRules(question);
            thinking.querySelector('div:last-child').textContent = reply;
            this.chatHistory.push({ role: 'assistant', content: reply });
        } finally {
            this.chatLoading = false;
        }
    }

    answerWithLocalRules(question) {
    const data = this.currentData || {};
    const concepts = data.concepts || [];
    const relationships = data.relationships || [];
    const report = data.agentReport || {};
    const q = question.toLowerCase();

    if (/换一个角度|另一个角度|换个角度/.test(q)) {
        const top = concepts.slice(0, 3).map(c => c.name).join('、');
        const gap = report.gaps?.[0] || '需要进一步分析';
        const angle = Math.random() > 0.5 ? '教学' : '辩论';
        return `【${angle}式汇报角度】\n\n` + (angle === '教学'
            ? `建议按「是什么→为什么→怎么做」三步组织汇报：\n\n1️⃣ 问题引入（1分钟）\n核心问题：这篇材料围绕「${concepts[0]?.name || '中心主题'}」展开，主要解决什么学术问题？\n\n2️⃣ 概念拆解（3分钟）\n逐个讲解核心概念：${top}\n用具体例子或对比说明每个概念的实际意义，注意概念之间的因果关系。\n\n3️⃣ 总结与延伸（1分钟）\n学习缺口：${gap}\n未来可以进一步探索的方向：${report.actions?.[0] || '结合实际应用场景深化理解'}。`
            : `建议按「正反合」三部曲组织研讨：\n\n1️⃣ 正方观点（2分钟）\n核心论点：材料中最有力的主张是什么？哪些证据（概念、关系）支持它？\n\n2️⃣ 反方质疑（2分钟）\n找漏洞：${gap}\n有没有未考虑的反例、替代解释或局限性？\n\n3️⃣ 综合评判（1分钟）\n综合以上，给出你的判断：这篇材料的论证是否可靠？哪些部分最有价值？`);
    }

    if (/五分钟|汇报稿|演讲稿/.test(q)) {
        const top = concepts.slice(0, 3).map(c => c.name).join('、');
        const outlines = (report.presentationOutline || []).join('；');
        const gap = report.gaps?.[0] || '需要进一步阅读其他材料';
        const action = report.actions?.[0] || '整理笔记并准备讨论问题';
        const insight = report.insights?.[0] || '这篇材料提供了有价值的框架性认识。';
        return `【5 分钟汇报稿】\n\n━━━━ 开场白（30 秒）━━━━\n各位老师、同学好，今天我将分享关于「${concepts[0]?.name || '这个主题'}」的学习材料。以下我会从核心概念、关键关系、学习启示三个方面进行汇报。\n\n━━━━ 核心概念讲解（2 分钟）━━━━\n本次材料提炼出 ${concepts.length} 个核心概念，其中最重要的三个是：\n\n① ${concepts[0]?.name}：${concepts[0]?.definition || '核心概念'}\n② ${concepts[1]?.name}：${concepts[1]?.definition || '关联概念'}\n③ ${concepts[2]?.name}：${concepts[2]?.definition || '扩展概念'}\n\n这些概念的逻辑关系为：${outlines || top}\n\n━━━━ 关键洞察（1 分钟）━━━━\n${insight}\n\n需要特别关注的是：${gap}\n\n━━━━ 后续行动（30 秒）━━━━\n${action}\n另外，${report.actions?.[1] || '可以结合课堂讨论进一步深化理解。'}\n\n━━━━ 结语（30 秒）━━━━\n以上是我的汇报，希望能为大家提供有价值的参考。欢迎提问和讨论！\n\n（总时长约 5 分钟，可根据实际情况调整节奏。）`;
    }

    const numMatch = question.match(/第\s*(\d+)\s*个|第\s*([一二三四五六七八九十])\s*个/);
    if (numMatch || /展开|详细|具体/.test(question)) {
        const cnNum = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
        let idx = 0;
        if (numMatch) idx = (parseInt(numMatch[1]) || cnNum[numMatch[2]] || 1) - 1;
        const target = concepts[idx] || concepts.find(c => question.includes(c.name)) || concepts[0];
        if (!target) return '当前没有可展开的概念，请先运行 Agent 分析。';
        const rels = relationships.filter(r => r.source === target.id || r.target === target.id);
        const knownRels = rels.slice(0, 5).map(r => {
            const otherName = r.source === target.id ? r.target : r.source;
            return `▸ ${r.relationship} → ${otherName}`;
        }).join('\n');
        const connectedConcepts = rels.map(r => r.source === target.id ? r.target : r.source);
        const deeper = concepts.filter(c => connectedConcepts.includes(c.id)).slice(0, 3);
        const deeperInfo = deeper.length
            ? deeper.map(c => `  · ${c.name}：${c.definition || ''}`).join('\n')
            : '暂无其他关联概念的展开信息';
        return `━━━ 概念深度解析：${target.name} ━━━\n\n📌 基本信息\n  · 类别：${target.category || '未分类'}\n  · 重要性：${'★'.repeat(target.importance || 1)}${'☆'.repeat(5 - (target.importance || 1))}\n  · 角色：${target.mapRole || '核心概念'}\n\n📖 定义\n${target.definition || '暂无定义'}\n\n🔗 关联关系（共 ${rels.length} 条）\n${knownRels || '暂无直接关联'}\n\n📚 深度信息\n${deeperInfo}\n\n💡 学习建议\n  · 这个概念${target.importance >= 4 ? '非常重要，应优先掌握' : target.importance >= 3 ? '比较重要，建议理解' : '作为辅助概念，了解即可'}\n  · 建议结合相关概念${deeper.length ? '「' + deeper.map(c => c.name).join('、') + '」' : ''}一起学习\n  · 可以尝试用自己的话复述这个概念的定义`;
    }

    if (/汇报|演讲|讲稿|presentation|slide|outline/.test(q)) {
        const outline = (report.presentationOutline || []).map((s, i) => `${i+1}. ${s}`).join('\n');
        const top = concepts.slice(0, 3).map(c => c.name).join('、');
        return `5 分钟汇报建议结构：\n${outline || '1. 背景与问题\n2. 核心概念\n3. 关键洞察\n4. 行动建议'}\n\n开场可强调核心概念：${top}。`;
    }

    if (/研讨|讨论|seminar|question|提问/.test(q)) {
        const qs = (report.seminarQuestions || []).map((s, i) => `${i+1}. ${s}`).join('\n');
        return `课堂研讨问题：\n${qs || '（暂无）'}`;
    }

    if (/缺口|gap|风险|risk|不懂/.test(q)) {
        const gaps = (report.gaps || []).map(s => `- ${s}`).join('\n');
        return `当前材料的学习缺口：\n${gaps || '（暂无明显缺口）'}`;
    }

    if (/总结|summary|摘要/.test(q)) {
        return report.summary || '暂无摘要。';
    }

    const hit = concepts.find(c => question.includes(c.name));
    if (hit) {
        return `【${hit.name}】\n${hit.definition || '暂无定义'}\n（类别：${hit.category || '未分类'}，重要性 ${hit.importance || '-'}/5）`;
    }

    const top = concepts.slice(0, 5).map(c => c.name).join('、');
    return `当前处于本地规则回复模式（GMI 暂不可用）。\n材料核心概念：${top || '（无）'}。\n你可以试着问：展开第 N 个概念 / 换一个角度汇报 / 列研讨问题 / 学习缺口是什么。`;
}


    // 重新布局
    relayout(usePreset = false) {
        if (usePreset) {
            this.cy.layout({
                name: 'preset',
                animate: true,
                animationDuration: 700,
                fit: true,
                padding: 55
            }).run();
            return;
        }

        const concepts = this.currentData?.concepts || [];
        const enrichedConcepts = concepts.map((concept) => ({
            ...concept,
            mapRole: this.getMapRole(concept)
        }));
        const positions = this.buildLearningMapPositions(enrichedConcepts);
        this.cy.nodes().forEach((node) => {
            const position = positions[node.id()];
            if (position) node.position(position);
        });
        this.cy.layout({
            name: 'preset',
            animate: true,
            animationDuration: 700,
            fit: true,
            padding: 55
        }).run();
    }

    updateStatsFallback(data) {
        const nodes = data.concepts?.length || 0;
        const edges = data.relationships?.length || 0;
        const maxPossibleEdges = nodes * (nodes - 1) / 2;
        const density = maxPossibleEdges > 0 ? ((edges / maxPossibleEdges) * 100).toFixed(1) : 0;

        document.getElementById('nodeCount').textContent = nodes;
        document.getElementById('edgeCount').textContent = edges;
        document.getElementById('density').textContent = density + '%';
    }

    // 更新统计信息
    updateStats() {
        const nodes = this.cy.nodes().length;
        const edges = this.cy.edges().length;
        const maxPossibleEdges = nodes * (nodes - 1) / 2;
        const density = maxPossibleEdges > 0 ? ((edges / maxPossibleEdges) * 100).toFixed(1) : 0;

        document.getElementById('nodeCount').textContent = nodes;
        document.getElementById('edgeCount').textContent = edges;
        document.getElementById('density').textContent = density + '%';
    }

    // 显示节点详情（模态框 + 跳转）
    showNodeInfo(node) {
        const label = node.data('label');
        const nodeId = node.data('id') || node.id;
        const color = node.data('color') || '#6366f1';
        const importance = node.data('importance') || 3;
        const category = node.data('category') || '未分类';
        const definition = node.data('definition') || '暂无定义';
        const mapRole = node.data('mapRole') || 'reason';
        const edgeCount = node.connectedEdges ? node.connectedEdges().length : 0;

        // 填充 Report 面板中的详情
        const panel = document.getElementById('conceptPanel');
        const content = document.getElementById('conceptContent');
        if (panel && content) {
            const roleLabels = { input: 'Ingest input', user: 'Target learner', reason: 'Reasoning concept', gap: 'Learning gap', action: 'Action path' };
            const importanceLabels = ['普通', '低', '中', '高', '核心'];
            const ic = ['bg-gray-500', 'bg-accent', 'bg-secondary', 'bg-primary', 'bg-yellow-500'];
            panel.classList.remove('hidden');
            content.innerHTML = `
                <div class="bg-slate-800/50 rounded-lg p-4 ring-2 ring-primary/40">
                    <div class="flex items-center justify-between mb-3 gap-3">
                        <h3 class="font-bold text-lg">${label}</h3>
                        <div class="flex flex-wrap justify-end gap-2">
                            <span class="text-xs px-2 py-1 rounded text-slate-950" style="background:${color}">${roleLabels[mapRole] || 'Concept'}</span>
                            <span class="text-xs ${ic[importance - 1] || 'bg-primary'} px-2 py-1 rounded concept-filter cursor-pointer hover:opacity-80" data-filter="imp-${importance}">${importanceLabels[importance - 1] || importance}概念</span>
                        </div>
                    </div>
                    <p class="text-sm text-gray-300 mb-3">${definition}</p>
                    <div class="text-xs text-gray-400">
                        <span class="bg-slate-700 px-2 py-1 rounded">${category}</span>
                        <span class="ml-2"><i class="fa fa-exchange mr-1"></i>${edgeCount} 条连接</span>
                    </div>
                </div>
            `;
            // 切换到 Report 面板
            const tabBtn = document.querySelector('[data-pane="report-pane"]');
            if (tabBtn) tabBtn.click();
            document.getElementById('conceptPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // 弹窗
        const rels = [];
        const data = this.currentData || {};
        const allRels = data.relationships || [];
        const allConcepts = data.concepts || [];
        allRels.forEach(r => {
            if (r.source === nodeId || r.target === nodeId) {
                const other = allConcepts.find(c => c.id === (r.source === nodeId ? r.target : r.source));
                rels.push({
                    name: other ? other.name : (r.source === nodeId ? r.target : r.source),
                    type: r.relationship || '相关',
                    dir: r.source === nodeId ? '→' : '←'
                });
            }
        });

        const importanceStars = '★'.repeat(importance) + '☆'.repeat(5 - importance);
        const roleLabels = { input: 'Ingest input', user: 'Target learner', reason: 'Reasoning concept', gap: 'Learning gap', action: 'Action path' };
        const importanceLabels = ['普通', '低', '中', '高', '核心'];

        const relHtml = rels.length > 0
            ? rels.map(r => `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid rgba(100,116,139,0.15);font-size:0.85rem;">
                <span style="color:${color};font-weight:600;">${r.name}</span>
                <span style="color:#64748b;font-size:0.75rem;">${r.dir} ${r.type}</span>
                <span style="color:rgba(255,255,255,0.5);margin-left:auto;">${r.dir}</span>
                <span style="font-weight:600;">${label}</span>
              </div>`).join('')
            : '<div style="color:#64748b;font-size:0.85rem;">暂无关联关系</div>';

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:1rem;';
        modal.innerHTML = `
            <div style="background:#1e293b;border-radius:1rem;padding:1.5rem;width:min(100%,36rem);max-height:80vh;overflow-y:auto;box-shadow:0 25px 90px rgba(0,0,0,0.5);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1rem;">
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <div style="width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 12px ${color}66;"></div>
                        <div>
                            <h3 style="font-size:1.25rem;font-weight:700;margin:0;">${label}</h3>
                            <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.15rem;">${importanceStars} · ${edgeCount} 条连接</div>
                        </div>
                    </div>
                    <button class="modal-close" style="background:rgba(100,116,139,0.3);color:#94a3b8;font-size:1rem;padding:0.25rem 0.5rem;border-radius:0.3rem;line-height:1;cursor:pointer;border:none;">✕</button>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.25rem;">
                    <span style="background:${color}22;color:${color};padding:0.2rem 0.6rem;border-radius:0.3rem;font-size:0.75rem;font-weight:600;">${roleLabels[mapRole] || 'Concept'}</span>
                    <span class="concept-filter" data-filter="imp-${importance}" style="cursor:pointer;background:rgba(99,102,241,0.2);color:#6366f1;padding:0.2rem 0.6rem;border-radius:0.3rem;font-size:0.75rem;">${importanceLabels[importance - 1] || importance + '/5'}</span>
                    <span class="concept-filter" data-filter="cat-${category}" style="cursor:pointer;background:rgba(100,116,139,0.3);padding:0.2rem 0.6rem;border-radius:0.3rem;font-size:0.75rem;color:#94a3b8;">${category}</span>
                </div>
                <div style="background:rgba(15,23,42,0.5);border-radius:0.75rem;padding:1rem;margin-bottom:1.25rem;">
                    <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:#6366f1;margin-bottom:0.4rem;">定义</div>
                    <p style="font-size:0.9rem;color:rgba(255,255,255,0.8);line-height:1.7;margin:0;">${definition}</p>
                </div>
                <div>
                    <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:#6366f1;margin-bottom:0.5rem;">关联关系</div>
                    ${relHtml}
                </div>
            </div>
        `;

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    // 显示边信息
    showEdgeInfo(edge) {
        const panel = document.getElementById('conceptPanel');
        const content = document.getElementById('conceptContent');

        panel.classList.remove('hidden');

        const sourceNode = this.cy.$id(edge.data('source'));
        const targetNode = this.cy.$id(edge.data('target'));

        content.innerHTML = `
            <div class="bg-slate-800/50 rounded-lg p-4 ring-2 ring-primary/40">
                <div class="text-center mb-3">
                    <span class="font-bold">${sourceNode.data('label')}</span>
                    <i class="fa fa-arrow-right mx-2 text-primary"></i>
                    <span class="font-bold">${targetNode.data('label')}</span>
                </div>
                <div class="text-center mb-3">
                    <span class="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm">
                        ${edge.data('relationship')}
                    </span>
                </div>
                <p class="text-sm text-gray-300">${edge.data('description') || '暂无描述'}</p>
            </div>
        `;

        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.showToast('已打开关系详情');
    }

    // 清空图谱
    clearGraph() {
        this._endLearning();
        if (this.cy) {
            this.cy.elements().remove();
        }
        if (this._graph3d) {
            try { this._graph3d._destructor && this._graph3d._destructor(); } catch(e) {}
            this._graph3d = null;
        }
        this.currentData = null;
        this.chatHistory = [];
        this._quizState = null;
        this._studyQuizzes = null;
        document.getElementById('emptyState')?.classList.remove('hidden');
        document.getElementById('legend')?.classList.add('hidden');
        document.getElementById('statsPanel')?.classList.add('hidden');
        document.getElementById('mapZones')?.classList.add('hidden');
        document.getElementById('conceptPanel')?.classList.add('hidden');
        document.getElementById('agentContent').innerHTML = '<div class="empty-state" style="min-height:200px;"><i class="fa fa-file-text-o text-4xl mb-3 opacity-30"></i><p class="text-sm">Run an analysis to see the report</p></div>';
        const bar = document.getElementById('pipelineBar');
        if (bar) bar.classList.add('hidden');
        document.getElementById('chatMessages').innerHTML = '<div class="empty-state" style="min-height:100px;"><p class="text-sm opacity-50">Run an analysis first, then ask follow-up questions here.</p></div>';
    }

    // 导出JSON
    exportJson() {
        if (!this.currentData) {
            this.showToast('没有可导出的数据！');
            return;
        }

        const dataStr = JSON.stringify(this.currentData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `ontology-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showToast('JSON已导出！');
    }

    // 导出图片
    exportImage() {
        if (this._graph3d) {
            const canvas = document.querySelector('#cy canvas');
            if (canvas) {
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = `ontology-graph-3d-${Date.now()}.png`;
                a.click();
                this.showToast('3D 图谱已导出！');
                return;
            }
        }
        if (!this.cy) {
            this.showToast('图谱库未加载，当前只能导出 JSON');
            return;
        }
        if (this.cy.nodes().length === 0) {
            this.showToast('没有可导出的图谱！');
            return;
        }

        const png = this.cy.png({
            full: true,
            scale: 2,
            background: '#1e293b'
        });

        const a = document.createElement('a');
        a.href = png;
        a.download = `ontology-graph-${Date.now()}.png`;
        a.click();

        this.showToast('图片已导出！');
    }

    exportMarkdown() {
        if (!this.currentData) {
            this.showToast('没有可导出的数据！');
            return;
        }
        const data = this.currentData;
        const concepts = data.concepts || [];
        const relationships = data.relationships || [];
        const report = data.agentReport || {};

        const conceptTable = [
            '| # | 概念 | 类别 | 重要性 | 定义 |',
            '|---|------|------|--------|------|',
            ...concepts.map((c, i) => `| ${i + 1} | ${c.name} | ${c.category || '-'} | ${'★'.repeat(c.importance || 1)} | ${c.definition || '-'} |`)
        ].join('\n');

        const relList = relationships.length > 0
            ? relationships.map((r, i) => `${i + 1}. **${r.source}** → *${r.relationship}* → **${r.target}**：${r.description || ''}`).join('\n')
            : '（无关系数据）';

        const list = (items = []) => items.length > 0 ? items.map((s, i) => `${i + 1}. ${s}`).join('\n') : '（暂无）';

        const md = [
            '# ResearchGraph Agent — 分析报告',
            '',
            `> 导出时间：${new Date().toLocaleString('zh-CN')}`,
            '',
            '## 摘要',
            '',
            report.summary || '暂无摘要',
            '',
            '## 核心概念',
            '',
            conceptTable,
            '',
            '## 概念关系',
            '',
            relList,
            '',
            '## 关键洞察',
            '',
            list(report.insights),
            '',
            '## 学习缺口 / 风险',
            '',
            list(report.gaps),
            '',
            '## 下一步行动',
            '',
            list(report.actions),
            '',
            '## 30 分钟学习计划',
            '',
            list(report.studyPlan),
            '',
            '## 研讨问题',
            '',
            list(report.seminarQuestions),
            '',
            '## 汇报大纲',
            '',
            list(report.presentationOutline),
            '',
            '---',
            '',
            '*由 ResearchGraph Agent 生成 — http://localhost:3000*'
        ].join('\n');

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `researchgraph-report-${Date.now()}.md`;
        a.click();
        this.showToast('Markdown 已导出！');
    }

    // ═══════════════════════════════════════════════════════════
    //  Study + Review 面板
    // ═══════════════════════════════════════════════════════════

    initStudyReview() {
        // Study tabs
        document.querySelectorAll('[data-study-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-study-tab]').forEach(b => {
                    b.className = 'study-tab-btn text-xs px-3 py-1.5 rounded bg-slate-700 text-gray-300';
                });
                btn.className = 'study-tab-btn text-xs px-3 py-1.5 rounded bg-primary text-white font-medium';
                this.renderStudyTab(btn.dataset.studyTab);
            });
        });

        // Study refresh
        document.getElementById('studyRefreshBtn')?.addEventListener('click', () => {
            if (!this.currentData) { this.showToast('请先运行 Agent 分析'); return; }
            this.renderStudyTab(document.querySelector('[data-study-tab].bg-primary')?.dataset.studyTab || 'concepts');
            this.showToast('学习材料已刷新');
        });

        // Review tabs
        document.querySelectorAll('[data-review-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-review-tab]').forEach(b => {
                    b.className = 'review-tab-btn text-xs px-3 py-1.5 rounded bg-slate-700 text-gray-300';
                });
                btn.className = 'review-tab-btn text-xs px-3 py-1.5 rounded bg-primary text-white font-medium';
                this.renderReviewTab(btn.dataset.reviewTab);
            });
        });

        // Review reset
        document.getElementById('reviewResetBtn')?.addEventListener('click', () => {
            if (confirm('确定清除所有 Anki 卡片和复习记录吗？')) {
                if (this.ankiEngine) this.ankiEngine.clearAll();
                this.showToast('已清除所有复习数据');
                this.renderReviewTab('review');
            }
        });
    }

    initAnkiEvents() {
        // Auto-detect pending deep dives every time review tab opens
        this._checkDeepDivesInterval = setInterval(() => {
            if (this.ankiEngine) {
                const pending = this.ankiEngine.getPendingDeepDives();
                if (pending.length > 0 && !this._deepDiveRunning) {
                    this.processDeepDive(pending[0]);
                }
            }
        }, 3000);
    }

    // ─── 在分析完成后调用 ─────────────────────────────────────

    onAnalysisComplete(data) {
        if (!data) return;
        // 重置自测题状态
        this._quizState = null;
        this._studyQuizzes = null;
        // 生成 Anki 卡片
        if (this.ankiEngine) {
            const count = this.ankiEngine.generateCardsFromAnalysis(data);
            if (count.length > 0) {
                this.showToast(`已生成 ${count.length} 张抽认卡`);
            }
        }
        // 保存到分析历史
        this._saveToHistory();
        this._renderHistoryList();

        // 学习模式中: 自动进入下一步
        if (this._learnSteps && this._learnSteps[this._learnIndex]?.id === 'input') {
            setTimeout(() => this._advanceLearning(), 500);
        }

        // 刷新 Study 面板
        this.renderStudyTab('concepts');
        this.refreshReviewStats();
    }

    // ─── 多材料管理: 分析历史 ──────────────────────────────────

    _saveToHistory() {
        if (!this.currentData) return;
        const history = this._getHistory();
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const sourceText = (document.getElementById('noteInput')?.value || '').trim();
        const sourceName = sourceText.length > 40 ? sourceText.slice(0, 40) + '…' : sourceText || '未命名分析';

        // 检查是否与最近一条重复（同一文本不重复保存）
        if (history.length > 0 && history[0].sourceName === sourceName) return;

        const entry = {
            id: 'hist_' + Date.now(),
            sourceName,
            dateLabel: dateStr,
            conceptCount: (this.currentData.concepts || []).length,
            relCount: (this.currentData.relationships || []).length,
            data: JSON.parse(JSON.stringify(this.currentData)),
            ankiCards: this.ankiEngine ? JSON.parse(JSON.stringify(this.ankiEngine.data.cards)) : [],
            ankiStats: this.ankiEngine ? JSON.parse(JSON.stringify(this.ankiEngine.data.stats)) : [],
            ankiReviews: this.ankiEngine ? JSON.parse(JSON.stringify(this.ankiEngine.data.reviews)) : [],
            ankiDeepDives: this.ankiEngine ? JSON.parse(JSON.stringify(this.ankiEngine.data.deepDives)) : []
        };

        history.unshift(entry);
        if (history.length > 10) history.pop();
        localStorage.setItem('researchgraph_history', JSON.stringify(history));
    }

    _getHistory() {
        try {
            const raw = localStorage.getItem('researchgraph_history');
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    }

    _switchToHistory(id) {
        // 先保存当前状态
        this._saveToHistory();
        const history = this._getHistory();
        const entry = history.find(h => h.id === id);
        if (!entry) { this.showToast('历史记录未找到'); return; }

        // 恢复分析数据
        this.currentData = JSON.parse(JSON.stringify(entry.data));

        // 恢复 Anki 卡片
        if (this.ankiEngine) {
            this.ankiEngine.clearAll();
            if (entry.ankiCards && entry.ankiCards.length > 0) {
                this.ankiEngine.data.cards = JSON.parse(JSON.stringify(entry.ankiCards));
                this.ankiEngine.data.reviews = JSON.parse(JSON.stringify(entry.ankiReviews || []));
                this.ankiEngine.data.deepDives = JSON.parse(JSON.stringify(entry.ankiDeepDives || []));
                const stats = this.ankiEngine._freshStats();
                if (entry.ankiStats) Object.assign(stats, entry.ankiStats);
                this.ankiEngine.data.stats = stats;
                this.ankiEngine._save();
            }
        }

        // 恢复输入框
        const noteInput = document.getElementById('noteInput');
        if (noteInput) noteInput.value = entry.sourceName;
        document.getElementById('charCount').textContent = entry.sourceName.length;

        // 重绘图谱和报告
        this.clearGraph();
        setTimeout(() => {
            this.renderGraph(this.currentData);
            this.renderStudyTab('concepts');
            this.refreshReviewStats();
            this._renderHistoryList();
            this.showToast(`已切换到: ${entry.sourceName}`);
        }, 100);
    }

    _deleteHistory(id) {
        let history = this._getHistory();
        history = history.filter(h => h.id !== id);
        localStorage.setItem('researchgraph_history', JSON.stringify(history));
        this._renderHistoryList();
    }

    _renderHistoryList() {
        const list = document.getElementById('historyList');
        const count = document.getElementById('historyCount');
        if (!list) return;
        const history = this._getHistory();
        if (!count) return;
        if (history.length === 0) {
            list.innerHTML = '<div class="text-[0.65rem] text-gray-600 px-3 py-2">暂无历史分析</div>';
            count.textContent = '';
            return;
        }
        count.textContent = history.length + '/' + 10;
        list.innerHTML = history.map(h => `
            <div class="history-item flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-slate-700/50 transition group" data-id="${h.id}" style="font-size:0.72rem;">
                <i class="fa fa-file-text-o text-gray-500 shrink-0"></i>
                <div class="min-w-0 flex-1">
                    <div class="truncate text-gray-300">${h.sourceName}</div>
                    <div class="text-gray-600" style="font-size:0.6rem;">${h.dateLabel} · ${h.conceptCount} 概念</div>
                </div>
                <button class="history-del opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition p-0.5" data-id="${h.id}" title="删除">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `).join('');

        // 绑定点击切换
        list.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.history-del')) return;
                this._switchToHistory(el.dataset.id);
            });
        });
        // 绑定删除
        list.querySelectorAll('.history-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('删除此条历史记录？卡片数据也会一起删除。')) {
                    this._deleteHistory(btn.dataset.id);
                }
            });
        });
    }

    // ─── 学习路径引导 ─────────────────────────────────────────

    _getGuidance() {
        const state = this._quizState;
        const anki = this.ankiEngine;
        const hasCards = anki && anki.data.cards.length > 0;
        const due = anki ? anki.getDueCards().length : 0;
        const quizDone = state && state.completed;
        const quizMisses = state && state.misses && state.misses.length > 0;
        const hasAnalysis = !!this.currentData;

        if (!hasAnalysis) return null;

        // 引导优先级: 自测未做 → 有错题 → 有待复习 → 都完成了
        if (!state || state.questions.length === 0) {
            // 从未打开过自测
            return { text: '📋 分析已完成 → 下一步: 做自测检验掌握程度', target: 'study-pane', tab: 'quiz', btn: '去做自测' };
        }
        if (!quizDone && state.questions.length > 0) {
            return { text: `✏️ 自测进度 ${state.currentIndex}/${state.total}，继续完成`, target: 'study-pane', tab: 'quiz', btn: '继续自测' };
        }
        if (quizDone && quizMisses) {
            return { text: `📚 ${state.misses.length} 道错题已加入 Review 抽认卡，趁热巩固`, target: 'review-pane', tab: 'review', btn: '去复习' };
        }
        if (quizDone && !quizMisses && due > 0) {
            return { text: `🎉 自测全对！还有 ${due} 张卡片待复习`, target: 'review-pane', tab: 'review', btn: '去复习' };
        }
        if (due > 0) {
            return { text: `🃏 有 ${due} 张卡片待复习，今天巩固了吗？`, target: 'review-pane', tab: 'review', btn: '去复习' };
        }
        if (hasCards && due === 0 && anki && anki.getStats().totalReviews > 0) {
            return { text: '🎉 今日复习完成！明天回来继续巩固', target: null, tab: null, btn: null };
        }
        return null;
    }

    _renderGuidance(container) {
        const guide = this._getGuidance();
        if (!guide) return;
        const clickHandler = guide.target ? `onclick="document.querySelector('[data-pane=\\'${guide.target}\\']')?.click(); this._renderReviewTab('${guide.tab}')"` : '';
        const bar = document.createElement('div');
        bar.className = 'glass mb-3 p-3 flex items-center justify-between';
        bar.style.borderLeft = '3px solid #a855f7';
        bar.innerHTML = `
            <span class="text-xs text-gray-300">${guide.text}</span>
            ${guide.btn ? `<button class="guidance-btn text-xs px-3 py-1.5 bg-primary rounded text-white font-medium hover:opacity-90 transition">${guide.btn}</button>` : ''}
        `;
        const btn = bar.querySelector('.guidance-btn');
        if (btn && guide.target) {
            btn.addEventListener('click', () => {
                const paneBtn = document.querySelector(`[data-pane="${guide.target}"]`);
                if (paneBtn) paneBtn.click();
                if (guide.target === 'review-pane') {
                    setTimeout(() => this.renderReviewTab(guide.tab), 150);
                } else if (guide.target === 'study-pane') {
                    setTimeout(() => {
                        const tabBtns = document.querySelectorAll('[data-study-tab]');
                        tabBtns.forEach(b => {
                            b.className = 'study-tab-btn text-xs px-3 py-1.5 rounded bg-slate-700 text-gray-300';
                            if (b.dataset.studyTab === guide.tab) {
                                b.className = 'study-tab-btn text-xs px-3 py-1.5 rounded bg-primary text-white font-medium';
                            }
                        });
                        this.renderStudyTab(guide.tab);
                    }, 150);
                }
            });
        }
        container.prepend(bar);
    }

    renderStudyTab(tab) {
        const container = document.getElementById('studyContent');
        if (!container || !this.currentData) {
            container.innerHTML = '<div class="empty-state" style="min-height:200px;"><i class="fa fa-graduation-cap text-4xl mb-3 opacity-30"></i><p class="text-sm">Run an analysis first to generate study materials.</p></div>';
            return;
        }
        switch (tab) {
            case 'concepts': this.renderStudyConcepts(container); break;
            case 'chains': this.renderStudyChains(container); break;
            case 'quiz': this.renderStudyQuiz(container); break;
            case 'goals': this.renderStudyGoals(container); break;
            default: this.renderStudyConcepts(container);
        }
        this._renderGuidance(container);
    }

    renderStudyConcepts(container) {
        const data = this.currentData;
        const concepts = (data.concepts || []).sort((a, b) => (b.importance || 1) - (a.importance || 1));
        if (concepts.length === 0) {
            container.innerHTML = '<div class="empty-state" style="min-height:100px;"><p class="text-sm opacity-50">No concepts extracted.</p></div>';
            return;
        }
        container.innerHTML = `
            <div class="text-xs text-gray-500 mb-2">共 ${concepts.length} 个概念，按重要性排序</div>
            ${concepts.map(c => `
                <div class="concept-card">
                    <div class="name">${c.name}</div>
                    <div class="def">${c.definition || '暂无定义'}</div>
                    <div class="meta">
                        ${'★'.repeat(c.importance || 1)}${'☆'.repeat(5 - (c.importance || 1))}
                        · ${c.category || '未分类'}
                    </div>
                </div>
            `).join('')}
        `;
    }

    renderStudyChains(container) {
        const data = this.currentData;
        const concepts = data.concepts || [];
        const rels = data.relationships || [];
        if (rels.length === 0 || concepts.length === 0) {
            container.innerHTML = '<div class="empty-state" style="min-height:100px;"><p class="text-sm opacity-50">没有足够的关系数据来串联。</p></div>';
            return;
        }
        const nameMap = {};
        concepts.forEach(c => { nameMap[c.id] = c.name; });
        const chains = rels.slice(0, 15).map(r => {
            const src = nameMap[r.source] || r.source;
            const tgt = nameMap[r.target] || r.target;
            return `<div class="chain-card">${src} <span class="rel">${r.relationship}</span> ${tgt}<div class="text-xs text-gray-500 mt-1">${r.description || ''}</div></div>`;
        }).join('');
        container.innerHTML = `
            <div class="text-xs text-gray-500 mb-2">共 ${rels.length} 条关系，展示核心 ${Math.min(rels.length, 15)} 条知识链</div>
            ${chains || '<div class="empty-state"><p class="text-sm">No relationship chains available.</p></div>'}
        `;
    }

    renderStudyQuiz(container) {
        const data = this.currentData;
        const concepts = data.concepts || [];
        if (concepts.length < 2) {
            container.innerHTML = '<div class="empty-state" style="min-height:100px;"><p class="text-sm opacity-50">需要至少 2 个概念才能生成自测题。</p></div>';
            return;
        }

        // 初始化或获取题目
        if (!this._quizState || !this._quizState.questions || this._quizState.questions.length === 0) {
            this._quizState = this._buildQuiz(data);
        }

        const state = this._quizState;

        // 已完成 → 显示成绩
        if (state.completed) {
            this._renderQuizResult(container, state);
            return;
        }

        this._renderQuizQuestion(container, state);
    }

    _buildQuiz(data) {
        const concepts = data.concepts || [];
        const rels = data.relationships || [];
        const questions = [];
        const usedIds = new Set();

        // ── 选择题: 概念定义 ──
        const quizConcepts = concepts.filter(c => c.definition && c.definition.length > 2).slice(0, 6);
        for (const c of quizConcepts) {
            // 找干扰项: 其他概念的定义
            const distractors = concepts
                .filter(d => d.id !== c.id && d.definition && d.definition.length > 2)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3)
                .map(d => d.definition.slice(0, 80));

            if (distractors.length < 2) continue; // 干扰项不够

            const options = [c.definition.slice(0, 80), ...distractors].sort(() => Math.random() - 0.5);
            const correctIndex = options.indexOf(c.definition.slice(0, 80));

            questions.push({
                type: 'mcq',
                conceptName: c.name,
                question: `「${c.name}」的定义是？`,
                options,
                correctIndex,
                explanation: c.definition
            });
            usedIds.add(c.id);
        }

        // ── 判断题: 概念关系 ──
        const nameMap = {};
        concepts.forEach(c => { nameMap[c.id] = c.name; });
        const quizRels = rels.filter(r => nameMap[r.source] && nameMap[r.target]).slice(0, 4);
        for (const r of quizRels) {
            const src = nameMap[r.source];
            const tgt = nameMap[r.target];
            // 50% 正确，50% 错误
            const isCorrect = Math.random() > 0.5;
            const fakeRel = isCorrect
                ? r.relationship
                : (['包含', '属于', '影响', '依赖', '相关于', '基于', '导致'].filter(x => x !== r.relationship).sort(() => Math.random() - 0.5)[0] || '相关于');

            questions.push({
                type: 'tf',
                conceptName: src,
                question: `「${src}」${isCorrect ? r.relationship : fakeRel}「${tgt}」`,
                isCorrectStatement: isCorrect,
                correctAnswer: isCorrect,
                explanation: `正确的描述是: ${src} ${r.relationship} ${tgt}。${r.description || ''}`
            });
        }

        // 打乱
        questions.sort(() => Math.random() - 0.5);

        return {
            questions,
            currentIndex: 0,
            score: 0,
            total: questions.length,
            answers: [],
            misses: [],       // 答错的概念名列表
            completed: false
        };
    }

    _renderQuizQuestion(container, state) {
        const q = state.questions[state.currentIndex];
        const idx = state.currentIndex;
        const total = state.total;

        if (q.type === 'mcq') {
            container.innerHTML = `
                <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>${idx + 1} / ${total}</span>
                    <span class="text-primary font-medium">得分: ${state.score}</span>
                </div>
                <div class="mastery-bar mb-3"><div class="fill" style="width:${(idx / total) * 100}%;"></div></div>
                <div class="quiz-card">
                    <div class="q">${q.question}</div>
                    <div class="mt-3 space-y-2" id="quizOptions">
                        ${q.options.map((opt, oi) => `
                            <div class="quiz-option" data-opt="${oi}" style="padding:0.6rem 0.8rem;border-radius:0.5rem;background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.15);cursor:pointer;transition:0.15s;">
                                ${String.fromCharCode(65 + oi)}. ${opt}
                            </div>
                        `).join('')}
                    </div>
                    <div id="quizFeedback" class="hidden mt-3 p-3 rounded-lg text-sm"></div>
                    <button id="quizNextBtn" class="hidden mt-3 px-4 py-1.5 bg-primary rounded text-sm text-white font-medium">下一题</button>
                </div>
            `;
        } else {
            // 判断题
            container.innerHTML = `
                <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>${idx + 1} / ${total}</span>
                    <span class="text-primary font-medium">得分: ${state.score}</span>
                </div>
                <div class="mastery-bar mb-3"><div class="fill" style="width:${(idx / total) * 100}%;"></div></div>
                <div class="quiz-card">
                    <div class="q">以下描述是否正确？</div>
                    <div class="text-base text-white font-medium my-3 p-3 bg-slate-800/50 rounded-lg">${q.question}</div>
                    <div class="flex gap-3" id="quizOptions">
                        <div class="quiz-option flex-1 text-center p-3 rounded-lg" data-opt="true" style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.15);cursor:pointer;transition:0.15s;">✅ 正确</div>
                        <div class="quiz-option flex-1 text-center p-3 rounded-lg" data-opt="false" style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.15);cursor:pointer;transition:0.15s;">❌ 错误</div>
                    </div>
                    <div id="quizFeedback" class="hidden mt-3 p-3 rounded-lg text-sm"></div>
                    <button id="quizNextBtn" class="hidden mt-3 px-4 py-1.5 bg-primary rounded text-sm text-white font-medium">下一题</button>
                </div>
            `;
        }

        // 选项点击
        container.querySelectorAll('.quiz-option').forEach(el => {
            el.addEventListener('click', () => this._handleQuizAnswer(el, state, container));
        });
    }

    _handleQuizAnswer(el, state, container) {
        const q = state.questions[state.currentIndex];
        const selected = el.dataset.opt;
        const isCorrect = selected === String(q.type === 'tf' ? q.correctAnswer : q.correctIndex);

        // 禁用所有选项
        container.querySelectorAll('.quiz-option').forEach(opt => {
            opt.style.pointerEvents = 'none';
            const oVal = opt.dataset.opt;
            if (oVal === selected) {
                opt.style.borderColor = isCorrect ? '#22c55e' : '#ef4444';
                opt.style.background = isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
            }
            // 显示正确答案
            if (oVal === String(q.type === 'tf' ? q.correctAnswer : q.correctIndex)) {
                opt.style.borderColor = '#22c55e';
            }
        });

        // 反馈
        const fb = container.querySelector('#quizFeedback');
        fb.classList.remove('hidden');
        state.answers.push({ question: q.question, correct: isCorrect, conceptName: q.conceptName });

        if (isCorrect) {
            state.score += 1;
            fb.innerHTML = '<span style="color:#22c55e;">✅ 正确！</span>';
            fb.style.background = 'rgba(34,197,94,0.1)';
        } else {
            fb.innerHTML = `<div style="color:#ef4444;">❌ 答错了</div><div style="color:rgba(255,255,255,0.6);margin-top:0.3rem;">${q.explanation}</div>`;
            fb.style.background = 'rgba(239,68,68,0.1)';
            state.misses.push(q.conceptName);

            // 错题 → 自动生成 Anki 卡片
            if (this.ankiEngine) {
                const card = this.ankiEngine.addQuizMissCard(q.conceptName, q.explanation);
                fb.innerHTML += `<div style="color:#a855f7;font-size:0.75rem;margin-top:0.5rem;">🃏 已添加到 Review 抽认卡</div>`;
            }
        }

        // 更新得分
        const scoreEl = container.querySelector('.text-primary.font-medium');
        if (scoreEl) scoreEl.textContent = `得分: ${state.score}`;

        // 显示下一题按钮
        const nextBtn = container.querySelector('#quizNextBtn');
        nextBtn.classList.remove('hidden');
        nextBtn.addEventListener('click', () => {
            state.currentIndex++;
            if (state.currentIndex >= state.total) {
                state.completed = true;
            }
            this.renderStudyQuiz(container);
        });
    }

    _renderQuizResult(container, state) {
        const total = state.total;
        const score = state.score;
        const pct = Math.round((score / total) * 100);
        const misses = [...new Set(state.misses)];
        const grade = pct >= 90 ? '🌟 优秀' : pct >= 70 ? '👍 良好' : pct >= 50 ? '💪 继续加油' : '📚 需要复习';

        container.innerHTML = `
            <div class="glass" style="padding:1rem;text-align:center;">
                <div style="font-size:2rem;font-weight:800;color:${pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444'};">${score}/${total}</div>
                <div class="text-sm text-gray-400 mt-1">${grade}</div>
                <div class="mastery-bar mt-3"><div class="fill" style="width:${pct}%;"></div></div>
            </div>
            ${misses.length > 0 ? `
                <div class="glass mt-3" style="padding:0.75rem;">
                    <div class="text-xs text-gray-400 mb-2">薄弱概念（已加入 Review 抽认卡）</div>
                    ${misses.map(m => `<div class="text-sm text-gray-200 py-1">• ${m}</div>`).join('')}
                </div>
            ` : `
                <div class="glass mt-3" style="padding:0.75rem;text-align:center;">
                    <div style="color:#22c55e;">🎉 全部答对！太棒了！</div>
                </div>
            `}
            <div class="flex gap-2 mt-3">
                <button id="quizRetryBtn" class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">重新测试</button>
                <button id="quizReviewBtn" class="flex-1 py-2 bg-primary hover:bg-primary/80 rounded text-sm text-white transition">去复习</button>
            </div>
        `;

        container.querySelector('#quizRetryBtn')?.addEventListener('click', () => {
            this._quizState = null;
            this.renderStudyQuiz(container);
        });
        container.querySelector('#quizReviewBtn')?.addEventListener('click', () => {
            document.querySelector('[data-pane="review-pane"]')?.click();
            this.renderReviewTab('review');
        });
    }

    renderStudyGoals(container) {
        const data = this.currentData;
        const report = data.agentReport || {};
        const gaps = report.gaps || [];
        const actions = report.actions || [];
        const insights = report.insights || [];

        const goals = [
            ...gaps.map((g, i) => ({ id: `gap_${i}`, text: `补全: ${g}`, done: false })),
            ...actions.map((a, i) => ({ id: `action_${i}`, text: `执行: ${a}`, done: false })),
            ...insights.slice(0, 2).map((ins, i) => ({ id: `insight_${i}`, text: `理解: ${ins}`, done: false }))
        ];

        // 从 localStorage 加载进度
        try {
            const saved = localStorage.getItem('researchgraph_study_goals');
            if (saved) {
                const savedGoals = JSON.parse(saved);
                for (const goal of goals) {
                    const found = savedGoals.find(g => g.id === goal.id);
                    if (found) goal.done = found.done;
                }
            }
        } catch (e) {}

        const total = goals.length;
        const done = goals.filter(g => g.done).length;

        container.innerHTML = `
            <div class="glass mb-3" style="padding:0.75rem;">
                <div class="flex items-center justify-between">
                    <span class="font-medium text-white">学习目标进度</span>
                    <span class="text-sm">${done}/${total} 完成</span>
                </div>
                <div class="mastery-bar mt-2">
                    <div class="fill" style="width:${total > 0 ? (done / total * 100) : 0}%;background:linear-gradient(90deg,#6366f1,#22c55e);"></div>
                </div>
            </div>
            ${goals.map((g, i) => `
                <label class="concept-card flex items-start gap-3 cursor-pointer" style="border-left-color:${g.done ? '#22c55e' : '#6366f1'}">
                    <input type="checkbox" data-goal="${g.id}" ${g.done ? 'checked' : ''} class="mt-1 w-4 h-4 rounded accent-green-500 cursor-pointer">
                    <div>
                        <div class="text-sm" style="color:${g.done ? 'rgba(255,255,255,0.5)' : '#fff'};text-decoration:${g.done ? 'line-through' : 'none'}">${g.text}</div>
                    </div>
                </label>
            `).join('')}
        `;

        container.querySelectorAll('input[data-goal]').forEach(cb => {
            cb.addEventListener('change', () => {
                const goalId = cb.dataset.goal;
                for (const g of goals) {
                    if (g.id === goalId) { g.done = cb.checked; break; }
                }
                localStorage.setItem('researchgraph_study_goals', JSON.stringify(goals));
                this.renderStudyGoals(container);
            });
        });
    }

    // ─── Review 面板 ───────────────────────────────────────────

    renderReviewTab(tab) {
        const container = document.getElementById('reviewContent');
        if (!container) return;
        switch (tab) {
            case 'review': this.renderReviewMode(container); break;
            case 'tree': this.renderKnowledgeTree(container); break;
            case 'stats': this.renderReviewStats(container); break;
            default: this.renderReviewMode(container);
        }
        // 知识树和统计面板显示引导
        if (tab === 'tree' || tab === 'stats') {
            this._renderGuidance(container);
        }
    }

    renderReviewMode(container) {
        if (!this.ankiEngine || this.ankiEngine.data.cards.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="min-height:200px;">
                    <i class="fa fa-refresh text-4xl mb-3 opacity-30"></i>
                    <p class="text-sm">Run an analysis first to generate flashcards.</p>
                </div>
            `;
            return;
        }

        const stats = this.ankiEngine.getStats();
        const dueCards = this.ankiEngine.getDueCards();

        // 复习队列状态
        if (this._reviewQueue && this._reviewQueue.length > 0) {
            this._showCurrentFlashcard(container);
            return;
        }

        if (dueCards.length === 0) {
            // 今日无待复习
            const byLayer = this.ankiEngine.getCardsByLayer();
            container.innerHTML = `
                <div class="stat-card mb-4">
                    <div class="num" style="color:#22c55e;">🎉 今日复习完成</div>
                    <div class="label">全部 ${stats.totalCards} 张卡片已就绪</div>
                </div>
                <div class="glass" style="padding:0.75rem;">
                    <div class="text-xs text-gray-400 space-y-1">
                        <div class="flex justify-between"><span>总卡片</span><span class="text-white">${stats.totalCards}</span></div>
                        <div class="flex justify-between"><span>累计复习</span><span class="text-white">${stats.totalReviews} 次</span></div>
                        <div class="flex justify-between"><span>连续天数</span><span class="text-white">${stats.streak} 天</span></div>
                        <div class="flex justify-between"><span>加深分析</span><span class="text-white">${stats.deepDiveCount} 次</span></div>
                    </div>
                </div>
                <button id="startReviewBtn" class="btn-primary w-full mt-3 py-2 rounded-lg font-medium text-sm">开始复习（${dueCards.length} 张待复习）</button>
            `;
            const btn = container.querySelector('#startReviewBtn');
            if (btn) btn.addEventListener('click', () => this._startReviewSession());
            return;
        }

        // 有待复习卡片
        container.innerHTML = `
            <div class="stat-card mb-3">
                <div class="num" style="color:#fbbf24;">${dueCards.length}</div>
                <div class="label">今日待复习</div>
                <div class="mastery-bar mt-2"><div class="fill" style="width:${stats.totalCards > 0 ? (stats.totalReviews % 100) : 0}%;"></div></div>
            </div>
            <div class="glass text-xs text-gray-400 mb-3 p-3 space-y-1">
                <div class="flex justify-between"><span>总卡片</span><span class="text-white">${stats.totalCards}</span></div>
                <div class="flex justify-between"><span>累计复习</span><span class="text-white">${stats.totalReviews} 次</span></div>
                <div class="flex justify-between"><span>连续天数</span><span class="text-white">${stats.streak} 天</span></div>
                <div class="flex justify-between"><span>加深分析</span><span class="text-white">${stats.deepDiveCount} 次</span></div>
            </div>
            <button id="startReviewBtn" class="btn-primary w-full py-3 rounded-lg font-medium text-sm">
                <i class="fa fa-play"></i> 开始复习（${dueCards.length} 张）
            </button>
        `;
        const btn = container.querySelector('#startReviewBtn');
        if (btn) btn.addEventListener('click', () => this._startReviewSession());
    }

    _startReviewSession() {
        this._reviewQueue = this.ankiEngine.getDueCards();
        this._reviewQueue = this._shuffleArray(this._reviewQueue);
        this._reviewIndex = 0;
        this._showCurrentFlashcard(document.getElementById('reviewContent'));
    }

    _showCurrentFlashcard(container) {
        if (!this._reviewQueue || this._reviewIndex >= this._reviewQueue.length) {
            this._reviewQueue = null;
            this.renderReviewMode(container);
            return;
        }

        const card = this._reviewQueue[this._reviewIndex];
        const totalCards = this._reviewQueue.length;

        container.innerHTML = `
            <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>${this._reviewIndex + 1} / ${totalCards}</span>
                <span class="layer-badge">Layer ${card.layer} · ${this._cardTypeLabel(card.sourceType)}</span>
            </div>
            <div class="flashcard">
                <div class="front" id="cardFront">${card.front}</div>
                <div class="back" id="cardBack">${card.back}</div>
                <div style="margin-top:1rem;">
                    <button id="revealAnswerBtn" class="px-6 py-2 bg-primary hover:bg-primary/80 rounded text-sm text-white transition">
                        <i class="fa fa-eye"></i> 显示答案
                    </button>
                </div>
                <div class="rating-btns hidden" id="ratingBtns">
                    <button class="rating-0" data-rating="0">0</button>
                    <button class="rating-1" data-rating="1">1</button>
                    <button class="rating-2" data-rating="2">2</button>
                    <button class="rating-3" data-rating="3">3</button>
                    <button class="rating-4" data-rating="4">4</button>
                    <button class="rating-5" data-rating="5">5</button>
                </div>
                <div class="text-xs text-gray-500 mt-2">
                    <span>忘记</span><span class="mx-4">完美回忆</span>
                </div>
            </div>
        `;

        container.querySelector('#revealAnswerBtn').addEventListener('click', () => {
            document.getElementById('cardBack').classList.add('show');
            document.getElementById('revealAnswerBtn').classList.add('hidden');
            document.getElementById('ratingBtns').classList.remove('hidden');
        });

        container.querySelectorAll('.rating-btns button').forEach(btn => {
            btn.addEventListener('click', () => {
                const rating = parseInt(btn.dataset.rating);
                this._handleCardRating(card, rating);
            });
        });
    }

    _handleCardRating(card, rating) {
        if (!this.ankiEngine) return;

        const result = this.ankiEngine.rateCard(card.id, rating);

        // 如果触发加深分析
        if (result.triggeredDeepDive) {
            const conceptName = card.front.replace(/^什么是「/, '').replace(/」？$/, '');
            this._triggerDeepDive(conceptName, card.sourceId, card.layer + 1);
        }

        // 下一张
        this._reviewIndex++;
        const container = document.getElementById('reviewContent');
        if (this._reviewIndex >= this._reviewQueue.length) {
            // 复习完成
            this._reviewQueue = null;
            const stats = this.ankiEngine.getStats();
            container.innerHTML = `
                <div class="stat-card mb-4">
                    <div class="num" style="color:#22c55e;">🎉 本轮复习完成</div>
                    <div class="label">共复习 ${stats.todayReviews} 次 · 连续 ${stats.streak} 天</div>
                </div>
                <button id="backReviewBtn" class="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">返回</button>
            `;
            container.querySelector('#backReviewBtn')?.addEventListener('click', () => this.renderReviewMode(container));
            this.renderReviewTab('stats');
            this.showToast('复习完成！');
        } else {
            this._showCurrentFlashcard(container);
        }
    }

    _triggerDeepDive(conceptName, conceptId, targetLayer) {
        if (!this.currentData) return;
        this.showToast(`正在加深分析「${conceptName}」...`);

        const baseUrl = this.settings.backendUrl || '';

        // 准备上下文：找到原始概念在文本中的内容
        const concepts = this.currentData.concepts || [];
        const originalConcept = concepts.find(c => c.id === conceptId || c.name === conceptName);
        const contextText = document.getElementById('noteInput')?.value?.slice(0, 2000) || '';

        const payload = {
            conceptName,
            conceptId: originalConcept?.id || conceptId,
            originalContext: contextText,
            layer: targetLayer,
            previousRatings: [2]  // 触发加深说明评分<3
        };

        // 后端 deepdive
        fetch(`${baseUrl}/api/deepdive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, accessCode: this.settings.accessCode || '' })
        })
        .then(resp => resp.ok ? resp.json() : Promise.reject('后端不可用'))
        .then(aiResult => {
            if (!this.ankiEngine) return;
            const newCardIds = this.ankiEngine.generateDeepDiveCards(aiResult, conceptName, targetLayer);
            this.ankiEngine.recordDeepDive(conceptId || conceptName, targetLayer, aiResult, newCardIds);
            this.showToast(`加深分析完成，新增 ${newCardIds.length} 张卡片`);
            this.refreshReviewStats();
        })
        .catch(err => {
            // 后端不可用时使用本地 fallback
            console.warn('Deep dive fallback:', err);
            const fallbackResult = this._localDeepDive(conceptName, targetLayer);
            if (this.ankiEngine) {
                const newCardIds = this.ankiEngine.generateDeepDiveCards(fallbackResult, conceptName, targetLayer);
                this.ankiEngine.recordDeepDive(conceptName, targetLayer, fallbackResult, newCardIds);
                this.showToast(`本地加深完成，新增 ${newCardIds.length} 张卡片`);
                this.refreshReviewStats();
            }
        });
    }

    _localDeepDive(conceptName, layer) {
        // 本地 fallback: 基于原有数据生成加深材料
        const data = this.currentData;
        const concepts = data.concepts || [];
        const original = concepts.find(c => c.name === conceptName);

        return {
            subConcepts: [
                { name: `${conceptName} 的核心要素`, definition: original?.definition || `对「${conceptName}」的深入拆解。`, example: `结合实际材料分析「${conceptName}」的具体表现。` },
                { name: `${conceptName} 的实践路径`, definition: `如何在实际研究或学习中运用「${conceptName}」的方法论。`, example: `在论文阅读和课堂讨论中主动识别「${conceptName}」的应用场景。` }
            ],
            analogy: `「${conceptName}」就像搭建积木——每个子概念都是一块积木，理解了每块积木的拼接方式，也就掌握了整个知识结构。`,
            prerequisites: [`对「${conceptName}」所在领域的基础背景有一定了解`, `熟悉相关的基础概念和术语体系`],
            contrasts: concepts.filter(c => c.id !== (original?.id || '') && c.importance >= 3).slice(0, 2).map(c => ({
                otherConcept: c.name,
                difference: `「${c.name}」更侧重${c.category || '不同维度'}，而「${conceptName}」关注${original?.category || '另一维度'}。两者是互补关系而非替代关系。`
            })),
            argumentChain: layer >= 2 ? [
                `从「${conceptName}」的定义出发`,
                `识别其在材料中的核心论点`,
                `追踪其与其他概念的逻辑关联`,
                `评估其论证的完整性`,
                `形成对该概念的批判性理解`
            ] : [],
            applicationScenarios: layer >= 2 ? [
                `在课程论文中使用「${conceptName}」作为分析框架`,
                `在小组讨论中用「${conceptName}」解释相关现象`,
                `在考试复习中将「${conceptName}」与其他概念做对比`
            ] : []
        };
    }

    processDeepDive(pending) {
        if (this._deepDiveRunning) return;
        this._deepDiveRunning = true;
        this._triggerDeepDive(pending.conceptName, pending.conceptId, pending.layer);
        setTimeout(() => { this._deepDiveRunning = false; }, 5000);
    }

    // ─── 知识树 ────────────────────────────────────────────────

    renderKnowledgeTree(container) {
        if (!this.ankiEngine || this.ankiEngine.data.cards.length === 0) {
            container.innerHTML = '<div class="empty-state" style="min-height:200px;"><i class="fa fa-sitemap text-4xl mb-3 opacity-30"></i><p class="text-sm">No flashcards yet. Run an analysis first.</p></div>';
            return;
        }

        const cards = this.ankiEngine.data.cards;
        const stats = this.ankiEngine.getStats();

        // 按概念名分组
        const conceptGroups = {};
        for (const card of cards) {
            let key = card.metadata?.parentConcept || null;
            if (!key) {
                // 尝试从 front 提取概念名
                const match = card.front.match(/「([^」]+)」/);
                key = match ? match[1] : card.sourceId;
            }
            if (!conceptGroups[key]) conceptGroups[key] = [];
            conceptGroups[key].push(card);
        }

        const mastery = stats.conceptMastery || {};

        container.innerHTML = `
            <div class="text-xs text-gray-500 mb-2">按概念分组的卡片知识树 · 圆点表示掌握度</div>
            ${Object.entries(conceptGroups).map(([conceptName, conceptCards]) => {
                const cm = mastery[conceptName];
                const avgRating = cm ? Math.round(cm.avgRating * 10) / 10 : '—';
                const topCards = conceptCards.sort((a, b) => a.layer - b.layer);
                return `
                    <div class="tree-node">
                        <i class="fa fa-book text-primary"></i>
                        <span class="font-medium text-white">${conceptName}</span>
                        <span class="text-xs text-gray-500">(${conceptCards.length} 卡 · avg ${avgRating})</span>
                    </div>
                    <div class="tree-indent">
                        ${topCards.map(c => {
                            const dotClass = c.lastRating !== null
                                ? (c.lastRating >= 4 ? 'filled good' : c.lastRating >= 3 ? 'filled weak' : 'filled poor')
                                : '';
                            return `
                                <div class="tree-node" style="font-size:0.78rem;">
                                    <span class="mastery-dots"><span class="dot ${dotClass}"></span></span>
                                    <span class="text-gray-400">[L${c.layer}]</span>
                                    <span style="color:rgba(255,255,255,0.7)">${c.front.length > 30 ? c.front.slice(0, 30) + '…' : c.front}</span>
                                    <span class="text-xs text-gray-600">${c.interval > 0 ? c.interval + 'd' : 'new'}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }).join('')}
        `;
    }

    // ─── 统计 ──────────────────────────────────────────────────

    renderReviewStats(container) {
        if (!this.ankiEngine) {
            container.innerHTML = '<div class="empty-state"><p class="text-sm">Anki engine not available.</p></div>';
            return;
        }
        const stats = this.ankiEngine.getStats();

        const layerLabels = ['初次分析', '一次加深', '二次加深'];
        const totalInLayer = stats.byLayer;

        container.innerHTML = `
            <div class="grid grid-cols-3 gap-3 mb-4">
                <div class="stat-card"><div class="num">${stats.totalReviews}</div><div class="label">累计复习</div></div>
                <div class="stat-card"><div class="num" style="color:#22c55e;">${stats.streak}</div><div class="label">连续天数</div></div>
                <div class="stat-card"><div class="num" style="color:#fbbf24;">${stats.dueCount}</div><div class="label">待复习</div></div>
            </div>
            <div class="grid grid-cols-3 gap-3 mb-4">
                <div class="stat-card"><div class="num">${stats.totalCards}</div><div class="label">总卡片</div></div>
                <div class="stat-card"><div class="num" style="color:#a855f7;">${stats.deepDiveCount}</div><div class="label">加深分析</div></div>
                <div class="stat-card"><div class="num" style="color:#06b6d4;">${stats.todayReviews}</div><div class="label">今日复习</div></div>
            </div>
            <div class="glass" style="padding:0.75rem;">
                <h4 class="font-medium text-white text-sm mb-3">各层级掌握率</h4>
                ${[0, 1, 2].map(layer => {
                    const mastery = stats.masteryByLayer[layer] || 0;
                    const total = totalInLayer[layer] || 0;
                    const width = Math.round(mastery * 100);
                    return `
                        <div class="mb-2">
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-400">${layerLabels[layer]} (${total} 卡)</span>
                                <span class="${width >= 70 ? 'text-green-400' : width >= 40 ? 'text-yellow-400' : 'text-red-400'}">${width}%</span>
                            </div>
                            <div class="mastery-bar"><div class="fill" style="width:${width}%;"></div></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    refreshReviewStats() {
        // 如果 Review 标签处于激活状态，刷新它
        const activeReviewTab = document.querySelector('[data-review-tab].bg-primary')?.dataset.reviewTab;
        if (activeReviewTab) {
            this.renderReviewTab(activeReviewTab);
        }
        // 更新侧边栏徽标（小红点）
        if (this.ankiEngine) {
            const due = this.ankiEngine.getDueCards().length;
            const sidebarBtn = document.querySelector('.sidebar-btn[data-pane="review-pane"]');
            if (sidebarBtn) {
                const existing = sidebarBtn.querySelector('.due-badge');
                if (existing) existing.remove();
                if (due > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'due-badge';
                    badge.style.cssText = 'position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:1rem;min-width:1rem;text-align:center;';
                    badge.textContent = due > 99 ? '99+' : due;
                    sidebarBtn.style.position = 'relative';
                    sidebarBtn.appendChild(badge);
                }
            }
        }
    }

    _cardTypeLabel(type) {
        const labels = {
            concept: '概念', relationship: '关系', gap: '缺口',
            subconcept: '子概念', analogy: '类比', prerequisite: '预修知识',
            contrast: '辨析', application: '应用', argumentChain: '论证链'
        };
        return labels[type] || type;
    }

    _shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ─── 一键学习模式 ─────────────────────────────────────────

    _startGuidedLearning() {
        // 步进定义: { id, pane, tab, label, autoMs: 自动跳转毫秒(0=等待用户) }
        const hasData = !!this.currentData;
        this._learnSteps = [
            ...(hasData ? [] : [{ id: 'input', pane: 'input-pane', tab: null, label: '📄 粘贴或上传学习材料', autoMs: 0 }]),
            { id: 'report', pane: 'report-pane', tab: null, label: '📋 查看 Agent 分析报告', autoMs: 3000 },
            { id: 'concepts', pane: 'study-pane', tab: 'concepts', label: '📘 浏览核心概念', autoMs: 2500 },
            { id: 'quiz', pane: 'study-pane', tab: 'quiz', label: '✏️ 做自测检验掌握度', autoMs: 0 },
            { id: 'review', pane: 'review-pane', tab: 'review', label: '🃏 复习抽认卡巩固', autoMs: 0 },
            { id: 'done', pane: null, tab: null, label: '🎉 学习完成！', autoMs: 0 },
        ];
        this._learnIndex = 0;
        this._learnTimer = null;

        // 显示引导条
        const bar = document.getElementById('learnGuide');
        if (bar) bar.classList.add('show');

        // 绑定按钮
        document.getElementById('learnNextBtn').onclick = () => this._advanceLearning();
        document.getElementById('learnSkipBtn').onclick = () => this._endLearning();

        this._renderLearningStep();
    }

    _renderLearningStep() {
        const steps = this._learnSteps;
        if (!steps || this._learnIndex >= steps.length) {
            this._endLearning();
            return;
        }

        const step = steps[this._learnIndex];
        const bar = document.getElementById('learnGuide');
        if (!bar) return;

        // 更新步进点
        const dots = document.getElementById('learnSteps');
        if (dots) {
            dots.innerHTML = steps.map((s, i) =>
                `<div class="step-dot ${i < this._learnIndex ? 'done' : i === this._learnIndex ? 'active' : ''}"></div>`
            ).join('');
        }

        // 更新标签
        document.getElementById('learnStepLabel').textContent = `${this._learnIndex + 1}/${steps.length}`;
        document.getElementById('learnStepTitle').textContent = step.label;

        // 切换面板
        if (step.pane) {
            const paneBtn = document.querySelector(`[data-pane="${step.pane}"]`);
            if (paneBtn) paneBtn.click();
            // 切 Study 内标签
            if (step.pane === 'study-pane' && step.tab) {
                setTimeout(() => {
                    document.querySelectorAll('[data-study-tab]').forEach(b => {
                        b.className = 'study-tab-btn text-xs px-3 py-1.5 rounded bg-slate-700 text-gray-300';
                        if (b.dataset.studyTab === step.tab) {
                            b.className = 'study-tab-btn text-xs px-3 py-1.5 rounded bg-primary text-white font-medium';
                        }
                    });
                    this.renderStudyTab(step.tab);
                }, 200);
            }
            if (step.pane === 'review-pane' && step.tab) {
                setTimeout(() => this.renderReviewTab(step.tab), 200);
            }
        }

        // 更新按钮文字
        const nextBtn = document.getElementById('learnNextBtn');
        const skipBtn = document.getElementById('learnSkipBtn');
        if (step.id === 'done') {
            nextBtn.textContent = '完成 🎉';
            nextBtn.className = 'learn-done';
            skipBtn.style.display = 'none';
        } else if (step.id === 'input') {
            nextBtn.textContent = '准备就绪 →';
            nextBtn.className = 'learn-next';
            skipBtn.style.display = '';
        } else if (step.id === 'quiz' || step.id === 'review') {
            nextBtn.textContent = '我做好了 →';
            nextBtn.className = 'learn-next';
            skipBtn.style.display = '';
        } else {
            nextBtn.textContent = '下一步 →';
            nextBtn.className = 'learn-next';
            skipBtn.style.display = '';
        }

        // 自动跳转（非交互步骤）
        if (step.autoMs > 0) {
            clearTimeout(this._learnTimer);
            this._learnTimer = setTimeout(() => this._advanceLearning(), step.autoMs);
        }
    }

    _advanceLearning() {
        clearTimeout(this._learnTimer);
        this._learnIndex++;
        this._renderLearningStep();
    }

    _endLearning() {
        clearTimeout(this._learnTimer);
        const bar = document.getElementById('learnGuide');
        if (bar) bar.classList.remove('show');
        this._learnSteps = null;
        this._learnIndex = 0;
    }

    // ─── 清理 ──────────────────────────────────────────────────

    destroy() {
        if (this._checkDeepDivesInterval) {
            clearInterval(this._checkDeepDivesInterval);
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new OntologyNoteHelper();
});
