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

  // 保存上传进度到 localStorage
  const saveUploadProgress = (fileId, chunkIndex, totalChunks, uploadUrl) => {
    const progress = {
      fileId,
      chunkIndex,
      totalChunks,
      uploadUrl,  // 保存 upload_url 用于验证 session
      timestamp: Date.now()
    }
    localStorage.setItem('upload_progress', JSON.stringify(progress))
  }

  // 获取上传进度
  const getUploadProgress = (fileId, uploadUrl) => {
    try {
      const saved = localStorage.getItem('upload_progress')
      if (saved) {
        const progress = JSON.parse(saved)

        // 检查是否是同一个文件
        if (progress.fileId !== fileId) {
          return null
        }

        // 检查是否超过24小时
        if ((Date.now() - progress.timestamp) >= 24 * 60 * 60 * 1000) {
          console.log('断点续传记录已过期(超过24小时)')
          return null
        }

        // 关键: 检查 upload_url 是否相同 (同一个 upload session)
        if (progress.uploadUrl !== uploadUrl) {
          console.warn('upload_url 不匹配,可能是新的 upload session,清除旧的断点记录')
          clearUploadProgress()
          return null
        }

        return progress
      }
    } catch (e) {
      console.error('读取上传进度失败:', e)
    }
    return null
  }

  // 清除上传进度
  const clearUploadProgress = () => {
    localStorage.removeItem('upload_progress')
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
  const uploadFileInChunks = async (file, uploadUrl, onStatus, onProgress, resumeFrom = 0) => {
    const total = file.size
    const chunkSize = CHUNK_SIZE
    const chunks = Math.ceil(total / chunkSize)
    const fileId = getFileIdentifier(file)

    let uploadedBytes = resumeFrom * chunkSize
    const startTime = Date.now()
    let lastChunkResponse = null

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
          const elapsed = (Date.now() - startTime) / 1000 // 已用时间（秒）
          let speedStr = ''
          let timeRemainingStr = ''

          if (elapsed > 0) {
            const speed = currentTotalUploaded / elapsed // 上传速度（字节/秒）
            speedStr = formatFileSize(speed) + '/s'
            const remainingBytes = total - currentTotalUploaded
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

        const response = await uploadChunk(chunk, start, end, total, uploadUrl, onChunkProgress)

        // 保存最后一片的响应（包含完整文件信息）
        if (i === chunks - 1) {
          try {
            lastChunkResponse = JSON.parse(response)
          } catch (e) {
            lastChunkResponse = response
          }
        }

        // 保存进度 (包含 uploadUrl)
        saveUploadProgress(fileId, i, chunks, uploadUrl)

        // 更新已上传字节数（当前分片完成）
        uploadedBytes = end + 1
        const percent = Math.round((uploadedBytes / total) * 100)
        const elapsed = (Date.now() - startTime) / 1000
        let speedStr = ''
        let timeRemainingStr = ''

        if (elapsed > 0) {
          const speed = uploadedBytes / elapsed
          speedStr = formatFileSize(speed) + '/s'
          const remainingBytes = total - uploadedBytes
          const timeRemaining = remainingBytes / speed
          timeRemainingStr = formatTimeRemaining(timeRemaining)
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

      // 上传完成，清除进度
      clearUploadProgress()
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
  const uploadFile = async (file, uploadUrl, onStatus, onProgress) => {
    if (!file || !uploadUrl) return null

    // 保存文件以便重新上传
    lastUploadedFile.value = file

    // 重置进度
    if (!onProgress) {
      uploadProgress.value = 0
      uploadSpeed.value = ''
      uploadTimeRemaining.value = '' // 重置剩余时间
    }
    isUploading.value = true
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
          uploadResponse = await uploadFileInChunks(file, uploadUrl, onStatus, onProgress, resumeFrom)
        } else {
          uploadResponse = await uploadFileInChunks(file, uploadUrl, onStatus, onProgress, 0)
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
      isUploading.value = false
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
    formatFileSize
  }
}
