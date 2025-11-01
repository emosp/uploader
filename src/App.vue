<template>
  <div class="gradient-theme min-h-screen flex items-center justify-center p-3 sm:p-5">
    <!-- 顶部通知消息 -->
    <StatusMessage
      :message="notification.message.value"
      :type="notification.type.value"
      :visible="notification.visible.value"
    />

    <div class="bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-10 max-w-5xl w-full">
      <h1 class="text-gray-800 mb-1 sm:mb-2 text-lg sm:text-xl lg:text-2xl font-bold">
        EMOS emby公益服 视频上传服务
        <small class="text-gray-400 text-xs sm:text-sm">v0.0.1</small>
      </h1>
      <p class="text-gray-600 mb-4 sm:mb-6 lg:mb-8 text-xs sm:text-sm">支持上传到 Microsoft OneDrive</p>

      <!-- 用户信息和视频信息左右布局 -->
      <div class="flex gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-5 lg:mb-6 flex-col lg:flex-row items-stretch">
        <!-- 用户信息面板 (左侧 360px) -->
        <UserPanel
          :is-logged-in="auth.isLoggedIn.value"
          :username="auth.username.value"
          :is-uploading="upload.isUploading.value"
          :is-saving="isSaving"
          @login="handleLogin"
          @logout="handleLogout"
        />

        <!-- 视频信息区域 (右侧 480px) -->
        <VideoInfo
          v-model:video-id="video.videoId.value"
          :video-info="video.videoInfo.value"
          :is-loading="video.isLoading.value"
          :error="video.error.value"
          :is-valid="video.isValid.value"
          :is-uploading="upload.isUploading.value"
          :is-saving="isSaving"
          @fetch="handleFetchVideoInfo"
          @validate="handleValidateVideoId"
        />
      </div>

      <!-- 文件上传区域 -->
      <FileUpload
        ref="fileUploadRef"
        :video-id="video.videoId.value"
        :video-info="video.videoInfo.value"
        :upload-progress="upload.uploadProgress.value"
        :upload-speed="upload.uploadSpeed.value"
        :upload-time-remaining="upload.uploadTimeRemaining.value"
        :is-uploading="upload.isUploading.value"
        :is-saving="isSaving"
        :show-reupload="showReupload"
        :show-resave="showResave"
        :upload-token="uploadToken.uploadToken.value"
        :upload-summary-info="uploadSummaryInfo"
        :format-file-size="upload.formatFileSize"
        :enable-queue="true"
        @file-selected="handleFileSelected"
        @start-upload="handleStartUpload"
        @reupload="handleReupload"
        @resave="handleResave"
        @continue-upload="handleContinueUpload"
        @add-to-queue="handleAddToQueue"
      />

      <!-- 文件夹批量上传 -->
      <FolderUpload
        v-if="auth.isLoggedIn.value"
        class="mt-4 sm:mt-5 lg:mt-6"
        @add-to-queue="handleAddFolderToQueue"
        @recognition-error="handleRecognitionError"
      />

      <!-- 上传队列 -->
      <UploadQueue
        :queue="uploadQueue.queue.value"
        :idle-count="uploadQueue.idleCount.value"
        :pending-count="uploadQueue.pendingCount.value"
        :uploading-count="uploadQueue.uploadingCount.value"
        :completed-count="uploadQueue.completedCount.value"
        :has-uploading="uploadQueue.hasUploading.value"
        :QUEUE_STATUS="uploadQueue.QUEUE_STATUS"
        :format-file-size="upload.formatFileSize"
        :queue-summary-info="queueSummaryInfo"
        :max-concurrent-uploads="maxConcurrentUploads"
        @start-item="handleStartQueueItem"
        @remove-item="handleRemoveQueueItem"
        @retry-item="handleRetryQueueItem"
        @upload-all="handleUploadAll"
        @clear-completed="handleClearCompleted"
        @clear-summary="queueSummaryInfo = null"
        @update:max-concurrent-uploads="handleMaxConcurrentUploadsChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import StatusMessage from './components/StatusMessage.vue'
