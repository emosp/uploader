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

// 分片配置
export const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB 每片
export const MIN_CHUNK_SIZE = 20 * 1024 * 1024 // 20MB 最小分片大小
