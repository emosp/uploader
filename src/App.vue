<template>
  <div class="gradient-theme min-h-screen flex items-center justify-center p-5">
    <!-- 顶部通知消息 -->
    <StatusMessage
      :message="notification.message.value"
      :type="notification.type.value"
      :visible="notification.visible.value"
    />

    <div class="bg-white rounded-xl shadow-2xl p-10 max-w-5xl w-full">
      <h1 class="text-gray-800 mb-2 text-2xl font-bold">
        EMOS emby公益服 视频上传服务
        <small class="text-gray-400">v0.0.1</small>
      </h1>
      <p class="text-gray-600 mb-8 text-sm">支持上传到 Microsoft OneDrive</p>

      <!-- 用户信息和视频信息左右布局 -->
      <div class="flex gap-5 mb-6 flex-wrap lg:flex-nowrap items-start">
        <!-- 用户信息面板 (左侧 360px) -->
        <UserPanel
          :is-logged-in="auth.isLoggedIn.value"
          :username="auth.username.value"
          :is-uploading="upload.isUploading.value"
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
          @fetch="handleFetchVideoInfo"
          @validate="handleValidateVideoId"
        />
      </div>

      <!-- 文件上传区域 -->
      <FileUpload
        ref="fileUploadRef"
        :video-id="video.videoId.value"
        :upload-progress="upload.uploadProgress.value"
        :upload-speed="upload.uploadSpeed.value"
        :is-uploading="upload.isUploading.value"
        :show-reupload="showReupload"
        :show-resave="showResave"
        :upload-token="uploadToken.uploadToken.value"
        :format-file-size="upload.formatFileSize"
        @file-selected="handleFileSelected"
        @start-upload="handleStartUpload"
        @reupload="handleReupload"
        @resave="handleResave"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import StatusMessage from './components/StatusMessage.vue'
import UserPanel from './components/UserPanel.vue'
import VideoInfo from './components/VideoInfo.vue'
import FileUpload from './components/FileUpload.vue'
import { useAuth } from './composables/useAuth'
import { useVideoInfo } from './composables/useVideoInfo'
import { useUpload } from './composables/useUpload'
import { useUploadToken } from './composables/useUploadToken'
import { useNotification } from './composables/useNotification'

// 初始化所有 composables
const auth = useAuth()
const video = useVideoInfo()
const upload = useUpload()
const uploadToken = useUploadToken()
const notification = useNotification()

const showReupload = ref(false)
const showResave = ref(false)
const fileUploadRef = ref(null)
const currentFile = ref(null)
const currentUploadType = ref('video')
const uploadedFileInfo = ref(null) // 保存已上传文件的信息

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
  auth.logout()
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

// 文件选择后获取上传令牌
const handleFileSelected = async (file, uploadType, errorMessage) => {
  if (errorMessage) {
    notification.showStatus(errorMessage, 'error')
    uploadToken.clearToken()
    return
  }

  if (!file) {
    uploadToken.clearToken()
    return
  }

  // 保存文件和上传类型
  currentFile.value = file
  currentUploadType.value = uploadType

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

  try {
    notification.showStatus('正在获取上传令牌...', 'uploading')

    // 获取上传令牌
    await uploadToken.getUploadToken(
      uploadType,
      file.type,
      file.name,
      file.size
    )

    notification.showStatus('上传令牌获取成功，点击开始上传按钮上传文件', 'success')
  } catch (error) {
    // 检查是否是服务器错误
    let errorMessage = '获取上传令牌失败'
    if (error.message.includes('500')) {
      errorMessage = '服务器繁忙，请稍后再试'
    } else if (error.message) {
      errorMessage = `获取上传令牌失败: ${error.message}`
    }

    notification.showStatus(errorMessage, 'error')

    // 清除令牌和已选择的文件，让用户可以重新选择
    uploadToken.clearToken()
    fileUploadRef.value?.resetFile()
    currentFile.value = null
  }
}

// 开始上传
const handleStartUpload = async (file, uploadType) => {
  if (!file || !uploadToken.uploadToken.value) {
    notification.showStatus('请先选择文件', 'error')
    return
  }

  showReupload.value = false
  showResave.value = false
  notification.hideStatus()

  try {
    // 使用上传令牌中的 upload_url 上传文件
    const uploadResponse = await upload.uploadFile(
      file,
      uploadToken.uploadToken.value.upload_url,
      (msg, type) => {
        notification.showStatus(msg, type)
      }
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
    // 文件上传失败,显示重新上传按钮
    console.error('文件上传失败:', error)
    showReupload.value = true
    uploadedFileInfo.value = null
  }
}

// 保存已上传的文件信息到服务器
const saveUploadedFile = async () => {
  try {
    notification.showStatus('正在保存上传结果...', 'uploading')

    const videoId = video.videoId.value.trim()
    const match = videoId.match(/^(vl|ve)-(\d+)$/)
    const itemType = match[1]
    const itemId = match[2]

    const saveResult = await uploadToken.saveUploadResult(
      uploadedFileInfo.value.fileId,
      itemType,
      itemId
    )

    // 构建保存成功消息,包含上传信息和胡萝卜奖励
    let saveSuccessMessage = `保存成功！这是您上传的第 ${saveResult.count} 个资源`
    if (saveResult.radish && saveResult.radish > 0) {
      saveSuccessMessage += `,恭喜您获得 ${saveResult.radish} 个胡萝卜！`
    }

    notification.showStatus(saveSuccessMessage, 'success')
    showReupload.value = false
    showResave.value = false

    // 清除令牌和文件
    uploadToken.clearToken()
    fileUploadRef.value?.resetFile()
    currentFile.value = null
    uploadedFileInfo.value = null
  } catch (error) {
    // 保存失败,显示重新保存按钮
    console.error('保存上传结果失败:', error)
    notification.showStatus(`保存失败: ${error.message}`, 'error')
    showResave.value = true
    showReupload.value = false
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
      }
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

// 处理登录回调后显示成功消息
const loginCallbackHandled = auth.handleLoginCallback()
if (loginCallbackHandled) {
  notification.showStatus('登录成功！', 'success')
}
</script>
