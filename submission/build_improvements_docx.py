"""Generate the improvement plan Word document."""

import os
import zipfile
from xml.sax.saxutils import escape

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'ResearchGraph-Agent-Improvements.docx')

W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def p(text: str, style: str = 'Normal') -> str:
    safe = escape(text)
    return (
        f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
    )


def p_kv(label: str, value: str) -> str:
    safe_label = escape(label)
    safe_value = escape(value)
    return (
        '<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>'
        f'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{safe_label}：</w:t></w:r>'
        f'<w:r><w:t xml:space="preserve">{safe_value}</w:t></w:r></w:p>'
    )


def bullet(text: str) -> str:
    safe = escape(text)
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListBullet"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
    )


def numbered(text: str) -> str:
    safe = escape(text)
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListNumber"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
    )


def h1(text: str) -> str:
    return p(text, 'Heading1')


def h2(text: str) -> str:
    return p(text, 'Heading2')


def h3(text: str) -> str:
    return p(text, 'Heading3')


def item(title: str, current: str, improvement: str) -> str:
    return h3(title) + p_kv('现状', current) + p_kv('改进', improvement)


body = []
add = body.append

add(p('ResearchGraph Agent', 'Title'))
add(p('待改进清单', 'Subtitle'))

# 一、核心架构
add(h1('一、核心架构改进'))
add(item('1. 摆脱 GitHub Pages 依赖',
         '公开演示完全依赖 GitHub Pages，仓库必须公开，对小白用户不友好。',
         '迁移到独立域名 + 微信小程序 + iOS / Android App，建立独立分发渠道。'))
add(item('2. 后端尚未真正上云',
         'GMI 在线推理只能在本地后端跑，公开 GitHub Pages 用的是本地规则 fallback。',
         '尽快完成 Render / Railway 部署，让公开用户也能用到真实 GMI 模型。'))
add(item('3. 无用户账号体系',
         '没有登录、没有用户档案、无法保存历史记录。',
         '增加手机号 / 微信 / Apple ID 登录，沉淀用户学习档案。'))
add(item('4. 无数据持久化',
         '刷新页面所有图谱和报告就丢了。',
         '增加数据库（Postgres / SQLite），保存用户每次分析结果。'))

# 二、AI 与模型
add(h1('二、AI 与模型层改进'))
add(item('5. 单次输入 8000 字限制',
         '长论文必须手动截断，不能整本分析。',
         '实现分段切片 + 多轮调用 + 结果合并，支持整本论文 / 整门课程材料。'))
add(item('6. 单一模型依赖',
         '只用了 deepseek-ai/DeepSeek-V4-Pro。',
         '允许用户选择 GPT、Claude、Gemini、GLM、Qwen 等 GMI 平台多模型，针对不同任务选最优。'))
add(item('7. 无多轮追问能力',
         'Agent 报告生成后无法继续追问。',
         '增加对话式追问，用户可问"再展开第 3 个概念"或"换一个汇报角度"。'))
add(item('8. 无 Agent 工具调用能力',
         '本质还是一次 prompt → 一次返回。',
         '升级为真正的 Agent，可调用搜索、引用查找、概念定义查询等工具。'))
add(item('9. 无引用与来源追溯',
         'Agent 报告不知道是从材料哪一段推出来的。',
         '每个概念、每个洞察附带原文出处，提高可信度。'))
add(item('10. 无幻觉控制',
         '模型偶尔会"造概念"，不在原文中。',
         '增加约束输出 + 原文 grounding 校验。'))

# 三、文件解析
add(h1('三、文件解析改进'))
add(item('11. 扫描版 PDF 不支持',
         '只能解析可复制文本型 PDF，扫描件无法处理。',
         '集成 PDF + OCR 联合管线（pdf2image → Tesseract / Cloud OCR）。'))
add(item('12. 不支持 .doc / .ppt 旧格式',
         '必须用户手动转 .docx / .pptx。',
         '服务端用 LibreOffice / unoconv 自动转换。'))
add(item('13. PPTX 解析过于简单',
         '只读取文字，忽略图片、图表、备注。',
         '解析母版、备注页、图片 OCR，得到更完整的语义。'))