import UserPanel from './components/UserPanel.vue'
import VideoInfo from './components/VideoInfo.vue'
import FileUpload from './components/FileUpload.vue'
import FolderUpload from './components/FolderUpload.vue'
import UploadQueue from './components/UploadQueue.vue'
import { useAuth } from './composables/useAuth'
import { useVideoInfo } from './composables/useVideoInfo'
import { useUpload } from './composables/useUpload'
import { useUploadToken } from './composables/useUploadToken'
import { useNotification } from './composables/useNotification'
import { useUploadQueue } from './composables/useUploadQueue'

// 初始化所有 composables
const auth = useAuth()
const video = useVideoInfo()
const upload = useUpload()
const uploadToken = useUploadToken()
const notification = useNotification()
const uploadQueue = useUploadQueue()

const showReupload = ref(false)
const showResave = ref(false)
const fileUploadRef = ref(null)
const currentFile = ref(null)
const currentUploadType = ref('video')
const uploadedFileInfo = ref(null) // 保存已上传文件的信息
const uploadSummaryInfo = ref(null) // 保存上传完成后的汇总信息
const isSaving = ref(false) // 是否正在保存上传结果
const queueSummaryInfo = ref(null) // 队列上传完成后的汇总信息
const maxConcurrentUploads = ref(3) // 最大并发上传数
const isQueueRunning = ref(false) // 队列是否正在运行

// 检查上传 token 是否过期
const isTokenExpired = (uploadUrl) => {
  try {
    // 从 upload_url 中提取 tempauth 参数
    const url = new URL(uploadUrl)
    const tempauth = url.searchParams.get('tempauth')

    if (!tempauth) {
      console.warn('无法找到 tempauth 参数')
      return true // 没有 tempauth 视为已过期
    }

    // tempauth 是 base64 编码的 JWT,解码 payload
    // JWT 格式: header.payload.signature
    const parts = tempauth.split('.')
    if (parts.length !== 3) {
      console.warn('tempauth 格式不正确')
      return true
    }

    // 解码 payload (第二部分)
    const payload = JSON.parse(atob(parts[1]))

    if (!payload.exp) {
      console.warn('JWT payload 中没有 exp 字段')
      return true
    }

    // exp 是 Unix 时间戳(秒),转换为毫秒
    const expirationTime = parseInt(payload.exp) * 1000
    const currentTime = Date.now()

    // 提前 5 分钟判断为过期,留出操作时间
    const bufferTime = 5 * 60 * 1000
    const isExpired = currentTime >= (expirationTime - bufferTime)

    if (isExpired) {
      const expDate = new Date(expirationTime).toLocaleString('zh-CN')
      console.log(`Token 已过期或即将过期,过期时间: ${expDate}`)
    }

    return isExpired
  } catch (error) {
    console.error('检查 token 过期失败:', error)
    return true // 检查失败视为已过期
  }
}

// 用户登录
const handleLogin = () => {
  auth.login()
}

// 用户登出
const handleLogout = () => {
  // 执行登出操作
  auth.logout()

  // 重置所有面板状态
  // 1. 清除视频 ID 和视频信息
  video.videoId.value = ''
  video.videoInfo.value = null
  video.isValid.value = false
  video.error.value = null

  // 2. 清除文件选择
  fileUploadRef.value?.resetFile()
  currentFile.value = null
  currentUploadType.value = 'video'

  // 3. 清除上传进度和状态
  upload.uploadProgress.value = 0
  upload.uploadSpeed.value = ''
  upload.clearUploadProgress() // 清除断点续传记录

  // 4. 清除上传令牌
  uploadToken.clearToken()

  // 5. 重置按钮状态
  showReupload.value = false
  showResave.value = false

  // 6. 清除已上传文件信息和汇总信息
  uploadedFileInfo.value = null
  uploadSummaryInfo.value = null

  // 7. 重置保存状态
  isSaving.value = false

  // 显示登出成功消息
  notification.showStatus('已登出', 'success')
}

