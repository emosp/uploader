# EMOS 视频上传服务

基于 Vue 3 + Vite + Tailwind CSS 的视频上传应用。

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
public/                # 静态资源
src/
├── assets/            # 资源文件 (CSS、图片等)
├── components/        # Vue 组件
├── composables/       # 逻辑复用
├── App.vue           # 根组件
├── main.js           # 应用入口
└── config.js         # 配置文件
```

## 技术栈

- Vue 3 (Composition API)
- Vite 5
- Tailwind CSS 3

## 配置

在 `src/config.js` 中修改 API 端点和上传 URL。

详细文档请查看 [CLAUDE.md](./CLAUDE.md)。