add(item('14. OCR 速度慢',
         'Tesseract.js 首次加载几十兆，识别一张图要 10 秒以上。',
         '可选切换到云端 OCR（GMI 多模态模型 / 百度 OCR），快很多。'))
add(item('15. 不支持音视频',
         '海外学生大量学习材料是 Zoom 录像、YouTube 课程。',
         '增加 Whisper 转写 + 自动分析。'))
add(item('16. 不支持网页 URL 输入',
         '用户必须先复制粘贴。',
         '增加 URL 直接抓取（论文 arXiv / 课程页面 / Wikipedia）。'))

# 四、知识图谱
add(h1('四、知识图谱改进'))
add(item('17. 图谱布局不够稳定',
         '节点位置每次刷新都变。',
         '保存布局，支持手动锁定。'))
add(item('18. 大图谱性能差',
         '超过 30 个节点开始卡。',
         '节点聚类、按重要性分级展开、虚拟化渲染。'))
add(item('19. 不支持图谱编辑',
         '用户不能添加、修改、删除节点。',
         '增加手动编辑能力，让用户优化 AI 输出。'))
add(item('20. 不支持多图谱合并',
         '每次分析独立。',
         '跨材料合并图谱，建立学期级 / 课程级知识图谱。'))
add(item('21. 缺少时间线视图',
         '只有静态图谱。',
         '增加时间线、思维导图、矩阵等多种视图。'))
add(item('22. 缺少颜色与图标设计',
         '节点风格相对单一。',
         '按类别配色 + Emoji / 图标，更易扫读。'))

# 五、Agent 报告
add(h1('五、Agent 报告改进'))
add(item('23. 报告固定 7 个模块',
         '所有材料都输出同样结构。',
         '按材料类型自动切换模板（论文 / 课程讲义 / 项目文档 / 案例分析）。'))
add(item('24. 报告不可编辑',
         '用户只能看，不能改。',
         '增加在线编辑，保存为用户自己的版本。'))
add(item('25. 报告无导出 PDF / Markdown',
         '只有 JSON 和 PNG。',
         '导出 PDF、Markdown、Notion、Word，方便交作业 / 写论文。'))
add(item('26. 报告无引用格式',
         '不能直接用于论文写作。',
         '自动生成 APA / MLA / Chicago 格式引用。'))

# 六、用户体验
add(h1('六、用户体验改进'))
add(item('27. 首页缺少新手引导',
         '用户进来只看到一个输入框，不知道能做什么。',
         '增加交互式引导（onboarding tour）+ 视频教程。'))
add(item('28. 缺少历史记录',
         '刷新页面全没了，用户不敢关。',
         '增加历史记录列表 + 一键恢复。'))
add(item('29. 缺少收藏与标签',
         '所有分析平铺。',
         '增加分类、标签、收藏夹（按课程 / 按论文 / 按 deadline）。'))
add(item('30. 缺少协作功能',
         '只能一个人用。',
         '增加图谱分享链接、小组协作编辑、评论功能。'))
add(item('31. 移动端体验欠佳',
         '图谱在小屏幕上不好看。',
         '移动端专门优化，简化交互。'))
add(item('32. 缺少国际化',
         'UI 中英文混杂。',
         '完整 i18n 体系，至少支持中文、英文、日文、韩文。'))
add(item('33. 缺少深色 / 浅色切换',
         '只有深色主题。',
         '提供浅色主题，适合白天与打印。'))
add(item('34. 缺少快捷键',
         '所有操作必须鼠标。',
         '增加键盘快捷键（Ctrl+Enter 运行、Esc 关闭面板等）。'))

# 七、商业化与运营
add(h1('七、商业化与运营改进'))
add(item('35. 无付费模型',
         '完全免费，无法支撑后端 Token 成本。',
         'Freemium 模式（免费 5 次/天，Pro 无限制）+ 学生订阅 + 高校 License。'))
add(item('36. 无用量限制',
         '恶意用户可刷爆 Token。',
         '增加 IP 限流 + 用户配额 + Token 用量监控。'))
