import { ref } from 'vue'
import { CHUNK_SIZE, MIN_CHUNK_SIZE } from '../config'

export function useUpload() {
  const uploadProgress = ref(0)
  const uploadSpeed = ref('')
  const uploadTimeRemaining = ref('') // 剩余时间
  const isUploading = ref(false)
  const lastUploadedFile = ref(null)
  const canResume = ref(false)
  let currentUploadController = null

  // 生成文件唯一标识
  const getFileIdentifier = (file) => {
    return `${file.name}_${file.size}_${file.lastModified}`
  }

  // 保存上传进度到 localStorage（每个文件独立存储）
  const saveUploadProgress = (fileId, chunkIndex, totalChunks, uploadUrl, fileIdFromServer) => {
    const progress = {
      fileId,
      chunkIndex,
      totalChunks,
      uploadUrl,  // 保存 upload_url 用于跨会话恢复
      fileIdFromServer, // 保存服务器返回的 file_id
      timestamp: Date.now()
    }
    // 使用 fileId 作为键的一部分，支持多文件并发上传
    const storageKey = `upload_progress_${fileId}`
    localStorage.setItem(storageKey, JSON.stringify(progress))
  }

  // 检查是否存在断点记录（不验证 upload_url，用于跨会话恢复）
  const hasUploadProgress = (fileId) => {
    try {
      const storageKey = `upload_progress_${fileId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const progress = JSON.parse(saved)

        // 检查是否是同一个文件
        if (progress.fileId !== fileId) {
          return null
        }

        // 检查是否超过24小时
        if ((Date.now() - progress.timestamp) >= 24 * 60 * 60 * 1000) {
          console.log('断点续传记录已过期(超过24小时)')
          clearUploadProgress(fileId)
          return null
        }

        return progress
      }
    } catch (e) {
      console.error('读取上传进度失败:', e)
    }
    return null
  }

  // 获取上传进度（从该文件的独立存储中读取）
  const getUploadProgress = (fileId, uploadUrl) => {
    try {
      const storageKey = `upload_progress_${fileId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const progress = JSON.parse(saved)

        // 检查是否是同一个文件
        if (progress.fileId !== fileId) {
          console.warn('fileId 不匹配，清除断点记录')
          clearUploadProgress(fileId)
          return null
        }

        // 检查是否超过24小时
        if ((Date.now() - progress.timestamp) >= 24 * 60 * 60 * 1000) {
          console.log('断点续传记录已过期(超过24小时)')
          clearUploadProgress(fileId)
          return null
        }

        // 关键: 检查 upload_url 是否相同 (同一个 upload session)
        if (uploadUrl && progress.uploadUrl !== uploadUrl) {
          console.warn('upload_url 不匹配,无法使用新 session 续传旧任务')
          // upload_url 必须匹配才能续传，否则清除断点记录
          clearUploadProgress(fileId)
          return null
        }

        return progress
      }
    } catch (e) {
      console.error('读取上传进度失败:', e)
    }
    return null
  }

  // 清除上传进度（接受 fileId 参数，清除指定文件的断点记录）
  const clearUploadProgress = (fileId = null) => {
    if (fileId) {
      // 清除指定文件的断点记录
      const storageKey = `upload_progress_${fileId}`
      localStorage.removeItem(storageKey)
    } else {
      // 兼容旧代码：清除所有断点记录（清理遗留的旧格式数据）
      localStorage.removeItem('upload_progress')

      // 清除所有以 upload_progress_ 开头的键
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('upload_progress_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    }
    canResume.value = false
  }

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // 格式化剩余时间
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds === Infinity || isNaN(seconds)) {
      return '计算中...'
    }

    if (seconds < 60) {
      return `${Math.ceil(seconds)} 秒`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const secs = Math.ceil(seconds % 60)
      return `${minutes} 分 ${secs} 秒`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours} 小时 ${minutes} 分`
    }
  }

  // 上传单个分片（带实时进度更新）
  const uploadChunk = (chunk, start, end, total, uploadUrl, onChunkProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      currentUploadController = {
        abort: () => xhr.abort()
      }

      // 监听分片内部的上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onChunkProgress) {
          // 计算当前分片在整个文件中的实际进度
          const chunkUploaded = e.loaded
          onChunkProgress(chunkUploaded)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText)
        } else {
          reject(new Error(`分片上传失败: ${xhr.status} ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('上传已取消'))
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${total}`)
      xhr.send(chunk)
    })
  }

  // 分片上传文件（支持断点续传）
  const uploadFileInChunks = async (file, uploadUrl, onStatus, onProgress, resumeFrom = 0, fileIdFromServer = null) => {
    const total = file.size
    const chunkSize = CHUNK_SIZE
    const chunks = Math.ceil(total / chunkSize)
    const fileId = getFileIdentifier(file)

    let uploadedBytes = resumeFrom * chunkSize
    let lastChunkResponse = null

    // 速度计算优化：使用滑动窗口记录最近的上传数据
    // 只记录本次会话实际上传的字节数，不包含断点续传前已上传的部分
    const sessionStartTime = Date.now() // 本次会话开始时间
    let sessionUploadedBytes = 0 // 本次会话已上传字节数
    const speedWindow = [] // 速度采样窗口 [{timestamp, bytes}, ...]
    const SPEED_WINDOW_SIZE = 8 // 保留最近8个采样点（增加窗口大小，更平滑）
    const SPEED_SAMPLE_INTERVAL = 800 // 每800ms采样一次（降低采样频率）

    let lastSampleTime = Date.now()
    let lastUpdateTime = 0 // 上次更新UI的时间
    const UI_UPDATE_INTERVAL = 500 // UI更新间隔（500ms），避免过于频繁刷新

    // 用于平滑显示的变量
    let lastDisplayedSpeed = 0
    let lastDisplayedTimeRemaining = 0

    console.log(`开始分片上传: 文件大小 ${formatFileSize(total)}, 分片数 ${chunks}, 每片 ${formatFileSize(chunkSize)}`)
    if (resumeFrom > 0) {
      console.log(`从第 ${resumeFrom + 1} 个分片继续上传（断点续传）`)
    }

    try {
      for (let i = resumeFrom; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, total) - 1
        const chunk = file.slice(start, end + 1)

        console.log(`上传分片 ${i + 1}/${chunks}: bytes ${start}-${end}/${total}`)

        if (onStatus) {
          onStatus(`正在上传分片 ${i + 1}/${chunks}...`, 'uploading')
        }

        // 分片内部进度回调：实时更新进度条
        const onChunkProgress = (chunkUploaded) => {
          // 计算总体已上传字节数 = 之前分片已上传 + 当前分片已上传
          const currentTotalUploaded = uploadedBytes + chunkUploaded
          const percent = Math.round((currentTotalUploaded / total) * 100)

          // 更新本次会话的上传字节数（用于精确速度计算）
          const previousSessionBytes = sessionUploadedBytes
          sessionUploadedBytes = currentTotalUploaded - (resumeFrom * chunkSize)
          const newBytesInSample = sessionUploadedBytes - previousSessionBytes

          const now = Date.now()

          // 每隔一定时间采样一次，避免过于频繁
          if (now - lastSampleTime >= SPEED_SAMPLE_INTERVAL || newBytesInSample > 0) {
            lastSampleTime = now

            // 添加新采样点
            speedWindow.push({
              timestamp: now,
              bytes: sessionUploadedBytes
            })

            // 保持窗口大小
            if (speedWindow.length > SPEED_WINDOW_SIZE) {
              speedWindow.shift()
            }
          }

          // 限制UI更新频率，避免过于频繁刷新导致跳动
          if (now - lastUpdateTime < UI_UPDATE_INTERVAL) {
            return
          }
          lastUpdateTime = now

          let speedStr = ''
          let timeRemainingStr = ''
          let currentSpeed = 0
          let currentTimeRemaining = 0

          // 基于滑动窗口计算速度
          if (speedWindow.length >= 2) {
            const oldest = speedWindow[0]
            const newest = speedWindow[speedWindow.length - 1]
            const timeDiff = (newest.timestamp - oldest.timestamp) / 1000 // 秒
            const bytesDiff = newest.bytes - oldest.bytes

            if (timeDiff > 0) {
              currentSpeed = bytesDiff / timeDiff // 字节/秒
              const remainingBytes = total - currentTotalUploaded
              currentTimeRemaining = remainingBytes / currentSpeed
            }
          } else if (speedWindow.length === 1) {
            // 只有一个采样点时，使用会话开始时间计算
            const elapsed = (now - sessionStartTime) / 1000
            if (elapsed > 0 && sessionUploadedBytes > 0) {
              currentSpeed = sessionUploadedBytes / elapsed
              const remainingBytes = total - currentTotalUploaded
              currentTimeRemaining = remainingBytes / currentSpeed
            }
          }

          // 平滑处理：使用指数移动平均（EMA）减少跳动
          // EMA公式: 新值 = α * 当前值 + (1-α) * 上次值
          const smoothingFactor = 0.3 // 平滑系数，值越小越平滑

          if (lastDisplayedSpeed === 0) {
            // 第一次显示，直接使用当前值
            lastDisplayedSpeed = currentSpeed
            lastDisplayedTimeRemaining = currentTimeRemaining
          } else {
            // 平滑过渡
            lastDisplayedSpeed = smoothingFactor * currentSpeed + (1 - smoothingFactor) * lastDisplayedSpeed
            lastDisplayedTimeRemaining = smoothingFactor * currentTimeRemaining + (1 - smoothingFactor) * lastDisplayedTimeRemaining
          }

          // 格式化显示
          if (lastDisplayedSpeed > 0) {
            speedStr = formatFileSize(lastDisplayedSpeed) + '/s'
            timeRemainingStr = formatTimeRemaining(lastDisplayedTimeRemaining)
          }

          if (onProgress) {
            onProgress(percent, speedStr, timeRemainingStr)
          } else {
            uploadProgress.value = percent
            uploadSpeed.value = speedStr
            uploadTimeRemaining.value = timeRemainingStr
          }
        }

        const response = await uploadChunk(chunk, start, end, total, uploadUrl, onChunkProgress)

        // 保存最后一片的响应（包含完整文件信息）
        if (i === chunks - 1) {
          try {
            lastChunkResponse = JSON.parse(response)
          } catch (e) {
            lastChunkResponse = response
          }
        }

        // 保存进度 (包含 uploadUrl 和 fileIdFromServer)
        saveUploadProgress(fileId, i, chunks, uploadUrl, fileIdFromServer)

        // 更新已上传字节数（当前分片完成）
        uploadedBytes = end + 1
        sessionUploadedBytes = uploadedBytes - (resumeFrom * chunkSize)
        const percent = Math.round((uploadedBytes / total) * 100)

        let speedStr = ''
        let timeRemainingStr = ''
        let currentSpeed = 0
        let currentTimeRemaining = 0

        // 使用滑动窗口计算速度（分片完成时也更新一次）
        const now = Date.now()
        speedWindow.push({
          timestamp: now,
          bytes: sessionUploadedBytes
        })

        if (speedWindow.length > SPEED_WINDOW_SIZE) {
          speedWindow.shift()
        }

        if (speedWindow.length >= 2) {
          const oldest = speedWindow[0]
          const newest = speedWindow[speedWindow.length - 1]
          const timeDiff = (newest.timestamp - oldest.timestamp) / 1000
          const bytesDiff = newest.bytes - oldest.bytes

          if (timeDiff > 0) {
            currentSpeed = bytesDiff / timeDiff
            const remainingBytes = total - uploadedBytes
            currentTimeRemaining = remainingBytes / currentSpeed
          }
        } else {
          // 只有一个采样点，使用会话时间计算
          const elapsed = (now - sessionStartTime) / 1000
          if (elapsed > 0 && sessionUploadedBytes > 0) {
            currentSpeed = sessionUploadedBytes / elapsed
            const remainingBytes = total - uploadedBytes
            currentTimeRemaining = remainingBytes / currentSpeed
          }
        }

        // 分片完成时也应用平滑处理
        const smoothingFactor = 0.3
        if (lastDisplayedSpeed === 0) {
          lastDisplayedSpeed = currentSpeed
          lastDisplayedTimeRemaining = currentTimeRemaining
        } else {
          lastDisplayedSpeed = smoothingFactor * currentSpeed + (1 - smoothingFactor) * lastDisplayedSpeed
          lastDisplayedTimeRemaining = smoothingFactor * currentTimeRemaining + (1 - smoothingFactor) * lastDisplayedTimeRemaining
        }

        if (lastDisplayedSpeed > 0) {
          speedStr = formatFileSize(lastDisplayedSpeed) + '/s'
          timeRemainingStr = formatTimeRemaining(lastDisplayedTimeRemaining)
        }

        if (onProgress) {
          onProgress(percent, speedStr, timeRemainingStr)
        } else {
          uploadProgress.value = percent
          uploadSpeed.value = speedStr
          uploadTimeRemaining.value = timeRemainingStr
        }

        console.log(`分片 ${i + 1} 上传成功`)
      }

      // 上传完成，清除该文件的断点记录
      clearUploadProgress(fileId)
      console.log('所有分片上传完成')

      // 返回最后一片的响应数据
      return lastChunkResponse
    } catch (error) {
      // 上传失败，保持进度记录，允许断点续传
      console.error('分片上传失败，已保存进度，可以断点续传')
      canResume.value = true
      throw error
    }
  }

  // 完整上传（小文件）
  const uploadFileComplete = (file, uploadUrl, onProgress) => {
    const start = 0
    const end = file.size - 1
    const total = file.size
    const startTime = Date.now()

    console.log(`开始完整上传: ${formatFileSize(total)}`)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      currentUploadController = {
        abort: () => xhr.abort()
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          const elapsed = (Date.now() - startTime) / 1000 // 已用时间（秒）
          let speedStr = ''
          let timeRemainingStr = ''

          if (elapsed > 0) {
            const speed = e.loaded / elapsed // 上传速度（字节/秒）
            speedStr = formatFileSize(speed) + '/s'
            const remainingBytes = e.total - e.loaded
            const timeRemaining = remainingBytes / speed // 剩余时间（秒）
            timeRemainingStr = formatTimeRemaining(timeRemaining)
          }

          if (onProgress) {
            onProgress(percent, speedStr, timeRemainingStr)
          } else {
            uploadProgress.value = percent
            uploadSpeed.value = speedStr
            uploadTimeRemaining.value = timeRemainingStr
          }
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('上传响应:', xhr.responseText)
          // 解析并返回 OneDrive 响应数据
          try {
            const responseData = JSON.parse(xhr.responseText)
            resolve(responseData)
          } catch (e) {
            resolve(xhr.responseText)
          }
        } else {
          const error = new Error(`上传失败: ${xhr.status} ${xhr.statusText}`)
          console.error('上传失败:', xhr.status, xhr.statusText, xhr.responseText)
          reject(error)
        }
      })

      xhr.addEventListener('error', () => {
        const error = new Error('网络错误，上传失败')
        console.error('网络错误')
        reject(error)
      })

      xhr.addEventListener('abort', () => {
        const error = new Error('上传已取消')
        reject(error)
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${total}`)
      xhr.send(file)
    })
  }

  // 上传文件（自动选择分片或完整上传，支持断点续传）
  const uploadFile = async (file, uploadUrl, onStatus, onProgress, fileIdFromServer = null) => {
    if (!file || !uploadUrl) return null

    // 保存文件以便重新上传
    lastUploadedFile.value = file

    // 重置进度
    if (!onProgress) {
      uploadProgress.value = 0
      uploadSpeed.value = ''
      uploadTimeRemaining.value = '' // 重置剩余时间
    }
    if (!onProgress) {
      isUploading.value = true
    }
    canResume.value = false

    try {
      if (onStatus) {
        onStatus('正在准备上传...', 'uploading')
      }

      let uploadResponse = null

      // 根据文件大小选择上传方式
      if (file.size > MIN_CHUNK_SIZE) {
        console.log('使用分片上传模式')

        // 检查是否有断点 (传入 uploadUrl 验证 session)
        const fileId = getFileIdentifier(file)
        const savedProgress = getUploadProgress(fileId, uploadUrl)

        if (savedProgress && savedProgress.chunkIndex >= 0) {
          const resumeFrom = savedProgress.chunkIndex + 1
          console.log(`检测到断点，从第 ${resumeFrom + 1} 个分片继续上传`)
          if (onStatus) {
            onStatus(`检测到上传记录，从第 ${resumeFrom + 1} 个分片继续...`, 'uploading')
          }
          uploadResponse = await uploadFileInChunks(file, uploadUrl, onStatus, onProgress, resumeFrom, fileIdFromServer)
        } else {
          uploadResponse = await uploadFileInChunks(file, uploadUrl, onStatus, onProgress, 0, fileIdFromServer)
        }
      } else {
        console.log('使用完整上传模式')
        uploadResponse = await uploadFileComplete(file, uploadUrl, onProgress)
      }

      if (onStatus) {
        onStatus('上传成功！', 'success')
      }

      // 返回上传响应数据
      return uploadResponse
    } catch (error) {
      console.error('上传异常:', error)
      if (onStatus) {
        onStatus(`上传出错: ${error.message}`, 'error')
      }
      throw error
    } finally {
      if (!onProgress) {
        isUploading.value = false
      }
      currentUploadController = null
    }
  }

  // 取消上传
  const cancelUpload = () => {
    if (currentUploadController) {
      currentUploadController.abort()
    }
  }

  return {
    uploadProgress,
    uploadSpeed,
    uploadTimeRemaining, // 导出剩余时间
    isUploading,
    lastUploadedFile,
    canResume,
    uploadFile,
    cancelUpload,
    clearUploadProgress,
    formatFileSize,
    hasUploadProgress, // 导出断点检测函数
    getFileIdentifier  // 导出文件标识生成函数
  }
}
