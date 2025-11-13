import { ref } from 'vue'
import { BASE_URL } from '../config'

export function useVideoInfo() {
  const videoId = ref('')
  const videoInfo = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const isValid = ref(false)
  const fileStorage = ref('default') // 默认存储位置

  // 验证视频 ID 格式
  const validateVideoId = (value) => {
    const pattern = /^(vl|ve)-\d+$/
    return pattern.test(value)
  }

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // 获取视频信息
  const fetchVideoInfo = async () => {
    const id = videoId.value.trim()

    if (!id) {
      error.value = '请先输入视频 ID'
      return false
    }

    if (!validateVideoId(id)) {
      error.value = '视频 ID 格式不正确'
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      // 解析视频 ID，提取 item_type 和 item_id
      const match = id.match(/^(vl|ve)-(\d+)$/)
      if (!match) {
        throw new Error('视频 ID 格式错误')
      }

      const item_type = match[1]
      const item_id = match[2]

      const apiUrl = `${BASE_URL}/api/upload/video/base?item_type=${item_type}&item_id=${item_id}`

      // 从 sessionStorage 获取 token
      const token = sessionStorage.getItem('token')
      if (!token) {
        throw new Error('未找到认证令牌，请重新登录')
      }

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      videoInfo.value = data

      console.log('视频信息:', data)
      return true
    } catch (err) {
      error.value = err.message
      console.error('获取视频信息失败:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 更新验证状态
  const updateValidation = (value) => {
    if (value === '') {
      isValid.value = false
      error.value = null
    } else if (validateVideoId(value)) {
      isValid.value = true
      error.value = null
    } else {
      isValid.value = false
      // 不设置 error，只通过 isValid 来标记验证状态
    }
  }

  return {
    videoId,
    videoInfo,
    isLoading,
    error,
    isValid,
    fileStorage,
    validateVideoId,
    fetchVideoInfo,
    updateValidation,
    formatFileSize
  }
}
