# ResearchGraph Agent 工作流扩展设计图 v2

> 在现有 **Ingest → Reason → Act** 流程后新增 **Study → Review → 二次加深分析** 循环反馈系统，形成**螺旋式学习闭环**。

---

## 1. 核心概念：螺旋式学习闭环

区别于传统的线性流程，本设计的核心是 **Review 反馈驱动加深循环**：

```
                    ┌─────────────────────────────────────┐
                    │           初次分析                    │
                    │  Ingest → Reason → Act → Study      │
                    └─────────┬───────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Review (Anki)     │ ← ─ ─ ─ ─ ─ ─ ┐
                    │   自评 0-5          │                │
                    └────┬────────┬──────┘                │
                         │        │                        │
                    (评分≥4)    (评分<3)                   │
                         │        │                        │
                         ▼        ▼                        │
                    ┌────────┐  ┌──────────────────┐      │
                    │ 巩固   │  │ 二次加深分析     │      │
                    │ (间隔  │  │ Deep Dive on     │      │
                    │ 拉长)  │  │ 薄弱概念         │      │
                    └────────┘  └────────┬─────────┘      │
                                         │                  │
                                         ▼                  │
                                   ┌──────────────┐        │
                                   │ 加深 Study    │        │
                                   │ (更细粒度     │        │
                                   │  概念+练习)   │        │
                                   └──────┬───────┘        │
                                          │                  │
                                          ▼                  │
                                    ┌──────────┐            │
                                    │ Review   ├────────────┘
                                    │ (新卡片)  │  再次自评
                                    └──────────┘  若仍 < 3
                                                  再入循环
```

**核心机制：** 每次 Review 的评分决定卡片走向——高分卡片正常间隔拉长，**低分卡片（< 3）触发一次加深分析**，生成更细粒度的子概念、更具体的例子和更简单的预修知识卡片，然后再次进入复习循环。每次循环都让概念理解加深一层。

---

## 2. 加深循环的层数定义

```
初层 (Layer 0): 原始分析 → 基础卡片
  │
  ├─ 概念定义卡 (浅层: "什么是 X？")
  ├─ 关系卡
  └─ 缺口卡
       │
       ▼ (某概念评分 < 3)
       │
第一次加深 (Layer 1): 对薄弱概念的二次分析
  │
  ├─ 子概念拆分: "X 由哪几部分组成？"
  ├─ 具体例子: "X 在场景 Y 中如何应用？"
  ├─ 类比理解: "X 类似于日常生活中的什么？"
  ├─ 预修知识: "要理解 X，需要先知道什么？"
  └─ 对比辨析: "X 与相似概念的区别？"
       │
       ▼ (仍评分 < 3)
       │
第二次加深 (Layer 2): 进一步拆解
  │
  ├─ X 的子概念的更细粒度拆解
  ├─ X 相关的完整案例流程
  └─ X 在材料中的完整论证链追踪
```

每层产生的卡片都带有 `layer` 字段，SM-2 算法按层独立调度。

---

## 3. 加深分析（DeepDive）的数据流

### 3.1 触发条件

当 Review 中用户对某张卡片的评分 **< 3** 时：

```javascript
// app.js — Review 评分回调
function onCardRating(card, rating) {
  // 更新 SM-2 调度
  ankiEngine.updateCard(card.id, rating);

  if (rating < 3 && card.layer < MAX_DEEP_DIVE_LAYERS) {
    // 触发加深分析（异步，不阻塞当前复习流程）
    triggerDeepDive(card.sourceType, card.sourceId, card.layer + 1);
  }
}
```

### 3.2 加深分析请求

前端向后端发送加深分析请求：

```
POST /api/deepdive
Body: {
  "conceptId": "knowledge_graph",
  "conceptName": "Knowledge Graph",
  "originalContext": "原来料中的相关段落...",
  "layer": 1,           // 当前要生成的层数
  "previousCards": [     // 用户之前答错的具体记录
    { "front": "...", "back": "...", "rating": 2 }
  ]
}
```

### 3.3 后端 AI 加深分析

后端调用 GMI Cloud，使用专门的 deepdive system prompt：

