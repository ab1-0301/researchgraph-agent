# ResearchGraph Agent

ResearchGraph Agent 是一个面向海外学生、研究者和跨学科学习者的 AI 研究笔记智能体。它可以把论文摘录、课程讲义、PPT、Word 文档、PDF 或图片中的内容转化为结构化知识图谱，并生成摘要、关键洞察、知识缺口和下一步行动建议。

本项目由原“本体论笔记助手”升级而来，比赛版定位为：**为世界而生的研究学习 Agent**。

## 目标场景

海外学生和研究者经常需要在短时间内阅读英文论文、课程材料和项目文档。ResearchGraph Agent 解决的问题是：

- 快速看懂陌生领域材料的核心概念
- 把碎片化笔记整理为概念关系图
- 发现材料中的前置知识缺口和理解风险
- 生成可执行的学习、研究或汇报准备任务
- 将结果导出为 JSON 或 PNG，用于课程汇报、论文讨论和项目展示

## Agent 工作流

```text
Ingest → Reason → Act
```

1. **Ingest**：上传 PDF、DOCX、PPTX、TXT/MD、PNG/JPG，或直接粘贴文本。
2. **Reason**：解析材料，提取概念、定义、关系、重要性和类别。
3. **Act**：输出知识图谱、研究摘要、关键洞察、知识缺口和下一步行动建议。

## 功能特点

- 文件导入：支持 PDF、DOCX、PPTX、TXT/MD、PNG/JPG
- 图片 OCR：可从图片中识别中英文文字
- Agent 分析报告：生成 summary、insights、gaps、actions
- 图谱生成：从文本中提取核心概念和关系
- 交互式图谱：可拖拽、缩放、点击查看详情
- 多格式导出：支持导出 JSON 和 PNG 图片
- 公开演示：GitHub Pages 可展示前端、本地规则和文件解析能力
- GMI 接入：Node.js 后端已接入 GMI Cloud Inference Engine API

## GMI Cloud Inference Engine 接入

比赛版后端使用 GMI Cloud Inference Engine。API 调用场景是：用户上传或粘贴学习材料并点击 Run Agent Analysis 后，前端把提取后的文本发送到 `/api/extract`，Node.js 后端再调用 GMI Cloud 模型生成概念、关系和 Agent 报告。

模型配置来自 GMI 控制台 Playground / 模型详情页：

```text
API_PROVIDER=gmi
GMI_API_BASE_URL=https://api.gmi-serving.com
GMI_MODEL_NAME=deepseek-ai/DeepSeek-V4-Pro
```

调用格式为 OpenAI Chat Completions 兼容格式：

```text
POST /v1/chat/completions
Authorization: Bearer <GMI_API_KEY>
Content-Type: application/json
```

请求参数设计：

```json
{
  "model": "deepseek-ai/DeepSeek-V4-Pro",
  "messages": [
    { "role": "system", "content": "ResearchGraph Agent system prompt" },
    { "role": "user", "content": "用户上传或粘贴的学习材料文本" }
  ],
  "temperature": 0.3,
  "response_format": { "type": "json_object" }
}
```

后端接口：

```text
POST /api/extract
GET /api/provider
```

`/api/provider` 可用于提交材料中的后端配置截图，它只显示是否已配置 base URL、model 和 token，不会返回真实 Token。`/api/extract` 已经在本地后端成功调用 GMI Cloud，并返回 `concepts`、`relationships` 和包含 `summary / insights / gaps / actions / studyPlan / seminarQuestions / presentationOutline` 的完整 `agentReport`。

公开 GitHub Pages 页面会使用本地规则 fallback 演示前端和文件解析能力；配置 `.env` 中的有效 `GMI_API_KEY` 后，本地或云端 Node.js 后端可以启用 GMI 在线模型推理。

## Agent 形态标注

本项目提交形态明确标注为 **Agent 智能体**，名称为 ResearchGraph Agent。它围绕海外学生和研究者的学习任务执行完整工作流：

```text
Ingest → Reason → Act
```

- Ingest：导入 PDF、DOCX、PPTX、TXT/MD、图片 OCR 或粘贴文本。
- Reason：调用模型提取概念、定义、类别、重要性和关系。
- Act：生成知识图谱、学习缺口、下一步行动、30 分钟学习计划、研讨问题和汇报大纲。

## 本地运行

```bash
cd ontology-note-helper
npm install
cp .env.example .env
npm start
```

然后访问：

```text
http://localhost:3000
```

本机如果 Node.js 没有加入 PATH，也可以使用已安装 Node 的绝对路径启动。

## 环境变量

`.env.example` 示例：

```text
API_PROVIDER=gmi
GMI_API_KEY=你的_GMI_Cloud_Token
GMI_API_BASE_URL=https://api.gmi-serving.com
GMI_MODEL_NAME=deepseek-ai/DeepSeek-V4-Pro
ACCESS_CODE=
PORT=3000
```

