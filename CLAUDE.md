# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

EMOS emby公益服视频上传服务 - 使用 Vue 3 + Vite + Tailwind CSS 构建的单页面视频上传应用。

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 3 + 自定义 CSS
- **包管理**: pnpm

## 项目结构

```
upload-test/
├── public/                  # 静态资源目录
│   ├── favicon.svg              # 网站图标 (SVG)
│   ├── favicon.ico              # 网站图标 (ICO)
│   └── index-old.html           # 原始单文件版本（已弃用）
├── src/
│   ├── assets/              # 资源文件
│   │   └── style.css            # 全局样式
│   ├── components/          # Vue 组件
│   │   ├── StatusMessage.vue    # 顶部通知消息组件
│   │   ├── UserPanel.vue        # 用户认证面板组件
│   │   ├── VideoInfo.vue        # 视频信息组件
│   │   └── FileUpload.vue       # 文件上传组件
│   ├── composables/         # Vue Composables (逻辑复用)
│   │   ├── useAuth.js           # 用户认证逻辑
│   │   ├── useVideoInfo.js      # 视频信息获取逻辑
│   │   ├── useUpload.js         # 文件上传逻辑
│   │   ├── useUploadToken.js    # 上传令牌获取逻辑
│   │   └── useNotification.js   # 通知消息逻辑
│   ├── App.vue              # 根组件
│   ├── main.js              # 应用入口
│   └── config.js            # 配置文件
├── index.html               # HTML 入口
├── package.json             # 项目依赖
├── vite.config.js           # Vite 配置
├── tailwind.config.js       # Tailwind CSS 配置
├── postcss.config.js        # PostCSS 配置
└── CLAUDE.md                # 项目文档
```

## 核心功能模块

### 1. 用户认证模块 (`useAuth.js` + `UserPanel.vue`)

- 第三方登录/登出
- sessionStorage 管理用户状态 (token, username)
- 登录回调处理 (URL 参数: `?token=xxx&username=xxx`)

**关键 API:**
```javascript
const { isLoggedIn, username, login, logout } = useAuth()
```

### 2. 视频信息获取模块 (`useVideoInfo.js` + `VideoInfo.vue`)

- 视频 ID 格式验证: `vl-数字` 或 `ve-数字`
- API 调用: `GET ${BASE_URL}/api/upload/video/base?item_type={vl|ve}&item_id={数字}`
- 实时输入验证反馈

**关键 API:**
```javascript
const { videoId, videoInfo, isValid, fetchVideoInfo, validateVideoId } = useVideoInfo()
```

### 3. 文件上传模块 (`useUpload.js` + `useUploadToken.js` + `FileUpload.vue`)

**上传流程：**
1. 用户选择上传类型（video/subtitle/cover，当前仅支持 video）
2. 用户选择文件
3. 自动调用 getUploadToken 获取上传令牌
4. 用户点击"开始上传"按钮
5. 使用令牌中的 upload_url 上传文件到 OneDrive
6. 上传成功后调用保存接口记录上传信息

**上传类型支持：**
- **video**: 视频文件（MP4, AVI, MOV, MKV 等）
- **subtitle**: 字幕文件（SRT, ASS, SSA, VTT）- 即将开放
- **cover**: 封面图片（JPG, PNG, WEBP 等）- 即将开放

**上传策略：**
- 支持点击上传和拖拽上传
- 自动选择上传方式:
  - 小于 50MB: 完整上传 (uploadFileComplete)
  - 大于 50MB: 分片上传 (uploadFileInChunks, 每片 5MB)
- **断点续传**: 支持在上传失败后从断点继续
  - 使用 localStorage 保存上传进度
  - 通过文件名、大小和修改时间生成唯一标识
  - 进度记录有效期 24 小时
  - 重新上传时自动检测并继续未完成的上传
- 使用 XMLHttpRequest + Content-Range 头实现断点续传协议
- 实时进度和速度显示

**关键 API:**
```javascript
// useUpload.js - 文件上传
const { uploadProgress, uploadSpeed, isUploading, canResume, uploadFile, cancelUpload, clearUploadProgress } = useUpload()

// useUploadToken.js - 令牌管理
const { uploadToken, isGettingToken, getUploadToken, saveUploadResult, clearToken } = useUploadToken()
```

### 4. 通知系统 (`useNotification.js` + `StatusMessage.vue`)

- 顶部下拉式通知 (固定定位, top: 100px)
- 2秒后自动隐藏
- 支持三种类型: success, error, uploading

**关键 API:**
```javascript
const { message, type, visible, showStatus, hideStatus } = useNotification()
```

## 开发和测试

### 安装依赖

```bash
pnpm install
```

### 本地运行

```bash
pnpm dev
```

然后访问 `http://localhost:8000`

### 构建生产版本

```bash
pnpm build
```

### 预览生产版本

```bash
pnpm preview
```

## API 配置

需要在 `src/config.js` 中配置以下常量:

```javascript
export const BASE_URL = 'https://dev.emos.lol'  // 后端 API 基础 URL
export const LOGIN_URL = '/api/link?uuid=...'     // 登录端点
export const CHUNK_SIZE = 5 * 1024 * 1024        // 分片大小 (5MB)
export const MIN_CHUNK_SIZE = 50 * 1024 * 1024   // 分片阈值 (50MB)
```

### 主要 API 端点

所有需要认证的接口都使用 `Authorization: Bearer ${token}` 头，token 从 sessionStorage 中获取。

- **登录**: `${BASE_URL}${LOGIN_URL}&url={回调URL}`
  - 无需认证
  - 返回 token 和 username，保存到 sessionStorage
