# ResearchGraph Agent 截图清单

## 必备截图

### 1. 产品首页截图

页面：

```text
https://dark-077.github.io/ontology-note-helper/
```

截图内容：

- ResearchGraph Agent 标题
- 文件导入区域
- 笔记输入区域
- Agent 工作流说明

用途：展示产品入口和海外场景定位。

---

### 2. 文件上传功能截图

截图内容：

- 文件导入卡片
- 支持格式说明
- 上传限制说明

用途：证明支持 PDF、Word、PPTX、图片和文本导入。

---

### 3. 演示内容载入截图

操作：

1. 打开页面
2. 点击“演示”
3. 截图输入框和右侧初始图谱

用途：展示系统可以载入海外学习者场景材料。

---

### 4. 知识图谱结果截图

截图内容：

- 右侧 Research Knowledge Graph
- 多个概念节点
- 多条关系连线
- 图例

用途：展示核心可视化效果。

---

### 5. Agent 分析报告截图

截图内容：

- Agent 分析报告
- Summary
- Key insights
- Gaps / risks
- Next actions

用途：证明产品是 Agent 工作流，不只是静态图谱工具。

---

### 6. 节点详情截图

操作：

1. 点击图谱中的一个节点
2. 截图左侧“概念详情”面板

用途：展示交互式图谱能力。

---

### 7. 导出功能截图

截图内容：

- 图谱统计区域
- 导出 JSON 按钮
- 导出图片按钮

用途：展示结果可保存、可复用。

---

### 8. 后端 provider 截图

页面：

```text
http://localhost:3000/api/provider
```

截图内容应类似：

```json
{
  "provider": "gmi",
  "baseUrlConfigured": true,
  "model": "deepseek-ai/DeepSeek-V4-Pro",
  "tokenConfigured": true
}
```

注意：这个页面不会显示真实 Token，可以截图。

用途：证明后端已配置 GMI Cloud。

---

### 9. GMI Cloud 模型页面截图

截图内容：

- GMI Cloud 控制台
- 模型名称：`deepseek-ai/DeepSeek-V4-Pro`
- Base URL 或 API endpoint：`https://api.gmi-serving.com/v1/chat/completions`

用途：证明使用举办方平台模型。

---

### 10. GMI API 成功调用截图

当前已验证 GMI API 调用成功，操作：

1. 启动本地后端
2. 调用 `/api/extract`
3. 截图成功返回结果

截图应显示：

- concepts
- relationships
- agentReport

注意：不要截图 `.env`，不要显示真实 Token。

## 可选截图

### GitHub 仓库截图

页面：

```text
https://github.com/dark-077/ontology-note-helper
```

用途：提交代码地址时辅助说明。

### README 截图

展示 README 中的：

- 项目介绍
- GMI Cloud 接入说明
- Agent 工作流

用途：证明项目文档完整。

## 截图命名建议

```text
01-homepage.png
02-upload-area.png
03-demo-input.png
04-knowledge-graph.png
05-agent-report.png
06-node-detail.png
07-export-buttons.png
08-api-provider.png
09-gmi-model-page.png
10-gmi-api-success.png
```
