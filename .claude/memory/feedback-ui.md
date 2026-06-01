---
name: feedback-ui
description: Validated UI/UX preferences from user feedback
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ddbb4423-d7cd-4cb0-8ecf-8914c29f49e6
---

# UI/UX 偏好

## 设置页采用"草稿 → 应用"模式
**Why**：用户测试后反馈"选择完之后看不出什么变化"，表示不喜欢即时生效。需要预览再确认的交互。
**How to apply**：任何设置类功能（主题、字体、开关）都应使用本地 draft state + "应用"按钮确认后才写入 Context/localStorage。按钮在无变更时隐藏，有未保存变更时显示。

## 层次结构优先
**Why**：用户两次要求将平级选项重组为分组结构（"关于"从一行变为分组标题+子项，"基础颜色"归入"外观"分组）。不喜欢扁平列表。
**How to apply**：设置页、配置页等应使用两级结构：分组标题（h2）→ 子项行。每个分组至少在 2-3 个子项时才成立，否则合并。