注意：真实 `.env` 不要提交到 GitHub。

## 推荐部署方式

### 前端公开演示

GitHub Pages 可用于展示：

- 文件上传
- 文字解析
- 图片 OCR
- 本地规则知识图谱
- Agent 报告面板
- JSON / PNG 导出

GitHub Pages 不能安全保存后端密钥，因此不能直接在前端放置 GMI Token。

### 完整 AI 后端部署

推荐使用 Render、Railway 或其他 Node.js 云平台部署后端。Render/Railway 只用于托管本项目的 Node.js Express API，不承担模型推理功能；实际 AI 推理、概念抽取、关系生成和 Agent 报告均由 GMI Cloud Inference Engine 完成。

在部署平台环境变量中配置：

```text
API_PROVIDER=gmi
GMI_API_KEY=你的 GMI Cloud Token
GMI_API_BASE_URL=https://api.gmi-serving.com
GMI_MODEL_NAME=deepseek-ai/DeepSeek-V4-Pro
ACCESS_CODE=可选访问码
```

Render 部署可直接使用仓库中的 `render.yaml`。部署成功后会得到一个后端地址，例如：

```text
https://researchgraph-agent-api.onrender.com
```

然后在 GitHub Pages 产品页面点击 `Settings`，填写：

```text
Backend URL = 云端后端地址
Access code = 如果云端设置了 ACCESS_CODE，则填写访问码；没有设置则留空
```

保存后，公开前端会通过云端后端调用 GMI Cloud Inference Engine。可以用以下地址验证云端后端：

```text
https://你的后端地址/api/provider
https://你的后端地址/api-proof.html
```

## 使用说明

1. 打开网站
2. 上传 PDF、DOCX、PPTX、图片或文本文件，或直接粘贴内容
3. 等待系统把文件文字提取到输入框
4. 点击“运行 Agent 分析”
5. 查看自动生成的概念节点和关系连线
6. 查看 Agent 分析报告：摘要、洞察、知识缺口、下一步行动
7. 点击节点查看概念定义，点击连线查看关系解释
8. 导出 JSON 或 PNG 图片

## 文件导入支持

- PDF：支持可复制文本型 PDF；扫描版 PDF 建议转为图片后使用 OCR
- Word：支持 `.docx`，不支持 `.doc` 旧格式
- PPT：支持 `.pptx`，不支持 `.ppt` 旧格式
- 图片：支持 `.png`、`.jpg`、`.jpeg`，使用浏览器端 OCR 识别文字
- 文本：支持 `.txt`、`.md`

## 比赛提交材料建议

建议提交材料包含：

- 项目名称：ResearchGraph Agent
- 一句话介绍：面向海外学习者的 AI 研究笔记图谱智能体
- 目标用户：海外学生、国际研究者、跨学科学习者
- 产品链接：GitHub Pages 或后端部署链接
- 代码地址：GitHub 仓库地址
- Demo 视频：展示上传材料、运行 Agent、生成图谱、查看报告、导出结果
- 后端截图：`/api/provider`、GMI 控制台模型页、GMI API 调用结果
- 技术说明：Ingest → Reason → Act 工作流、GMI API 调用链路、fallback 机制

## 注意事项

- 不要把真实 API Key 写进前端代码
- 不要把 `.env` 上传到 GitHub
- 如果公开给很多人使用，建议设置 `ACCESS_CODE`，避免 API 被大量消耗
- 当前限制单次输入最多 8000 字
- 如果 Token 曾经出现在聊天、截图或公开材料中，建议重新生成 Token

## 技术栈与第三方工具来源

| 工具 | 版本 | 来源/用途 |
|---|---:|---|
| HTML / JavaScript | 原生 | 前端页面与交互逻辑 |
| Tailwind CSS | CDN latest | 页面样式与响应式 UI |
| Cytoscape.js | 3.28.1 | 知识图谱可视化 |
| Mammoth | 1.8.0 | DOCX 文档文本提取 |
| JSZip | 3.10.1 | PPTX 压缩包与 XML 内容读取 |
| Tesseract.js | 5.1.1 | 图片 OCR 文字识别 |
| Font Awesome | 4.7.0 | 页面图标 |
| Node.js | 本地运行环境 | 后端服务运行 |
| Express | package latest | `/api/provider` 与 `/api/extract` 后端接口 |
| cors | package latest | 本地接口跨域支持 |
| dotenv | package latest | 安全读取后端环境变量 |
| GMI Cloud Inference Engine | 平台 API | 模型推理服务 |
| deepseek-ai/DeepSeek-V4-Pro | GMI 模型 | 概念抽取、关系推理和 Agent 报告生成 |

部署：GitHub Pages / Vercel / Render / Railway
