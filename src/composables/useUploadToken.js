import { ref } from 'vue'
import { BASE_URL } from '../config'

export function useUploadToken() {
  const uploadToken = ref(null)
  const isGettingToken = ref(false)
  const tokenError = ref(null)

  // 获取上传令牌
  const getUploadToken = async (type, fileType, fileName, fileSize) => {
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
          type: type,           // video/subtitle/cover
          file_type: fileType,  // MIME type
          file_name: fileName,  // name with extension
          file_size: fileSize   // file size in bytes
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

  // 保存上传结果
  const saveUploadResult = async (fileId, itemType, itemId) => {
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
        // 如果响应中包含 message 字段，使用它作为错误消息
        const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errorMessage)
      }

      console.log('保存上传结果成功:', data)
      return data
    } catch (err) {
      console.error('保存上传结果失败:', err)
      throw err
    }
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
