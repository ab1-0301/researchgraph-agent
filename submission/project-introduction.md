# ResearchGraph Agent 项目介绍

## 1. 项目名称

ResearchGraph Agent

## 2. 一句话介绍

ResearchGraph Agent 是一个面向海外学生和研究者的 AI 研究笔记智能体，可以把论文、课程讲义、PPT、Word、PDF 和图片材料转化为知识图谱、研究摘要、关键洞察、知识缺口和下一步行动建议。

## 3. 项目背景

海外学生、国际研究者和跨学科学习者经常需要在有限时间内阅读大量英文论文、课程材料和项目文档。传统笔记工具只能保存文本，很难帮助用户快速建立概念之间的关系，也无法主动指出材料中的理解风险和下一步学习任务。

ResearchGraph Agent 希望解决这个问题：让用户把碎片化研究材料交给 Agent，Agent 自动完成结构化理解、图谱构建和行动建议生成，帮助用户更快进入陌生领域。

核心海外洞察是：海外学生真正的痛点不只是“看不懂英文”，而是要在非母语、跨学科、高阅读量和高讨论压力下，快速把材料转化为可表达、可讨论、可汇报的知识结构。翻译工具只能翻译句子，通用聊天机器人容易给出线性摘要，传统笔记工具只能保存内容；ResearchGraph Agent 聚焦的是从阅读理解到课堂讨论和研究汇报的完整任务闭环。

## 4. 目标用户

- 海外本科生、研究生和访问学者
- 需要阅读英文论文和课程讲义的国际学生
- 跨学科项目中的研究者和学习者
- 需要快速准备课堂展示、论文讨论和项目汇报的人

## 5. 海外真实场景

一个国际研究生需要在短时间内阅读一篇英文论文和几份课程 PPT，准备小组讨论。他可以将论文摘录或 PPT 上传到 ResearchGraph Agent。系统会先提取文字，再识别核心概念和关系，生成可交互知识图谱，并输出：

- 这份材料主要讲什么
- 哪些概念最重要
- 概念之间如何连接
- 哪些前置知识可能缺失
- 下一步应该阅读、比较或准备什么

这个场景特别适合非母语学习、跨学科课程和研究讨论准备。

## 6. Agent 工作流

ResearchGraph Agent 的工作流是：

```text
Ingest → Reason → Act
```

### 6.1 Ingest：导入材料

用户可以上传或粘贴：

- PDF
- Word `.docx`
- PPT `.pptx`
- TXT / Markdown
- PNG / JPG 图片
- 直接粘贴的论文摘录、课程笔记或项目文档

系统会在浏览器端提取文字，图片会通过 OCR 识别文字。

### 6.2 Reason：结构化理解

Agent 会分析输入材料，生成：

- 5-15 个核心概念
- 每个概念的定义、类别和重要性
- 概念之间的关系
- 可视化知识图谱

### 6.3 Act：输出行动建议

Agent 不只生成图谱，还会输出面向学习和研究行动的报告：

- Summary：材料摘要
- Insights：关键洞察
- Learning gaps / risks：知识缺口和理解风险
- Next actions：下一步学习、研究或展示准备任务
- 30-min study plan：30 分钟学习计划
- Seminar questions：课堂研讨问题
- Presentation outline：汇报大纲

## 7. 核心功能

1. 多格式文件导入
2. 图片 OCR 识别
3. AI / 本地规则知识图谱生成
4. 交互式图谱查看
5. 节点和关系详情查看
6. Agent 分析报告
7. JSON 导出
8. PNG 图谱导出
9. GMI Cloud Inference Engine 后端接入
10. GitHub Pages 公开演示

## 8. GMI Cloud API 调用场景、参数设计与链路逻辑

比赛版后端已经接入 GMI Cloud Inference Engine，API 调用场景是：当用户上传或粘贴学习材料并点击 Run Agent Analysis 后，前端将提取后的文本发送到本项目后端 `/api/extract`，后端再调用 GMI Cloud 模型完成概念抽取、关系推理和 Agent 行动报告生成。

调用链路如下：

```text
前端页面
  ↓
POST /api/extract
  ↓
Node.js Express 后端读取环境变量中的 GMI Token
  ↓
POST https://api.gmi-serving.com/v1/chat/completions
  ↓
GMI Cloud Inference Engine
  ↓
deepseek-ai/DeepSeek-V4-Pro
  ↓
返回 concepts / relationships / agentReport
  ↓
前端渲染知识图谱和 Agent 报告
```

当前模型配置：

```text
API_PROVIDER=gmi
GMI_API_BASE_URL=https://api.gmi-serving.com
GMI_MODEL_NAME=deepseek-ai/DeepSeek-V4-Pro
```

GMI 请求参数设计：

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

参数说明：

