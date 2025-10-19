import { ref } from 'vue'
import { BASE_URL, RECOGNITION_API_URL, RECOGNITION_API_TOKEN } from '../config.js'

// 企业级缓存配置
const CACHE_CONFIG = {
  MAX_SIZE: 100,           // 最大缓存条目数
  TTL: 30 * 60 * 1000,    // 缓存过期时间：30分钟
  STORAGE_KEY: 'video_item_cache', // localStorage存储键
  VERSION: '1.0'           // 缓存版本号，用于清理旧版本缓存
}

export function useFileRecognition() {
  // 识别缓存：缓存同一剧的识别结果，避免重复请求
  const recognitionCache = ref(new Map())
  const itemIdCache = ref(new Map())

  /**
   * 初始化缓存：从 localStorage 加载
   */
  const initCache = () => {
    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY)
      if (stored) {
        const { version, data, timestamp } = JSON.parse(stored)

        // 检查版本号
        if (version !== CACHE_CONFIG.VERSION) {
          console.log('缓存版本不匹配，清除旧缓存')
          localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY)
          return
        }

        // 加载未过期的缓存
        const now = Date.now()
        let loadedCount = 0

        data.forEach(([key, value]) => {
          const { data: cacheData, expireAt } = value
          if (expireAt > now) {
            itemIdCache.value.set(key, cacheData)
            loadedCount++
          }
        })

        console.log(`从本地加载了 ${loadedCount} 条缓存`)
      }
    } catch (error) {
      console.error('加载缓存失败:', error)
      localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY)
    }
  }

  /**
   * 持久化缓存到 localStorage
   */
  const persistCache = () => {
    try {
      const now = Date.now()
      const validEntries = []

      // 只保存未过期的条目
      itemIdCache.value.forEach((value, key) => {
        if (value.expireAt > now) {
          validEntries.push([key, value])
        }
      })

      // 限制缓存大小，保留最新的条目
      const entriesToSave = validEntries.slice(-CACHE_CONFIG.MAX_SIZE)

      const cacheData = {
        version: CACHE_CONFIG.VERSION,
        timestamp: now,
        data: entriesToSave
      }

      localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cacheData))
      console.log(`持久化了 ${entriesToSave.length} 条缓存`)
    } catch (error) {
      console.error('持久化缓存失败:', error)
      // localStorage 可能已满，清理缓存
      if (error.name === 'QuotaExceededError') {
        localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY)
      }
    }
  }

  /**
   * 清理过期缓存
   */
  const cleanExpiredCache = () => {
    const now = Date.now()
    let cleanedCount = 0

    itemIdCache.value.forEach((value, key) => {
      if (value.expireAt <= now) {
        itemIdCache.value.delete(key)
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 条过期缓存`)
      persistCache()
    }
  }

  /**
   * 获取缓存大小
   */
  const getCacheSize = () => {
    return itemIdCache.value.size
  }

  /**
   * 识别单个文件名
   * @param {string} fileName - 文件名
   * @returns {Promise<Object>} - 识别结果
   */
  const recognizeFile = async (fileName) => {
    try {
      const apiUrl = `${RECOGNITION_API_URL}/api/v1/media/recognize_file2?path=${encodeURIComponent(fileName)}&token=${RECOGNITION_API_TOKEN}`

      const response = await fetch(apiUrl, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`识别失败: HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log(`识别文件 ${fileName}:`, data)

      return data
    } catch (error) {
      console.error(`识别文件失败 (${fileName}):`, error)
      throw error
    }
  }

  /**
   * 根据识别结果获取视频ItemId
   * @param {Object} recognitionData - 识别结果数据
   * @param {string} token - 用户token
   * @returns {Promise<Object>} - ItemId结果
   */
  const getVideoItemId = async (recognitionData, token) => {
    try {
      const { media_info, meta_info } = recognitionData

      if (!media_info || !media_info.tmdb_id) {
        throw new Error('识别结果中没有tmdb_id')
      }

      // 根据type判断是电影还是电视剧
      const type = media_info.type === '电影' ? 'movie' : 'tv'
      const title = media_info.title || meta_info.name
      const tmdb_id = media_info.tmdb_id

      // 检查缓存
      const cacheKey = `${type}_${tmdb_id}`
      const cachedData = itemIdCache.value.get(cacheKey)

      if (cachedData) {
        // 检查是否过期
        if (cachedData.expireAt > Date.now()) {
          console.log(`使用缓存的ItemId数据: ${cacheKey}`)
          return cachedData.data
        } else {
          // 过期缓存自动删除
          itemIdCache.value.delete(cacheKey)
          console.log(`缓存已过期: ${cacheKey}`)
        }
      }

      // 构造请求URL
      const params = new URLSearchParams({
        type,
        title,
        tmdb_id: tmdb_id.toString()
      })

      const apiUrl = `${BASE_URL}/api/video/getItemId?${params.toString()}`

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`获取ItemId失败: HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log(`获取ItemId成功 (${title}):`, data)

      // 缓存结果，带过期时间
      const now = Date.now()
      itemIdCache.value.set(cacheKey, {
        data,
        expireAt: now + CACHE_CONFIG.TTL,
        createdAt: now
      })

      // 检查缓存大小，超过限制时清理最旧的
      if (itemIdCache.value.size > CACHE_CONFIG.MAX_SIZE) {
        const oldestKey = itemIdCache.value.keys().next().value
        itemIdCache.value.delete(oldestKey)
        console.log(`缓存已满，删除最旧条目: ${oldestKey}`)
      }

      // 持久化到 localStorage
      persistCache()

      return data
    } catch (error) {
      console.error('获取ItemId失败:', error)
      throw error
    }
  }

  /**
   * 根据识别和ItemId数据生成videoId
   * @param {Object} recognitionData - 识别结果
   * @param {Array} itemIdData - ItemId数据
   * @returns {string|null} - 生成的videoId (如 "ve-123" 或 "vl-456")
   */
  const generateVideoId = (recognitionData, itemIdData) => {
    try {
      const { media_info, meta_info } = recognitionData

      // 电影类型
      if (media_info.type === '电影') {
        const movieData = itemIdData.find(item => item.video_type === 'movie')
        if (movieData && movieData.item_id) {
          return `vl-${movieData.item_id}`
        }
      }

      // 电视剧类型
      if (media_info.type === '电视剧') {
        const tvData = itemIdData.find(item => item.video_type === 'tv')
        if (!tvData || !tvData.seasons) {
          throw new Error('未找到电视剧季信息')
        }

        // 获取季数和集数
        const seasonNumber = meta_info.begin_season || 1
        const episodeNumber = meta_info.begin_episode

        if (!episodeNumber) {
          throw new Error('未识别到集数')
        }

        // 查找对应的季
        const season = tvData.seasons.find(s => s.season_number === seasonNumber)
        if (!season) {
          throw new Error(`未找到第 ${seasonNumber} 季`)
        }

        // 查找对应的集
        const episode = season.episodes.find(e => e.episode_number === episodeNumber)
        if (!episode) {
          throw new Error(`未找到 S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`)
        }

        return `ve-${episode.item_id}`
      }

      throw new Error('未知的视频类型')
    } catch (error) {
      console.error('生成VideoId失败:', error)
      return null
    }
  }

  /**
   * 识别文件并获取完整信息（包括videoId）
   * @param {File} file - 文件对象
   * @param {string} token - 用户token（用于getItemId接口）
   * @returns {Promise<Object>} - 包含识别结果和videoId的对象
   */
  const recognizeAndGetVideoId = async (file, token) => {
    try {
      // 1. 识别文件名（使用外部API固定token）
      const recognitionData = await recognizeFile(file.name)

      // 2. 获取ItemId（使用用户token）
      const itemIdData = await getVideoItemId(recognitionData, token)

      // 3. 生成videoId
      const videoId = generateVideoId(recognitionData, itemIdData)

      if (!videoId) {
        throw new Error('无法生成videoId')
      }

      return {
        file,
        fileName: file.name,
        videoId,
        recognitionData,
        itemIdData,
        title: recognitionData.media_info.title,
        type: recognitionData.media_info.type,
        season: recognitionData.meta_info.begin_season,
        episode: recognitionData.meta_info.begin_episode
      }
    } catch (error) {
      console.error(`识别文件失败 (${file.name}):`, error)
      throw error
    }
  }

  /**
   * 批量识别文件夹中的文件
   * @param {FileList} files - 文件列表
   * @param {string} token - 用户token
   * @param {Function} onProgress - 进度回调 (current, total, result)
   * @returns {Promise<Array>} - 识别成功的文件列表
   */
  const recognizeFiles = async (files, token, onProgress = null) => {
    // 初始化缓存
    initCache()

    // 清理过期缓存
    cleanExpiredCache()

    const results = []
    const errors = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const result = await recognizeAndGetVideoId(file, token)
        results.push(result)

        if (onProgress) {
          onProgress(i + 1, files.length, { success: true, result })
        }
      } catch (error) {
        errors.push({
          file,
          fileName: file.name,
          error: error.message
        })

        if (onProgress) {
          onProgress(i + 1, files.length, { success: false, error: error.message, fileName: file.name })
        }
      }
    }

    console.log(`识别完成: ${results.length} 成功, ${errors.length} 失败`)
    console.log(`当前缓存大小: ${getCacheSize()} 条`)
    if (errors.length > 0) {
      console.log('失败列表:', errors)
    }

    return {
      success: results,
      errors
    }
  }

  /**
   * 清除缓存
   */
  const clearCache = () => {
    recognitionCache.value.clear()
    itemIdCache.value.clear()
    localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY)
    console.log('缓存已清除')
  }

  // 页面加载时初始化缓存
  initCache()

  return {
    recognizeFile,
    getVideoItemId,
    generateVideoId,
    recognizeAndGetVideoId,
    recognizeFiles,
    clearCache,
    getCacheSize,
    cleanExpiredCache,
    recognitionCache,
    itemIdCache
  }
}
