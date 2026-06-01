# MiniAPP — 生活助手网页 项目计划

## 项目概述

一个个人生活辅助网页应用，集成小游戏板块（解压娱乐）和游戏攻略助手
（资料整理+可视化）。

## 技术栈

| 层       | 选型                   |
| -------- | ---------------------- |
| 框架     | React 18 + TypeScript  |
| 构建工具 | Vite                   |
| 路由     | React Router v6        |
| 样式     | CSS Modules            |
| 游戏     | Canvas API / DOM       |
| 攻略渲染 | unified + remark       |
| 图表     | Mermaid (流程图/时间线) |
| 数据存储 | 本地 Markdown 文件     |

## 目录结构

```
MiniAPP/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── Plan.md
├── guides/                    # 攻略 Markdown 文件
│   ├── sample.md
│   └── ...
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.module.css
    ├── layouts/
    │   ├── SidebarLayout.tsx
    │   └── SidebarLayout.module.css
    ├── pages/
    │   ├── Home.tsx
    │   ├── games/
    │   │   ├── GameList.tsx          # 游戏列表入口
    │   │   ├── Tetris.tsx            # 俄罗斯方块
    │   │   ├── Game2048.tsx          # 2048
    │   │   └── Snake.tsx             # 贪吃蛇
    │   └── guides/
    │       ├── GuideList.tsx         # 攻略列表
    │       └── GuideDetail.tsx       # 攻略详情（可视化渲染）
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── Sidebar.module.css
    │   └── GuideRenderer.tsx        # Markdown → 可视化卡片
    ├── hooks/
    │   └── useGuides.ts             # 加载/解析 markdown 文件
    ├── data/
    │   └── guides-index.json        # 攻略索引（标题、标签、日期）
    └── styles/
        └── global.css
```

## 功能模块

### 模块一：小游戏板块

#### 1. 俄罗斯方块 (Tetris)
- **技术**：Canvas 2D
- **核心**：7 种方块旋转、消行计分、等级加速
- **操作**：键盘控制（← → ↓ 移动，↑ 旋转，空格硬降）
- **功能点**：分数/等级/下一个方块预览/暂停

#### 2. 2048
- **技术**：DOM + CSS Transition
- **核心**：4×4 网格、滑动合并、随机生成
- **操作**：键盘方向键 + 触屏滑动
- **功能点**：分数/最高分 (localStorage)/撤销一步/新游戏

#### 3. 贪吃蛇 (Snake)
- **技术**：Canvas 2D
- **核心**：网格移动、食物生成、碰撞检测
- **操作**：键盘方向键
- **功能点**：分数/速度递增/障碍物模式

### 模块二：游戏攻略助手

#### 工作流程
```
用户编写/收集 Markdown → 放入 guides/ 目录 → 更新索引 → 页面自动渲染为可视化攻略
```

#### Markdown 约定
每篇攻略支持扩展 frontmatter：
```yaml
---
title: "攻略标题"
game: "游戏名"
tags: ["新手", "攻略"]
created: "2026-05-31"
---
```

#### 可视化能力
- **普通 Markdown 渲染**：标题、列表、表格、代码块
- **提示卡片**：`::tip::` 语法 → 渲染为带图标的提示框
- **流程图**：Mermaid 代码块自动渲染
- **时间线**：`::timeline::` → 步骤式时间线视图
- **数据表格**：自动美化、支持筛选排序

#### 界面
- 左侧列表（按游戏分类、标签筛选）
- 右侧详情区（渲染后的可视化攻略）

## 实施步骤

### 第一阶段：项目骨架
1. 用 Vite 初始化 React + TypeScript 项目
2. 搭建侧边栏布局 (SidebarLayout)
3. 配置 React Router，定义各模块路由
4. 写一个简单的首页 Dashboard

### 第二阶段：小游戏
5. 实现 2048（DOM 操作，难度最低）
6. 实现贪吃蛇（Canvas 入门）
7. 实现俄罗斯方块（Canvas 进阶）

### 第三阶段：攻略助手
8. 创建 `guides/` 目录和索引文件
9. 实现 Markdown 解析 + frontmatter 提取
10. 实现 GuideRenderer（可视化渲染组件）
11. 实现攻略列表页和详情页

### 第四阶段：打磨
12. 响应式适配（移动端触屏游戏体验）
13. 性能优化、样式统一
14. 添加更多示例攻略

## 验证方式

- `npm run dev` 启动开发服务器
- 浏览器访问，点击侧边栏切换模块
- 试玩每个游戏，确认操作流畅
- 在 `guides/` 下新增 .md 文件，刷新后确认自动渲染
- `npm run build` 确认无报错