- `model`：使用 GMI Cloud Inference Engine 中的 `deepseek-ai/DeepSeek-V4-Pro`。
- `messages[0]`：定义 ResearchGraph Agent 的任务、输出 JSON 结构和 Ingest → Reason → Act 工作流。
- `messages[1]`：用户上传文件或粘贴材料后提取出的文本。
- `temperature: 0.3`：降低随机性，保证概念图谱和报告结构稳定。
- `response_format: { "type": "json_object" }`：要求模型返回结构化 JSON，便于前端渲染。

后端接口：

```text
GET /api/provider
POST /api/extract
```

`/api/provider` 用于展示后端是否已配置模型平台、模型名称和 Token 状态，不会泄露真实 Token。`/api/extract` 已经在本地后端成功调用 GMI Cloud，并返回 `concepts`、`relationships` 和包含 `summary / insights / gaps / actions / studyPlan / seminarQuestions / presentationOutline` 的完整 `agentReport`。

## 9. Agent 形态标注

本项目提交形态明确标注为 Agent 智能体，名称为 ResearchGraph Agent。它不是单次摘要工具，而是围绕海外学生真实学习任务设计的 Ingest → Reason → Act 智能体：

- Ingest：接收 PDF、Word、PPTX、TXT/MD、图片 OCR 或粘贴文本。
- Reason：调用 GMI Cloud 模型识别核心概念、定义、类别、重要性和概念关系。
- Act：生成知识图谱、学习缺口、下一步行动、30 分钟学习计划、研讨问题和汇报大纲。

## 10. 现场演示可用性

作品支持现场演示。公开 GitHub Pages 页面可演示前端、文件导入、Research Learning Map 和导出能力；云端 Node.js 后端用于托管本项目 API 服务，实际模型推理仍由 GMI Cloud Inference Engine 完成。现场演示时可以展示：

1. 打开产品页面并上传或粘贴英文学习材料。
2. 在 Settings 中配置云端 Backend URL。
3. 点击 Run Agent Analysis。
4. 展示右侧 Research Learning Map。
5. 展示 Agent 分析报告。
6. 打开 `/api/provider` 证明后端已配置 GMI Cloud。
7. 打开 `/api-proof.html` 或调用 `/api/extract` 证明 GMI API 返回结构化结果。

## 11. 第三方工具来源与版本

项目使用的第三方工具如下，均用于前端展示、文件解析、图谱可视化或后端 API 服务：

| 工具 | 版本 | 来源/用途 |
|---|---:|---|
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

## 12. 技术架构

### 前端

- HTML
- Tailwind CSS
- JavaScript
- Cytoscape.js
- PDF.js
- Mammoth
- JSZip
- Tesseract.js

### 后端

- Node.js
- Express
- dotenv
- GMI Cloud Inference Engine API

### 部署

- 前端演示：GitHub Pages
- 后端托管：Render / Railway / 其他 Node.js 云平台，仅用于运行本项目 Express API
- 模型推理平台：GMI Cloud Inference Engine
- 说明：云端后端不承担模型推理功能，只负责安全读取环境变量中的 GMI Token，并转发请求到 GMI Cloud API。

## 11. 产品链接与代码地址

产品演示链接：

```text
https://dark-077.github.io/ontology-note-helper/
```

代码仓库：

```text
https://github.com/dark-077/ontology-note-helper
```

## 12. 项目价值

ResearchGraph Agent 的价值不只是“生成知识图谱”，而是把学习材料处理成一个完整的 Agent 工作流：

- 帮助海外学习者降低英文和跨学科学习门槛
- 帮助研究者快速梳理论文结构
- 帮助学生准备课堂展示和小组讨论
- 把静态笔记变成可视化、可行动的学习计划
- 可以扩展为教育平台、研究助手或知识管理工具

## 13. 商业落地路径

ResearchGraph Agent 可以从个人学习工具扩展为教育和研究场景的 SaaS 产品。

### 目标客户

- 海外高校国际学生支持中心
- 研究生课程和助教团队
- 留学服务机构
- 在线教育平台
- 文献管理和知识管理工具
- 研究小组和实验室

### 付费模式

- Freemium：免费基础图谱，高级 Agent 报告付费
- Student Pro：面向学生的月度订阅
- University License：高校或课程批量授权
- API / Plugin：接入 Notion、Obsidian、Zotero、Canvas 等学习和研究平台

### 落地场景

- International student onboarding
- Seminar preparation
- Literature review mapping
- Course reading assistant
- Research group knowledge base
- Presentation and discussion preparation

商业价值在于：它不是替用户“读一遍材料”，而是把材料转化为课堂讨论、论文阅读和研究汇报可以直接使用的产出。

## 14. 后续计划

1. 完成云端 Node.js 后端部署，让公开前端可在线调用 GMI Cloud
2. 增加多轮追问能力
3. 支持更长文档的分段分析
4. 支持更长文档的分段分析
5. 增加英文论文专用分析模板
6. 支持导出学习计划和汇报大纲
