# ResearchGraph Agent Demo 视频脚本

建议时长：2-3 分钟

## 视频标题

ResearchGraph Agent Demo - AI Research Note Mapper for Global Learners

## 录屏准备

提前打开：

1. 产品页面：`https://dark-077.github.io/ontology-note-helper/`
2. GitHub 仓库页面：`https://github.com/dark-077/ontology-note-helper`
3. GMI Cloud 模型详情页或 Playground 页面
4. 本地后端 `/api/provider` 页面：`http://localhost:3000/api/provider`

如果 GMI 额度尚未开通，可以在视频中说明：当前演示使用 fallback，后端已接入 GMI Cloud，额度开通后即可启用在线推理。

## 讲解脚本

### 0:00 - 0:20 开场

大家好，这是我们的项目 ResearchGraph Agent，一个面向海外学生和研究者的 AI 研究笔记智能体。

它的目标是帮助用户把论文、课程讲义、PPT、Word、PDF 或图片材料，快速转化为知识图谱、研究摘要、关键洞察和下一步行动建议。

### 0:20 - 0:45 场景介绍

我们的目标用户是海外学习者和跨学科研究者。他们经常需要在短时间内阅读大量英文材料，尤其是在非母语学习、论文讨论和课程展示场景下，理解成本很高。

ResearchGraph Agent 提供了一个完整工作流：Ingest、Reason、Act。也就是先导入材料，再进行结构化理解，最后输出可执行的学习和研究行动。

### 0:45 - 1:20 功能演示：导入材料

这里是产品首页。用户可以上传 PDF、Word、PPTX、图片或文本文件，也可以直接粘贴内容。

现在我点击“演示”，系统会载入一段面向海外学习者的研究材料。也可以看到，系统支持文件上传，并对旧版 `.doc`、`.ppt`、扫描版 PDF 和图片 OCR 做了提示。

### 1:20 - 1:55 功能演示：运行 Agent 分析

接下来点击“运行 Agent 分析”。

Agent 会识别材料中的核心概念，例如 ResearchGraph Agent、Overseas learners、Knowledge graph、Ontology modeling 等。右侧会生成可交互知识图谱，节点表示概念，连线表示概念之间的关系。

点击节点可以查看概念定义，点击连线可以查看关系解释。

### 1:55 - 2:25 功能演示：Agent 报告

除了图谱，系统还会生成 Agent 分析报告，包括 Summary、Key insights、Gaps / risks 和 Next actions。

这体现了我们项目不是简单的关键词抽取工具，而是一个能完成完整学习工作流的 Agent：它能帮助用户理解材料、发现缺口，并决定下一步行动。

### 2:25 - 2:45 GMI Cloud 接入说明

比赛版后端已经接入 GMI Cloud Inference Engine，使用模型 `deepseek-ai/DeepSeek-V4-Pro`。

调用链路是：前端调用 `/api/extract`，Node.js 后端安全读取环境变量中的 Token，再调用 GMI Cloud API，最后把概念、关系和 Agent 报告返回前端。

当前如果账号额度尚未开通，公开演示会使用本地 fallback。额度开通后，只需要替换有效 Token，就可以启用在线模型推理。

### 2:45 - 3:00 收尾

ResearchGraph Agent 的价值是帮助全球学习者把复杂材料变成结构化、可视化、可行动的学习计划。

这是一个面向海外真实学习场景的 AI Agent 产品。谢谢。

## 英文简短版讲解

ResearchGraph Agent is an AI research note mapper for global learners. It helps international students and researchers transform papers, lecture slides, PDFs, Word documents, and images into structured knowledge graphs and action-oriented study reports.

The workflow is Ingest, Reason, and Act. The agent first ingests academic materials, then extracts concepts and relationships, and finally generates summaries, insights, knowledge gaps, and next actions.

The competition version connects to GMI Cloud Inference Engine with the model `deepseek-ai/DeepSeek-V4-Pro`. The backend keeps the API token secure and exposes `/api/extract` for the frontend. When GMI quota is enabled, the system can switch from local fallback to online model inference.