```
You are ResearchGraph Agent's Deep Dive mode.
The user struggled with the concept "[概念名]" (rated their understanding low).

Layer 1: Generate foundational deepening material
- Break the concept into 2-4 sub-concepts/components
- Provide a concrete real-world example
- Give a relatable analogy
- Identify prerequisite knowledge needed
- Contrast with similar concepts

Layer 2: Generate advanced deepening material
- Trace the full argument chain involving this concept in the original material
- Analyze edge cases and limitations
- Connect to related concepts outside the original material
- Generate application scenarios for hands-on practice

Return strict JSON:
{
  "subConcepts": [{ "name": "...", "definition": "...", "example": "..." }],
  "analogy": "...",
  "prerequisites": ["..."],
  "contrasts": [{ "otherConcept": "...", "difference": "..." }],
  "argumentChain": ["..."],  // layer >= 2
  "applicationScenarios": ["..."]  // layer >= 2
}
```

### 3.4 加深结果 → 新卡片

后端返回的加深结果自动生成新的 Anki 卡片：

| 原始卡片 (评分<3) | 加深后生成的新卡片 |
|---|---|
| 概念定义卡 "什么是 X？" | 子概念卡 "X 的子概念 A 是什么？" |
| | 例子卡 "X 在现实中的例子？" |
| | 类比卡 "X 类似于什么？" |
| | 预修知识卡 "要理解 X 需要先知道什么？" |
| | 辨析卡 "X 与 Y 的区别？" |

新卡片初始化为 `layer = parentLayer + 1`，与原卡片独立调度。

---

## 4. Review 面板升级：循环视图

Review 面板新增**知识树视图**，展示概念的学习深度层级：

```
┌────────────────────────────────────────────┐
│  Review 面板                               │
│                                            │
│  [复习模式] [知识树] [统计]                │
│                                            │
│  ── 知识树视图 ──                         │
│                                            │
│  📘 Knowledge Graph           Layer 0  ★★★ │
│  ├─ 📘 子概念: Node/Edge     Layer 1  ★★   │ ← 复习中
│  │  ├─ 📘 例子: 社交网络     Layer 2  ☆    │ ← 新增待复习
│  │  └─ 📘 类比: 地铁线路图   Layer 2  ☆    │
│  ├─ 📗 类比 (1条)           Layer 1  ★★★★ │
│  └─ 📕 预修知识 (2条)       Layer 1  ★★   │
│                                            │
│  ★ = 掌握度 (基于最近评分)                 │
│                                            │
│  ── 复习模式 ──                            │
│                                            │
│  📇 今日待复习: 8 张                       │
│     ├─ 初次分析卡片: 3 张                  │
│     ├─ 加深分析卡片: 4 张                  │
│     └─ 已逾期卡片: 1 张                    │
│                                            │
│  ┌──────────────────────────────────┐      │
│  │  什么是 Knowledge Graph 的       │      │
│  │  子概念 "Node"？                 │      │
│  │                                  │      │
│  │             [显示答案]           │      │
│  └──────────────────────────────────┘      │
└────────────────────────────────────────────┘
```

---

## 5. 完整工作流（含循环）

```
┌───────────────────────────────────────────────────────────────┐
│                    初次分析（线性）                            │
│  Ingest → Reason → Act → Study → Review                      │
│  (文件)   (概念)   (图谱)  (学习)  (Anki初始卡片)             │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼ 某卡片评分 < 3
              ┌─────────────────────┐
              │  触发二次加深分析    │
              │  POST /api/deepdive │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  生成加深材料        │
              │  - 子概念            │
              │  - 例子/类比        │
              │  - 预修知识          │
              │  - 对比辨析          │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  生成 Layer 1 卡片   │
              │  加入 Review 队列    │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  用户复习 Layer 1    │
              │  评分决定是否再加深  │
              └──────────┬──────────┘
                         │
                    ┌────┴────┐
                    ▼         ▼
              评分≥4      评分<3
              巩固拉长    Layer 2 加深
              间隔        (回到 DeepDive)
```

---

## 6. 新增/修改文件清单

