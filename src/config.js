/*
 * @Author: flkGit
 * @Date: 2025-10-17 10:27:32
 * @LastEditors: flkGit
 * @LastEditTime: 2025-10-17 11:33:12
 * @FilePath: /emos-uploader/src/config.js
 * @Description:
 *
 * Copyright (c) 2025 by flkGit, All Rights Reserved.
 */
export const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://dev.emos.lol'
export const LOGIN_URL = '/api/link?uuid=9dbf2c0c-7fa2-49a6-a37b-a4ebc9406049&name=上传服务'

// 外部识别 API（通过环境变量配置，避免在代码中暴露）
export const RECOGNITION_API_URL = import.meta.env.VITE_RECOGNITION_API_URL || 'https://mp.prlo.de'
export const RECOGNITION_API_TOKEN = import.meta.env.VITE_RECOGNITION_API_TOKEN || ''

// 分片配置
export const CHUNK_SIZE = 100 * 1024 * 1024 // 100MB 每片
export const MIN_CHUNK_SIZE = 50 * 1024 * 1024 // 50MB 最小分片大小