// 验证视频 ID
const handleValidateVideoId = (value) => {
  video.updateValidation(value)
}

// 获取视频信息
const handleFetchVideoInfo = async () => {
  // 先检查是否已登录
  if (!auth.isLoggedIn.value) {
    notification.showStatus('请先登录后再获取视频信息', 'error')
    return
  }

  // 再校验视频 ID
  if (!video.videoId.value.trim()) {
    notification.showStatus('请先输入视频 ID', 'error')
    return
  }

  if (!video.validateVideoId(video.videoId.value.trim())) {
    notification.showStatus('视频 ID 格式不正确，必须以 vl- 或 ve- 开头，后跟正整数', 'error')
    return
  }

  await video.fetchVideoInfo()
}

// 文件选择后不再立即获取上传令牌
const handleFileSelected = async (file, uploadType, errorMessage) => {
  if (errorMessage) {
    notification.showStatus(errorMessage, 'error')
    return
  }

  if (!file) {
    return
  }

  // 保存文件和上传类型
  currentFile.value = file
  currentUploadType.value = uploadType

  // 重置上传相关状态（重新选择文件时清除之前的错误状态）
  showReupload.value = false
  showResave.value = false

  // 先检查是否已登录
  if (!auth.isLoggedIn.value) {
    notification.showStatus('请先登录后再选择文件', 'error')
    fileUploadRef.value?.resetFile()
    return
  }

  // 验证视频 ID
  const videoId = video.videoId.value.trim()
  if (!videoId) {
    notification.showStatus('请先输入视频 ID', 'error')
    fileUploadRef.value?.resetFile()
    return
  }

  if (!video.validateVideoId(videoId)) {
    notification.showStatus('视频 ID 格式不正确，必须以 vl- 或 ve- 开头，后跟正整数', 'error')
    fileUploadRef.value?.resetFile()
    return
  }

  // 不再自动获取 token，等待用户点击"开始上传"按钮
  notification.showStatus('文件已选择，点击"开始上传"按钮开始上传', 'success')
}

// 开始上传：先获取 token，成功后立即上传
const handleStartUpload = async (file, uploadType) => {
  if (!file) {
    notification.showStatus('请先选择文件', 'error')
    return
  }

  showReupload.value = false
  showResave.value = false
  notification.hideStatus()

  try {
    // 第一步：获取上传令牌
    notification.showStatus('正在获取上传令牌...', 'uploading')

    await uploadToken.getUploadToken(
      uploadType,
      file.type,
      file.name,
      file.size
    )

    notification.showStatus('上传令牌获取成功，开始上传...', 'uploading')

    // 第二步：使用上传令牌中的 upload_url 上传文件
    const uploadResponse = await upload.uploadFile(
      file,
      uploadToken.uploadToken.value.upload_url,
      (msg, type) => {
        notification.showStatus(msg, type)
      },
      null // 这里我们不需要独立的进度回调，因为它会使用全局状态
    )

    // 文件上传成功,保存上传信息
    uploadedFileInfo.value = {
      uploadResponse,
      fileId: uploadToken.uploadToken.value.file_id
    }

    // 立即展示 OneDrive 上传成功的信息
    let uploadSuccessMessage = '上传成功！'
    if (uploadResponse && uploadResponse.size) {
      const fileSizeMB = (uploadResponse.size / (1024 * 1024)).toFixed(2)
      uploadSuccessMessage += ` 文件大小: ${fileSizeMB} MB`

      if (uploadResponse.name) {
        uploadSuccessMessage += ` | 文件名: ${uploadResponse.name}`
      }
    }
    notification.showStatus(uploadSuccessMessage, 'success')

    // 上传成功后,调用保存接口
    await saveUploadedFile()

  } catch (error) {
    // 区分是获取 token 失败还是上传失败
    if (!uploadToken.uploadToken.value) {
      // Token 获取失败
      let errorMessage = '获取上传令牌失败'
      if (error.message.includes('500')) {
        errorMessage = '服务器繁忙，请稍后再试'
      } else if (error.message) {
        errorMessage = `获取上传令牌失败: ${error.message}`
      }
      notification.showStatus(errorMessage, 'error')

      // 清除文件，让用户重新选择
      fileUploadRef.value?.resetFile()
      currentFile.value = null
    } else {
      // 文件上传失败,显示重新上传按钮
      console.error('文件上传失败:', error)
      showReupload.value = true
    }
    uploadedFileInfo.value = null
  }
}

