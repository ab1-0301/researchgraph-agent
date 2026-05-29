"""Build the presentation pitch as a real .docx using only the standard library.

A .docx file is just a zip archive of XML parts. We assemble the minimum
required parts (Content_Types, rels, document.xml, styles.xml) so that
Microsoft Word and WPS can open it cleanly with proper headings and lists.
"""

import os
import zipfile
from xml.sax.saxutils import escape

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'ResearchGraph-Agent-Pitch.docx')

W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def p(text: str, style: str = 'Normal') -> str:
    safe = escape(text)
    return (
        f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
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


def code(text: str) -> str:
    lines = text.split('\n')
    parts = []
    for i, line in enumerate(lines):
        safe = escape(line)
        br = '<w:br/>' if i < len(lines) - 1 else ''
        parts.append(
            f'<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'
            f'<w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{safe}</w:t>{br}</w:r>'
        )
    return (
        '<w:p><w:pPr><w:pStyle w:val="Code"/>'
        '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:pPr>'
        + ''.join(parts) + '</w:p>'
    )


def h1(text: str) -> str:
    return p(text, 'Heading1')


def h2(text: str) -> str:
    return p(text, 'Heading2')


def h3(text: str) -> str:
    return p(text, 'Heading3')


body_parts = []
add = body_parts.append

add(p('ResearchGraph Agent', 'Title'))
add(p('面向海外学生和研究者的 AI 研究笔记智能体 · 现场展示稿', 'Subtitle'))

add(h1('一、产品一句话定位'))
add(p('ResearchGraph Agent —— 面向海外学生和研究者的 AI 研究笔记智能体。'))
add(p('把英文论文、课程 PPT、Word、PDF 和图片，一键转化为知识图谱、学习缺口、研讨问题和汇报大纲。'))

add(h1('二、产品链接'))
for line in [
    '产品体验：https://dark-077.github.io/ontology-note-helper/',
    '代码仓库：https://github.com/dark-077/ontology-note-helper',
    'API 证明页：http://localhost:3000/api-proof.html',
    '后端配置证明：http://localhost:3000/api/provider',
]:
    add(bullet(line))

add(h1('三、产品规划过程'))
plan_steps = [
    '选题：从“两天能做完的 AI 小项目”出发，避开同质化 Chatbot，选了本体论笔记助手。',
    '海外化重塑：对照比赛要求“海外场景 Agent 产品”，升级为 ResearchGraph Agent。',
    '形态升级：从单次摘要工具升级为完整 Agent 工作流 Ingest → Reason → Act。',
    '接入 GMI：Node.js 后端接入 GMI Cloud Inference Engine，模型 deepseek-ai/DeepSeek-V4-Pro。',
    '公开演示：前端 GitHub Pages + 后端 Render 云端部署。',
    '证据材料：补齐 API 证明页、截图、文档和提交材料。',
]
for step in plan_steps:
    add(numbered(step))

add(h1('四、技术架构与调用链路'))
add(code(
    '前端 (GitHub Pages)\n'
    '   ↓\n'
    'POST /api/extract  →  Node.js Express 后端\n'
    '   ↓\n'
    'POST https://api.gmi-serving.com/v1/chat/completions\n'
    '   ↓\n'
    'GMI Cloud Inference Engine · deepseek-ai/DeepSeek-V4-Pro\n'
    '   ↓\n'
    '返回 concepts / relationships / agentReport\n'
    '   ↓\n'
    'Cytoscape.js 渲染知识图谱 + Agent 报告'
))
add(p('请求关键参数：'))
add(code(
    '{\n'
    '  "model": "deepseek-ai/DeepSeek-V4-Pro",\n'
    '  "temperature": 0.3,\n'
    '  "response_format": { "type": "json_object" }\n'
    '}'
))

add(h1('五、开发中调用的 Agent 与 Skills'))
add(h2('Skills 技能'))
for s in [
    'ckm-ui-styling —— ResearchGraph Agent 的 UI、深色玻璃态卡片样式',
    'oh-my-claudecode 工作流 —— autopilot、ultrawork 多智能体编排',
    'omc-reference —— 多智能体目录与团队流水线',
]:
    add(bullet(s))

add(h2('Agents 智能体角色'))
for s in [
    'Explore —— 快速定位代码、文件与符号',
    'Plan / Planner / Architect —— 设计实现路径',
    'executor —— 真正写代码（复杂任务用 Opus 模型）',
    'document-specialist —— 查阅 GMI、Express、PDF.js 等官方文档',
    'code-reviewer / verifier —— 提交前独立验证',
    'general-purpose —— 处理跨多文件、多步骤的研究任务',
]:
    add(bullet(s))

add(p('典型流程：Plan 出方案 → executor 编码 → verifier 验证 → 安全扫描 → Git 提交。'))

add(h1('六、产品特点'))
features = [
    '多格式导入：PDF、DOCX、PPTX、TXT/MD、PNG/JPG，全在浏览器端解析。',
    '图片 OCR：基于 Tesseract.js，可识别中英文。',
    '概念图谱可视化：Cytoscape.js 交互式 Research Learning Map。',
    'Agent 完整工作流：Summary / Key insights / Learning gaps / Next actions / 30-min study plan / Seminar questions / Presentation outline。',
    'GMI Cloud 真实接入：后端调用 deepseek-ai/DeepSeek-V4-Pro，Token 安全保存。',
    '导出能力：JSON 与 PNG 一键导出。',
    '公开可演示：GitHub Pages + 云端后端。',
]
for f in features:
    add(numbered(f))

add(h1('七、产品亮点（差异化）'))
highlights = [
    '不是翻译，不是摘要，而是结构化研究助手 —— 把材料转化为可讨论、可汇报的产物。',
    '真正的 Agent 形态 —— Ingest → Reason → Act 全流程，符合比赛硬性要求。',
    '海外学习者真实场景 —— 非母语、跨学科、高讨论压力下的学习闭环。',
    '安全工程实践 —— Token 只存后端环境变量，/api/provider 只返回布尔状态。',
    '完整证据链 —— API Proof Page、截图、Demo 视频、提交材料全套齐备。',
    '多智能体协同开发 —— 用 OMC 多智能体编排完成规划、编码、文档、验证全流程。',
]
for f in highlights:
    add(numbered(f))

add(h1('八、下一步改进策略'))

add(h2('核心战略方向：摆脱 GitHub 依赖，独立为微信小程序 / App'))
strategy_points = [
    '将 ResearchGraph Agent 重新打包为独立产品形态，不再依赖 GitHub Pages 作为分发入口。',
    '面向中国海外学生用户优先做微信小程序：扫码即用、无需翻墙、社群内分享自然。',
    '面向全球用户做 iOS / Android App：支持文件直接上传、离线缓存、推送提醒。',
    '后端继续使用 Node.js + GMI Cloud Inference Engine，统一对接小程序与 App。',
    '小程序与 App 共享同一份 RESTful API，前端框架可选 uni-app / Taro 实现一码多端。',
    '建立独立账号体系（手机号 / 微信 / Apple ID 登录），沉淀用户学习记录与图谱档案。',
    '小程序灰度测试 → App Store / 应用宝上架 → 海外 Apple Store 国际版发布。',
]
for s in strategy_points:
    add(bullet(s))

add(h2('近期 1-2 周'))
for s in [
    '完成 Render 云端后端部署，让公开前端能直接调用 GMI 在线推理。',
    '搭建 uni-app 工程脚手架，复用现有 Express API。',
    '设计小程序版核心交互：上传 / 粘贴 / 拍照 OCR。',
    '增加多轮追问能力（用户可对 Agent 报告继续提问）。',
]:
    add(numbered(s))

add(h2('中期 1-2 月'))
for s in [
    '完成微信小程序首版上线，主打“海外课程材料 → 学习计划”。',
    '支持长文档分段分析（突破当前 8000 字限制）。',
    '增加英文论文专用分析模板（Abstract / Method / Results / Limitations）。',
    '增加学习计划与汇报大纲一键导出 PDF / PPT。',
    '完成 App 内购订阅模型设计（Student Pro 月度订阅）。',
]:
    add(numbered(s))

add(h2('长期'))
for s in [
    '上架 iOS / Android App，覆盖海外华人留学生与国际学生群体。',
    '接入 Zotero / Notion / Obsidian，融入海外学习者已有工作流。',
    'University License 商业化：面向海外高校国际学生支持中心。',
    '多智能体协作：ResearchGraph Agent 与 Literature Agent、Citation Agent 组成学习智能体团队。',
    '多模态升级：支持视频讲座转写、白板照片识别。',
]:
    add(numbered(s))

add(h1('九、现场演示流程（5 分钟）'))
demo_steps = [
    '打开 GitHub Pages 产品页（30 秒）',
    '点击 Demo，载入海外学习材料（30 秒）',
    '点击 Run Agent Analysis，生成知识图谱（60 秒）',
    '点开节点查看概念详情（30 秒）',
    '滚动展示 Agent 报告完整 7 个模块（90 秒）',
    '切换到 /api-proof.html 演示 GMI 真实调用（60 秒）',
    '打开 /api/provider 证明后端 GMI 配置（30 秒）',
]
for s in demo_steps:
    add(numbered(s))

document_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:document {W_NS}><w:body>'
    + ''.join(body_parts)
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
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="80" w:after="120"/><w:ind w:left="200"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr></w:style>
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