add(item('37. 无数据分析',
         '不知道用户怎么用、用得多不多。',
         '接入 Plausible / Umami（隐私友好），追踪关键路径。'))
add(item('38. 无运营内容',
         '仓库只有代码，没社区。',
         '建立公众号 / 小红书 / Twitter，发"如何用 AI 一小时读完一篇论文"内容。'))

# 八、安全与合规
add(h1('八、安全与合规改进'))
add(item('39. 无内容审核',
         '用户可上传任何内容，包括隐私材料。',
         '增加 PII 检测、机密信息提示、数据保留策略。'))
add(item('40. 无隐私政策与服务条款',
         '用户不知道数据怎么处理。',
         '增加隐私政策、用户协议、GDPR 合规说明（面向海外用户必备）。'))
add(item('41. 无审计日志',
         '调用记录不留痕。',
         '后端日志记录 + 异常告警。'))
add(item('42. Token 单点风险',
         '所有用户共用一个 GMI Token。',
         '决赛后切换到独立账户 Token，或让企业用户自带 Token。'))

# 九、工程与质量
add(h1('九、工程与质量改进'))
add(item('43. 无自动化测试',
         '代码全靠人工验证。',
         '增加单元测试（Jest）+ 端到端测试（Playwright）+ CI（GitHub Actions）。'))
add(item('44. 无错误监控',
         '用户报错只能口头反馈。',
         '接入 Sentry / 自建错误上报。'))
add(item('45. 无版本号与更新日志',
         '每次改动只有 git log。',
         '建立 CHANGELOG + 语义化版本号。'))
add(item('46. 依赖管理粗糙',
         'package.json 用 latest，可能引入不兼容更新。',
         '锁定版本 + Dependabot 安全更新。'))
add(item('47. 代码结构单文件',
         'app.js 一个文件几千行。',
         '拆分为模块（parser / agent / graph / ui / api）。'))
add(item('48. 缺少 TypeScript',
         '纯 JS，类型错误只能运行时发现。',
         '迁移到 TypeScript，提升可维护性。'))

# 十、生态与扩展
add(h1('十、生态与扩展改进'))
add(item('49. 无第三方集成',
         '孤立工具。',
         '接入 Zotero、Notion、Obsidian、Canvas、Google Drive。'))
add(item('50. 无 API 开放',
         '只能在前端用。',
         '开放 API，让别的产品调用，做 Agent as a Service。'))
add(item('51. 无浏览器插件',
         '用户必须打开网站。',
         'Chrome / Edge 插件，在 arXiv、Coursera、Canvas 页面一键分析。'))
add(item('52. 无模板市场',
         '所有用户用同一个 prompt。',
         '建立模板市场（论文阅读 / 法学案例分析 / 医学文献综述），社区贡献。'))

# 优先级
add(h1('优先级建议（如果只能改 5 件事）'))
for s in [
    '真正上云（公开用户也能用到 GMI 真实推理）',
    '支持长文档（突破 8000 字限制）',
    '多轮追问（让 Agent 真正"动起来"）',
    '历史记录 + 账号体系（用户敢回来）',
    '微信小程序 / App 版（摆脱 GitHub 依赖）',
]:
    add(numbered(s))
add(p('这 5 件做完，产品就能从"比赛 demo"变成"真实可用的工具"。'))

document_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:document {W_NS}><w:body>'
    + ''.join(body)
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>'
    '</w:sectPr></w:body></w:document>'
)

styles_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles {W_NS}>
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="1E293B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="360"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:sz w:val="24"/><w:color w:val="475569"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="4338CA"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="0EA5E9"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
</w:styles>'''

numbering_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering {W_NS}>
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>'''

content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>'''

root_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

doc_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>'''

with zipfile.ZipFile(OUTPUT_PATH, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types_xml)
    z.writestr('_rels/.rels', root_rels_xml)
    z.writestr('word/_rels/document.xml.rels', doc_rels_xml)
    z.writestr('word/document.xml', document_xml)
    z.writestr('word/styles.xml', styles_xml)
    z.writestr('word/numbering.xml', numbering_xml)

print('OK', OUTPUT_PATH, os.path.getsize(OUTPUT_PATH), 'bytes')