// 保存已上传的文件信息到服务器（带自动重试）
const saveUploadedFile = async () => {
  try {
    isSaving.value = true
    notification.showStatus('正在保存上传结果...', 'uploading')

    const videoId = video.videoId.value.trim()
    const match = videoId.match(/^(vl|ve)-(\d+)$/)
    const itemType = match[1]
    const itemId = match[2]

    const saveResult = await uploadToken.saveUploadResult(
      uploadedFileInfo.value.fileId,
      itemType,
      itemId,
      // 重试回调函数
      (attempt, maxRetries, delaySec) => {
        notification.showStatus(
          `视频正在合并中，${delaySec}秒后自动重试 (${attempt}/${maxRetries})...`,
          'uploading'
        )
      }
    )

    // 构建保存成功消息,包含上传信息和胡萝卜奖励
    let saveSuccessMessage = `保存成功！这是您上传的第 ${saveResult.count} 个资源`
    if (saveResult.radish && saveResult.radish > 0) {
      saveSuccessMessage += `,恭喜您获得 ${saveResult.radish} 个胡萝卜！`
    }

    notification.showStatus(saveSuccessMessage, 'success')
    showReupload.value = false
    showResave.value = false

    // 构建上传汇总信息，包含 OneDrive 响应和服务器返回的统计信息
    const oneDriveResponse = uploadedFileInfo.value.uploadResponse
    uploadSummaryInfo.value = {
      fileName: oneDriveResponse?.name || currentFile.value?.name || '未知',
      fileSize: oneDriveResponse?.size || currentFile.value?.size || 0,
      uploadTime: oneDriveResponse?.lastModifiedDateTime || new Date().toISOString(),
      totalCount: saveResult.count || 0,
      radishReward: saveResult.radish || 0
    }

    // 清除令牌和已上传文件信息（但保留 uploadSummaryInfo 用于展示）
    uploadToken.clearToken()
    uploadedFileInfo.value = null
  } catch (error) {
    // 保存失败,显示重新保存按钮
    console.error('保存上传结果失败:', error)
    notification.showStatus(`保存失败: ${error.message}`, 'error')
    showResave.value = true
    showReupload.value = false
  } finally {
    isSaving.value = false
  }
}

// 重新上传
const handleReupload = async (file, uploadType) => {
  if (!file) {
    notification.showStatus('错误：没有可重新上传的文件！', 'error')
    return
  }

  // 检查是否有有效的上传令牌
  if (!uploadToken.uploadToken.value || !uploadToken.uploadToken.value.upload_url) {
    notification.showStatus('错误：上传令牌已失效，请重新选择文件！', 'error')
    return
  }

  // 检查 token 是否过期
  if (isTokenExpired(uploadToken.uploadToken.value.upload_url)) {
    notification.showStatus('上传令牌已过期，正在重新获取...', 'error')

    // token 过期,需要重新获取令牌
    try {
      await handleFileSelected(file, uploadType)

      // 如果令牌获取成功,自动开始上传
      if (uploadToken.uploadToken.value) {
        await handleStartUpload(file, uploadType)
      }
    } catch (error) {
      console.error('重新获取令牌失败:', error)
    }
    return
  }

  console.log('重新上传文件(断点续传):', file.name)

  showReupload.value = false
  showResave.value = false
  notification.hideStatus()

  try {
    // 使用已有的 upload_url 直接进行断点续传
    const uploadResponse = await upload.uploadFile(
      file,
      uploadToken.uploadToken.value.upload_url,
      (msg, type) => {
        notification.showStatus(msg, type)
      },
      null // 全局状态
    )

    // 文件上传成功,保存上传信息
    uploadedFileInfo.value = {
      uploadResponse,
      fileId: uploadToken.uploadToken.value.file_id
    }

    // 立即展示 OneDrive 上传成功的信息
    let uploadSuccessMessage = '上传成功！'
    if (uploadResponse && uploadResponse.size) {
      const fileSizeMB = (uploadResponse.size / (1024 * 1024)).toFixed(2)
      uploadSuccessMessage += ` 文件大小: ${fileSizeMB} MB`

      if (uploadResponse.name) {
        uploadSuccessMessage += ` | 文件名: ${uploadResponse.name}`
      }
    }
    notification.showStatus(uploadSuccessMessage, 'success')

    // 上传成功后,调用保存接口
    await saveUploadedFile()

  } catch (error) {
    // 文件上传失败,继续显示重新上传按钮
    console.error('文件重新上传失败:', error)
    showReupload.value = true
    uploadedFileInfo.value = null
  }
}