- **视频信息**: `GET ${BASE_URL}/api/upload/video/base?item_type={vl|ve}&item_id={数字}`
  - 需要认证：`Authorization: Bearer ${token}`
- **获取上传令牌**: `POST ${BASE_URL}/api/upload/getUploadToken`
  - 需要认证：`Authorization: Bearer ${token}`
  - 请求参数: `{ type, file_type, file_name, file_size }`
  - 返回字段: `{ type, file_id, upload_url }`
- **保存上传结果**: `POST ${BASE_URL}/api/upload/video/base`
  - 需要认证：`Authorization: Bearer ${token}`
  - 请求参数: `{ file_id, item_type, item_id }`
- **文件上传**: 使用 getUploadToken 返回的 upload_url 直接上传到 Microsoft OneDrive
  - 无需 token，使用 OneDrive 自己的认证 URL

## 样式系统

### Tailwind CSS

使用 PostCSS 集成，所有 Tailwind 指令在 `src/assets/style.css` 中导入。

### 自定义 CSS

关键类名 (在 `src/assets/style.css` 中):

- `.gradient-theme`: 主渐变色 (135deg, #4cbfaa → #3a9d8f) - 青绿色主题
- `.gradient-theme-h`: 横向渐变色 (90deg)
- `.status-message`: 顶部通知消息 (固定定位 + 动画)
- `.show`: 显示隐藏元素的通用类
- 输入验证状态: `#videoId.error`, `#videoId.success`

### 主题颜色

- **主色调**: `rgb(76, 191, 170)` / `#4cbfaa` - 青绿色
- **深色调**: `rgb(58, 157, 143)` / `#3a9d8f` - 深青绿色
- **Tailwind 类**: `text-teal-600`, `border-teal-500`, `bg-teal-50` 等

### 响应式设计

- 桌面端 (lg+): 用户面板固定宽度 320-360px + 视频信息区域自适应填充剩余空间 (flex-1)
- 移动端: 两个面板垂直堆叠 (flex-wrap)，各占 100% 宽度
- 设计原则: 确保上方信息区域与下方上传区域宽度对齐

## 状态管理

### sessionStorage (通过 useAuth)

- `token`: 用户认证令牌（JWT Bearer Token）
  - 用于所有需要认证的 API 请求
  - 格式：`Authorization: Bearer ${token}`
- `username`: 用户名

### Reactive 状态 (Vue Composables)

各个 composable 使用 Vue 的 `ref` 和 `reactive` 管理内部状态，状态在组件间通过 props 和 emits 传递。

## 关键实现细节

### 视频 ID 解析

输入格式 `vl-123` 解析为:
```javascript
const match = videoId.match(/^(vl|ve)-(\d+)$/)
const item_type = match[1]  // "vl" 或 "ve"
const item_id = match[2]    // "123"
```

### 分片上传策略

- 小文件 (< 50MB): 一次性上传，监听 `xhr.upload.progress` 事件
- 大文件 (≥ 50MB): 分片上传，每片 5MB，使用 `Content-Range` 头
- 格式: `bytes ${start}-${end}/${total}`

### 断点续传机制

**工作原理:**
1. 文件标识: 使用 `文件名_大小_修改时间` 生成唯一 ID
2. 进度保存: 每上传完一个分片，保存进度到 localStorage
3. 断点检测: 重新上传时检查是否有该文件的未完成记录
4. 续传: 从上次中断的分片位置继续上传
5. 清理: 上传完成或超过 24 小时后自动清除进度记录

**存储格式:**
```javascript
{
  fileId: "video.mp4_1048576000_1699999999999",
  chunkIndex: 15,        // 最后成功上传的分片索引
  totalChunks: 200,      // 总分片数
  timestamp: 1699999999999  // 保存时间戳
}
```

### 通知消息动画

- 初始: `top: -100px` (屏幕外)
- 显示: `top: 100px` (弹性动画)
- 2秒后自动执行 `hideStatus()` 返回屏幕外

## 组件设计原则

### 单一职责

每个组件只负责一个功能模块：
- `UserPanel.vue`: 只负责用户信息展示和登录/登出操作
- `VideoInfo.vue`: 只负责视频 ID 输入和视频信息展示
- `FileUpload.vue`: 只负责文件选择和上传 UI
- `StatusMessage.vue`: 只负责消息展示

### 逻辑复用

业务逻辑通过 Composables 复用：
- 各组件保持轻量，只处理 UI 交互
- 所有业务逻辑在 composables 中实现
- 便于单元测试和维护

### Props Down, Events Up

- 父组件通过 props 向子组件传递数据
- 子组件通过 emit 向父组件发送事件
- 保持单向数据流

## 注意事项

- 上传令牌（upload_url）由后端 API 动态生成，无需手动配置
- 所有状态消息使用 `showStatus(message, type)` 函数，会自动 2秒后消失
- 修改 UI 时需同时考虑移动端响应式布局 (使用 `items-start` 防止面板拉伸)
- Vite 开发服务器默认端口为 8000 (可在 `vite.config.js` 中修改)
- 上传流程需要先登录和验证视频 ID，再选择文件获取令牌，最后点击按钮开始上传

## 迁移说明

项目已从单文件 HTML 应用 (`index-old.html`) 迁移到 Vue 3 应用。主要改进：

1. **更好的代码组织**: 功能模块化，易于维护
2. **组件复用**: 各个 UI 部分独立成组件，可单独测试和复用
3. **逻辑复用**: 通过 Composables 实现业务逻辑复用
4. **类型安全**: 更容易添加 TypeScript 支持
5. **开发体验**: 支持热重载，开发效率更高
6. **构建优化**: Vite 提供快速的构建和优化

如需回退到旧版本，可使用 `index-old.html`。
