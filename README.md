# EMOS 视频上传服务

EMOS emby 公益服视频上传服务 - 基于 Vue 3 + Vite + Tailwind CSS 的视频上传应用。

## 功能特性

- ✅ 用户认证（第三方登录）
- ✅ 视频 ID 验证和信息获取
- ✅ 文件拖拽上传
- ✅ 智能分片上传（自动选择上传策略）
- ✅ 断点续传（上传失败后可从断点继续）
- ✅ 实时进度和速度显示
- ✅ 响应式设计

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

访问 `http://localhost:8000`

### 构建生产版本

```bash
pnpm build
```

### 预览生产版本

```bash
pnpm preview
```

## 项目结构

```
emos-uploader/
├── public/                     # 静态资源
│   ├── favicon.svg                # 网站图标
│   ├── favicon.ico
│   └── index-old.html             # 原始单文件版本（已弃用）
├── src/
│   ├── assets/                 # 资源文件（CSS、图片等）
│   │   └── style.css              # 全局样式和 Tailwind 配置
│   ├── components/             # Vue 组件
│   │   ├── StatusMessage.vue      # 顶部通知消息组件
│   │   ├── UserPanel.vue          # 用户认证面板组件
│   │   ├── VideoInfo.vue          # 视频信息组件
│   │   └── FileUpload.vue         # 文件上传组件
│   ├── composables/            # 逻辑复用
│   │   ├── useAuth.js             # 用户认证逻辑
│   │   ├── useVideoInfo.js        # 视频信息获取逻辑
│   │   ├── useUpload.js           # 文件上传逻辑
│   │   ├── useUploadToken.js      # 上传令牌获取逻辑
│   │   └── useNotification.js     # 通知消息逻辑
│   ├── App.vue                 # 根组件
│   ├── main.js                 # 应用入口
│   └── config.js               # 配置文件
├── index.html                  # HTML 入口
├── vite.config.js              # Vite 配置
├── tailwind.config.js          # Tailwind CSS 配置
├── postcss.config.js           # PostCSS 配置
├── package.json                # 项目依赖
├── CLAUDE.md                   # 详细技术文档
└── README.md                   # 项目说明
```

## 技术栈

- Vue 3 (Composition API) - ^3.5.22
- Vite - ^6.4.0
- Tailwind CSS - ^3.4.18
- PostCSS - ^8.5.6

## 配置

在 `src/config.js` 中修改 API 端点。