// 重新保存
const handleResave = async () => {
  if (uploadedFileInfo.value) {
    console.log('重新保存上传结果')
    showResave.value = false
    await saveUploadedFile()
  } else {
    notification.showStatus('错误：没有可保存的文件信息！', 'error')
  }
}

// 继续上传（清除上传汇总信息，准备下一次上传）
const handleContinueUpload = () => {
  // 清除上传汇总信息
  uploadSummaryInfo.value = null

  // 清空文件选择
  fileUploadRef.value?.resetFile()
  currentFile.value = null

  // 清空视频 ID
  video.videoId.value = ''
  video.videoInfo.value = null
  video.isValid.value = false

  // 清空并隐藏进度条
  upload.uploadProgress.value = 0
  upload.uploadSpeed.value = ''
  upload.uploadTimeRemaining.value = '' // 清空剩余时间

  notification.showStatus('请输入视频 ID 并选择新的文件继续上传', 'success')
}

// ========== 队列相关功能 ==========

// 处理队列，确保并发数
const processQueue = () => {
  // 使用 nextTick 确保状态更新后再执行调度
  nextTick(() => {
    if (!isQueueRunning.value) {
      return
    }

    const uploadingCount = uploadQueue.uploadingCount.value
    if (uploadingCount >= maxConcurrentUploads.value) {
      return
    }

    // 找到第一个等待中的任务
    const itemToUpload = uploadQueue.queue.value.find(
      item => item.status === uploadQueue.QUEUE_STATUS.PENDING
    )

    if (itemToUpload) {
      handleUploadQueueItem(itemToUpload.id)
    } else {
      // 检查是否所有任务都完成了
      if (uploadingCount === 0) {
        const isAllDone = uploadQueue.queue.value.every(
          item => item.status === uploadQueue.QUEUE_STATUS.COMPLETED || item.status === uploadQueue.QUEUE_STATUS.FAILED || item.status === uploadQueue.QUEUE_STATUS.IDLE
        )
        if (isAllDone) {
          isQueueRunning.value = false
          notification.showStatus('所有排队任务已处理完毕', 'success')
        }
      }
    }
  })
}

// 添加到队列
const handleAddToQueue = (file, uploadType) => {
  if (!file || !video.videoInfo.value) {
    notification.showStatus('请先获取视频信息后再添加到队列', 'error')
    return
  }

  // 添加到队列
  const queueItemId = uploadQueue.addToQueue(
    video.videoId.value,
    video.videoInfo.value,
    file,
    uploadType
  )

  notification.showStatus('已添加到上传队列', 'success')

  // 清空当前选择，允许用户继续添加
  fileUploadRef.value?.resetFile()
  video.videoId.value = ''
  video.videoInfo.value = null
  video.isValid.value = false

  console.log('添加到队列:', queueItemId)
}

