# 提交表单可粘贴内容

## 项目名称

ResearchGraph Agent

## 一句话介绍

面向海外学生和研究者的 AI 研究笔记智能体，将密集英文材料转化为概念图谱、学习缺口、研讨问题和可用于课堂汇报的行动计划。

## 项目简介

ResearchGraph Agent 是一个面向海外真实学习场景的 AI Agent 产品。核心洞察是：海外学生的痛点不只是“看不懂英文”，而是在非母语、跨学科、高阅读量和高讨论压力下，需要快速把论文、课程 PPT、Word 文档、PDF 和图片材料转化为可表达、可讨论、可汇报的知识结构。传统翻译工具只能翻译句子，普通笔记工具只能保存内容，通用 Chatbot 往往给出线性摘要，但无法稳定生成概念关系和下一步学习任务。

本项目提供 Ingest → Reason → Act 的完整 Agent 工作流：用户上传或粘贴学习材料后，系统自动提取文字，识别核心概念、定义、类别和概念之间的关系，生成可交互知识图谱，并输出 Summary、Key insights、Learning gaps、Next actions、30-min study plan、Seminar questions 和 Presentation outline，帮助用户把碎片化材料转化为可视化、可解释、可行动的学习与课堂讨论计划。

比赛版后端已接入 GMI Cloud Inference Engine，通过 Node.js `/api/extract` 接口调用 `deepseek-ai/DeepSeek-V4-Pro` 模型。为保护 Token，真实 API Key 只保存在后端环境变量中，不会暴露在前端代码里。当前如 GMI 额度未开通，公开演示版本会使用本地规则 fallback；额度开通后即可启用在线模型推理。

## 目标用户

海外学生、国际研究者、跨学科学习者，以及需要快速阅读英文论文、课程材料和项目文档的人。

## 核心功能

- PDF、DOCX、PPTX、TXT/MD、PNG/JPG 文件导入
- 图片 OCR 文字识别
- 核心概念和关系抽取
- 交互式知识图谱展示
- Agent 分析报告：summary、insights、learning gaps、actions
- 30 分钟学习计划、课堂研讨问题、汇报大纲
- JSON 和 PNG 导出
- GMI Cloud Inference Engine 后端接入

## Agent 工作流

Ingest：上传论文、课程讲义、PPT、Word、PDF、图片或粘贴文本。

Reason：Agent 提取核心概念、定义、类别、重要性和概念关系，生成知识图谱。

Act：Agent 输出摘要、关键洞察、知识缺口和下一步学习/研究行动建议。

## 商业落地

目标客户包括海外高校国际学生支持中心、研究生课程团队、留学服务机构、在线教育平台、文献管理工具和研究小组。商业模式可以采用 Freemium、Student Pro 月度订阅、University License 高校授权，以及接入 Notion、Obsidian、Zotero、Canvas 等平台的 API / Plugin 模式。

产品落地场景包括 International student onboarding、Seminar preparation、Literature review mapping、Course reading assistant 和 Research group knowledge base。

## GMI Cloud 使用说明

本项目后端使用 GMI Cloud Inference Engine，模型为：

```text
deepseek-ai/DeepSeek-V4-Pro
```

API Base URL：

```text
https://api.gmi-serving.com
```

调用接口：

```text
POST /v1/chat/completions
```

本项目后端接口：

```text
POST /api/extract
GET /api/provider
```

## 产品链接

```text
https://dark-077.github.io/ontology-note-helper/
```

## 代码地址

```text
https://github.com/dark-077/ontology-note-helper
```

## 当前状态说明

项目已完成前端演示、文件导入、图谱生成、Agent 报告和 GMI Cloud 后端接入。当前本地后端已经成功调用 `/api/extract`，并通过 GMI Cloud 返回 `concepts`、`relationships` 和包含 `summary / insights / gaps / actions / studyPlan / seminarQuestions / presentationOutline` 的完整 Agent 报告。
