/*
 * @Author: Claude Code
 * @Date: 2025-10-19
 * @Description: 上传队列管理 - 支持批量添加、删除、单独上传等功能
 *
 * Copyright (c) 2025 by EMOS, All Rights Reserved.
 */
import { ref, computed } from 'vue'

export function useUploadQueue() {
  // 上传队列：每个项包含 { id, videoId, videoInfo, file, uploadType, status, progress, speed, timeRemaining, uploadToken, error }
  const queue = ref([])

  // 队列项状态枚举
  const QUEUE_STATUS = {
    PENDING: 'pending',        // 等待上传
    UPLOADING: 'uploading',    // 上传中
    UPLOADED: 'uploaded',      // 上传完成（OneDrive）
    SAVING: 'saving',          // 保存中
    COMPLETED: 'completed',    // 完全完成
    FAILED: 'failed',          // 失败
    PAUSED: 'paused'           // 暂停
  }

  // 生成唯一ID
  const generateId = () => {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加到队列
  const addToQueue = (videoId, videoInfo, file, uploadType = 'video') => {
    const queueItem = {
      id: generateId(),
      videoId,
      videoInfo,
      file,
      uploadType,
      status: QUEUE_STATUS.PENDING,
      progress: 0,
      speed: '',
      timeRemaining: '',
      uploadToken: null,
      uploadResponse: null,
      error: null,
      addedAt: new Date().toISOString()
    }

    queue.value.push(queueItem)
    return queueItem.id
  }

  // 从队列中移除
  const removeFromQueue = (id) => {
    const index = queue.value.findIndex(item => item.id === id)
    if (index !== -1) {
      queue.value.splice(index, 1)
      return true
    }
    return false
  }

  // 更新队列项
  const updateQueueItem = (id, updates) => {
    const item = queue.value.find(item => item.id === id)
    if (item) {
      Object.assign(item, updates)
      return true
    }
    return false
  }

  // 获取队列项
  const getQueueItem = (id) => {
    return queue.value.find(item => item.id === id)
  }

  // 清空队列
  const clearQueue = () => {
    queue.value = []
  }

  // 清空已完成的项
  const clearCompleted = () => {
    queue.value = queue.value.filter(item =>
      item.status !== QUEUE_STATUS.COMPLETED
    )
  }

  // 计算属性：各状态的数量
  const pendingCount = computed(() =>
    queue.value.filter(item => item.status === QUEUE_STATUS.PENDING).length
  )

  const uploadingCount = computed(() =>
    queue.value.filter(item =>
      item.status === QUEUE_STATUS.UPLOADING || item.status === QUEUE_STATUS.SAVING
    ).length
  )

  const completedCount = computed(() =>
    queue.value.filter(item => item.status === QUEUE_STATUS.COMPLETED).length
  )

  const failedCount = computed(() =>
    queue.value.filter(item => item.status === QUEUE_STATUS.FAILED).length
  )

  const totalCount = computed(() => queue.value.length)

  // 获取下一个待上传的项
  const getNextPending = () => {
    return queue.value.find(item => item.status === QUEUE_STATUS.PENDING)
  }

  // 检查是否有项正在上传
  const hasUploading = computed(() => uploadingCount.value > 0)

  return {
    queue,
    QUEUE_STATUS,
    addToQueue,
    removeFromQueue,
    updateQueueItem,
    getQueueItem,
    clearQueue,
    clearCompleted,
    getNextPending,
    pendingCount,
    uploadingCount,
    completedCount,
    failedCount,
    totalCount,
    hasUploading
  }
}