// 上传单个队列项（由调度器调用）
const handleUploadQueueItem = async (itemId) => {
  const item = uploadQueue.getQueueItem(itemId)
  // 增加状态检查，确保只处理等待中的任务
  if (!item || item.status !== uploadQueue.QUEUE_STATUS.PENDING) {
    return
  }

  try {
    // 更新状态为上传中
    uploadQueue.updateQueueItem(itemId, {
      status: uploadQueue.QUEUE_STATUS.UPLOADING,
      progress: 0,
      speed: '',
      timeRemaining: '',
      error: null
    })

    // 第一步：获取上传令牌
    notification.showStatus(`正在获取 ${item.videoId} 的上传令牌...`, 'uploading')

    const token = await uploadToken.getUploadToken(
      item.uploadType,
      item.file.type,
      item.file.name,
      item.file.size
    )

    // 保存令牌到队列项
    uploadQueue.updateQueueItem(itemId, {
      uploadToken: token
    })

    notification.showStatus(`开始上传 ${item.file.name}...`, 'uploading')

    // 第二步：上传文件
    const uploadResponse = await upload.uploadFile(
      item.file,
      token.upload_url,
      (msg, type) => {
        notification.showStatus(`${item.file.name}: ${msg}`, type)
      },
      (progress, speed, timeRemaining) => {
        uploadQueue.updateQueueItem(itemId, {
          progress,
          speed,
          timeRemaining
        })
      }
    )

    // 文件上传完成，更新状态
    uploadQueue.updateQueueItem(itemId, {
      status: uploadQueue.QUEUE_STATUS.SAVING,
      uploadResponse,
      progress: 100
    })

    notification.showStatus(`${item.file.name} 上传成功，正在保存...`, 'uploading')

    // 第三步：保存上传结果
    const videoId = item.videoId
    const match = videoId.match(/^(vl|ve)-(\d+)$/)
    const itemType = match[1]
    const itemIdNum = match[2]

    const saveResult = await uploadToken.saveUploadResult(
      token.file_id,
      itemType,
      itemIdNum,
      (attempt, maxRetries, delaySec) => {
        notification.showStatus(
          `${item.file.name} 视频正在合并中，${delaySec}秒后自动重试 (${attempt}/${maxRetries})...`,
          'uploading'
        )
      }
    )

    // 保存成功
    uploadQueue.updateQueueItem(itemId, {
      status: uploadQueue.QUEUE_STATUS.COMPLETED,
      saveResult
    })

    let successMsg = `${item.file.name} 完成！第 ${saveResult.count} 个资源`
    if (saveResult.radish && saveResult.radish > 0) {
      successMsg += `，获得 ${saveResult.radish} 胡萝卜`
    }
    notification.showStatus(successMsg, 'success')

    uploadToken.clearToken()

    if (saveResult) {
      if (!queueSummaryInfo.value) {
        queueSummaryInfo.value = {
          totalCount: 0,
          radishReward: 0
        }
      }
      queueSummaryInfo.value.totalCount = saveResult.count
      queueSummaryInfo.value.radishReward += saveResult.radish || 0
    }

  } catch (error) {
    console.error('队列项上传失败:', error)
    uploadQueue.updateQueueItem(itemId, {
      status: uploadQueue.QUEUE_STATUS.FAILED,
      error: error.message || '上传失败'
    })
    notification.showStatus(`${item.file.name} 上传失败: ${error.message}`, 'error')
  } finally {
    // 一个任务结束后（无论成功失败），都尝试处理下一个
    processQueue()
  }
}

// 从队列移除
const handleRemoveQueueItem = (itemId) => {
  const item = uploadQueue.getQueueItem(itemId)
  uploadQueue.removeFromQueue(itemId)
  notification.showStatus('已从队列移除', 'success')

  if (item && item.status === uploadQueue.QUEUE_STATUS.COMPLETED) {
    if (uploadQueue.completedCount.value === 0) {
      queueSummaryInfo.value = null
    }
  }
}

