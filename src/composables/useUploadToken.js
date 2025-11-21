import { ref } from 'vue'
import { BASE_URL } from '../config'

export function useUploadToken() {
  const uploadToken = ref(null)
  const isGettingToken = ref(false)
  const tokenError = ref(null)

  // 获取上传令牌
  const getUploadToken = async (type, fileType, fileName, fileSize, fileStorage = 'default') => {
    isGettingToken.value = true
    tokenError.value = null

    try {
      const apiUrl = `${BASE_URL}/api/upload/getUploadToken`

      // 从 sessionStorage 获取 token
      const token = sessionStorage.getItem('token')
      if (!token) {
        throw new Error('未找到认证令牌，请重新登录')
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: type,               // video/subtitle/cover
          file_type: fileType,      // MIME type
          file_name: fileName,      // name with extension
          file_size: fileSize,      // file size in bytes
          file_storage: fileStorage // default/internal/global
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // 保存令牌信息
      uploadToken.value = {
        type: data.type,
        file_id: data.file_id,
        upload_url: data.data.upload_url
      }

      console.log('获取上传令牌成功:', uploadToken.value)
      return uploadToken.value
    } catch (err) {
      tokenError.value = err.message
      console.error('获取上传令牌失败:', err)
      throw err
    } finally {
      isGettingToken.value = false
    }
  }

  // 保存上传结果（带自动重试和进度回调）
  const saveUploadResult = async (fileId, itemType, itemId, onRetry = null, maxRetries = 5, retryDelay = 10000) => {
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const apiUrl = `${BASE_URL}/api/upload/video/save`

        // 从 sessionStorage 获取 token
        const token = sessionStorage.getItem('token')
        if (!token) {
          throw new Error('未找到认证令牌，请重新登录')
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            file_id: fileId,
            item_type: itemType,
            item_id: itemId
          })
        })

        // 尝试解析 JSON 响应
        const data = await response.json()

        if (!response.ok) {
          // 如果是 422 错误且提示"视频正在合并中"，则自动重试
          if (response.status === 422 && data.message && data.message.includes('视频正在合并中')) {
            lastError = new Error(data.message)
            console.log(`第 ${attempt}/${maxRetries} 次保存失败: ${data.message}，${retryDelay/1000}秒后重试...`)

            // 通知重试进度
            if (onRetry) {
              onRetry(attempt, maxRetries, retryDelay / 1000)
            }

            // 如果还有重试次数，等待后继续
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            }
          }

          // 其他错误直接抛出
          const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`
          throw new Error(errorMessage)
        }

        console.log('保存上传结果成功:', data)
        return data
      } catch (err) {
        lastError = err

        // 如果不是422错误或者是最后一次尝试，直接抛出错误
        if (!err.message.includes('视频正在合并中') || attempt === maxRetries) {
          console.error('保存上传结果失败:', err)
          throw err
        }
      }
    }

    // 如果所有重试都失败了，抛出最后一个错误
    throw lastError
  }

  // 清除令牌
  const clearToken = () => {
    uploadToken.value = null
    tokenError.value = null
  }

  return {
    uploadToken,
    isGettingToken,
    tokenError,
    getUploadToken,
    saveUploadResult,
    clearToken
  }
}