| 文件 | 变更类型 | 变更内容 |
|---|---|---|
| `tools/anki-engine.js` | **新增** | SM-2 算法 + 加深循环调度逻辑 |
| `server.js` | 修改 | 新增 `deepDive` tool、`POST /api/deepdive` 路由、扩展 pipeline |
| `tools/execution-engine.js` | 修改 | pipeline 增加 `deepDive` 步骤类型 |
| `index.html` | 修改 | 新增 Review 面板（含知识树视图）+ 加深分析状态指示 |
| `app.js` | 修改 | 新增 ReviewPane 完整逻辑、加深循环触发、知识树渲染、SM-2 本地存储 |
| `styles.css` (内联) | 修改 | 知识树、加深层级、掌握度指示器样式 |

---

## 7. 数据存储模型

```javascript
// localStorage 数据结构

// 1. 卡片库
cards: [
  {
    id: "card_concept_knowledge_graph",
    front: "什么是 Knowledge Graph？",
    back: "用节点和边表示概念之间关系的结构化知识表示方法。",
    sourceType: "concept",      // concept | relationship | gap | subconcept | example | analogy | prerequisite | contrast
    sourceId: "knowledge_graph",
    layer: 0,                    // 0=初次, 1=一次加深, 2=二次加深
    parentCardId: null,          // 由哪张卡片加深而来（方便追溯）
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: "2026-05-30",
    createdAt: "2026-05-29",
    lastRating: null
  },
  // ...更多卡片
]

// 2. 复习记录
reviews: [
  {
    cardId: "card_concept_knowledge_graph",
    date: "2026-05-30T10:30:00Z",
    rating: 2,              // 0-5
    layer: 0,
    triggeredDeepDive: true  // 是否因低分触发了加深
  }
]

// 3. 加深分析记录
deepDives: [
  {
    id: "dd_001",
    originalConceptId: "knowledge_graph",
    layer: 1,
    triggerCardId: "card_concept_knowledge_graph",
    triggerRating: 2,
    aiResponse: { /* GMI 返回的加深结果 */ },
    generatedCardIds: ["card_subconcept_node", "card_example_social_network", ...],
    createdAt: "2026-05-30T10:30:05Z"
  }
]

// 4. 统计
stats: {
  totalReviews: 156,
  todayReviews: 12,
  streak: 5,
  lastReviewDate: "2026-05-30",
  masteryByLayer: {
    0: 0.75,    // Layer 0 掌握率
    1: 0.60,    // Layer 1 掌握率
    2: 0.40     // Layer 2 掌握率
  },
  deepDiveCount: 3,
  conceptMastery: {
    "knowledge_graph": { layer: 2, avgRating: 3.8, lastReviewed: "..." },
    "ontology_modeling": { layer: 1, avgRating: 2.5, lastReviewed: "..." }
  }
}
```

---

## 8. 用户流程示例（完整循环）

```
Day 1:
1. 用户上传论文 PDF → 系统分析 → 生成图谱 + 报告 + 15 张初始卡片
2. 用户打开 Study 面板学习 → 打开 Review 面板复习 15 张卡片
3. 用户对 "什么是 Ontology Modeling？" 评了 2 分（不理解）
   → 系统自动触发 Layer 1 加深分析
   → GMI 返回：子概念、例子、类比

Day 2:
4. Review 面板显示待复习 8 张（含新生成的 4 张 Layer 1 卡片）
5. 用户复习 Layer 1 卡片，理解了"Ontology Modeling"
   → 对大部分评 4-5 分

Day 7:
6. SM-2 将高分的 Layer 0 卡片间隔拉到 6 天
7. 用户再次复习 Layer 1 加深卡片，理解巩固
8. 持续循环 → 知识从"见过"变为"掌握"

追踪指标:
- 同一概念的卡片从 Layer 0 到 Layer 2 的评分趋势
- 复习连续天数
- 各层级的掌握率变化
```

---

## 9. 与 v1 设计的关键差异

| 维度 | v1（线性） | v2（循环加深） |
|---|---|---|
| 流程形态 | `...→ Review → 结束` | `...→ Review → DeepDive → 更深Study → Review → ...` |
| Review 定位 | 终点，巩固已有知识 | 诊断点，决定是否要加深 |
| 卡片来源 | 初分析一次性生成 | 分析 + 加深循环多次生成，层层递进 |
| 概念深度 | 单层定义 | 多层（定义→子概念→例子→类比→辨析→论证链） |
| 智能化程度 | 静态复习 | 动态诊断 + AI 针对性生成补充材料 |
| 用户投入 | 被动复习 | 系统主动填补薄弱环节 |
