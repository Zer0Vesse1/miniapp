---
name: project-miniapp
description: "Current state, stack, and architecture decisions for the MiniAPP project"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddbb4423-d7cd-4cb0-8ecf-8914c29f49e6
---

# MiniAPP 项目

## Why
个人生活助手网页，集成解压小游戏和游戏攻略助手。所有代码在本工作目录 `d:\Data\VSCode\MiniAPP`。

## 当前状态（v0.2.0）

### 已完成
- React 18 + TypeScript + Vite 项目骨架
- 侧边栏导航（首页/小游戏/攻略助手/设置）
- 三个小游戏：2048（DOM）、贪吃蛇（Canvas）、俄罗斯方块（Canvas）
- 攻略助手：Markdown 驱动，GFM 渲染 + `::tip::` + `::timeline::` 自定义语法
- 主题系统：浅色/深色/跟随系统，`ThemeContext` + localStorage
- 字体大小设置：小/中/大
- 设置页面：外观分组 + 关于分组，草稿 → 应用模式
- 示例攻略：星露谷物语新手四季开荒

### 文件结构关键路径
- 路由：`src/App.tsx`
- 主题：`src/context/ThemeContext.tsx`
- 全局样式：`src/styles/global.css`
- 攻略 Hook：`src/hooks/useGuides.ts`
- 攻略文件：`public/guides/*.md`，索引：`src/data/guides-index.json`
- 版本号在 `package.json` → `version` 字段

### 待扩展
- 攻略的 Mermaid 图表实际渲染（目前是占位符）