// 重试失败的项（由UI调用）
const handleRetryQueueItem = (itemId) => {
  const item = uploadQueue.getQueueItem(itemId)
  if (item && item.status === uploadQueue.QUEUE_STATUS.FAILED) {
    // 重置状态为等待，然后让调度器来处理
    uploadQueue.updateQueueItem(itemId, { status: uploadQueue.QUEUE_STATUS.PENDING, error: null })
    processQueue()
  }
}

// 开始单个待命中的项（由UI调用）
const handleStartQueueItem = (itemId) => {
  const item = uploadQueue.getQueueItem(itemId)
  if (item && item.status === uploadQueue.QUEUE_STATUS.IDLE) {
    uploadQueue.updateQueueItem(itemId, { status: uploadQueue.QUEUE_STATUS.PENDING })
    // 如果队列未运行，则启动它
    if (!isQueueRunning.value) {
      isQueueRunning.value = true
      notification.showStatus('队列已启动...', 'uploading')
    }
    processQueue()
  }
}

// 全部上传（由UI调用）
const handleUploadAll = () => {
  // 将所有待命中的任务状态变更为等待中
  uploadQueue.queue.value.forEach(item => {
    if (item.status === uploadQueue.QUEUE_STATUS.IDLE) {
      uploadQueue.updateQueueItem(item.id, { status: uploadQueue.QUEUE_STATUS.PENDING })
    }
  })

  if (!isQueueRunning.value) {
    isQueueRunning.value = true
    notification.showStatus('队列已启动...', 'uploading')
    // 启动 N 个任务
    for (let i = 0; i < maxConcurrentUploads.value; i++) {
      processQueue()
    }
  }
}

// 清除已完成的项
const handleClearCompleted = () => {
  uploadQueue.clearCompleted()
  notification.showStatus('已清除完成项', 'success')
  queueSummaryInfo.value = null
}

// 处理并发数变更
const handleMaxConcurrentUploadsChange = (newValue) => {
  const oldValue = maxConcurrentUploads.value
  maxConcurrentUploads.value = newValue
  if (newValue > oldValue) {
    // 如果增加了并发数，立即尝试启动新任务
    const diff = newValue - oldValue
    for (let i = 0; i < diff; i++) {
      processQueue()
    }
  }
}

// ========== 文件夹批量上传功能 ==========

// 批量添加识别后的文件到队列
const handleAddFolderToQueue = (recognizedFiles) => {
  if (!recognizedFiles || recognizedFiles.length === 0) {
    notification.showStatus('没有可添加的文件', 'error')
    return
  }

  let addedCount = 0
  let skippedCount = 0

  recognizedFiles.forEach(fileInfo => {
    try {
      // 使用用户可能修改后的 displayTitle 作为视频名称
      const videoInfo = {
        title: fileInfo.displayTitle || fileInfo.title,
        // 电影和电视剧的结构不同
        ...(fileInfo.type === '电影' ? {
          // 电影没有季集信息
        } : {
          // 电视剧包含季集信息
          season_number: fileInfo.season ? `S${String(fileInfo.season).padStart(2, '0')}` : '',
          episode_number: fileInfo.episode ? `E${String(fileInfo.episode).padStart(2, '0')}` : '',
        })
      }

      // 添加到队列
      uploadQueue.addToQueue(
        fileInfo.videoId,
        videoInfo,
        fileInfo.file,
        'video' // 默认为视频类型
      )

      addedCount++
    } catch (error) {
      console.error(`添加文件失败 (${fileInfo.fileName}):`, error)
      skippedCount++
    }
  })

  const message = `成功添加 ${addedCount} 个文件到队列${skippedCount > 0 ? `，跳过 ${skippedCount} 个` : ''}`
  notification.showStatus(message, 'success')

  console.log(`批量添加完成: ${addedCount} 成功, ${skippedCount} 跳过`)
}

// 处理识别错误
const handleRecognitionError = (errorMessage) => {
  notification.showStatus(errorMessage, 'error')
}

// 处理登录回调后显示成功消息
const loginCallbackHandled = auth.handleLoginCallback()
if (loginCallbackHandled) {
  notification.showStatus('登录成功！', 'success')
}
</script>
