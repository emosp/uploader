<template>
  <div class="folder-upload bg-white p-3 sm:p-4 rounded-lg border-2 border-gray-300">
    <!-- 文件夹选择区域 -->
    <div class="mb-3 sm:mb-4">
      <!-- 文件夹选择（桌面端） -->
      <input
        ref="folderInput"
        type="file"
        webkitdirectory
        directory
        multiple
        accept="video/*"
        @change="handleFolderSelect"
        class="hidden"
      />

      <!-- 文件多选（移动端兼容） -->
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="video/*,.mp4,.mkv,.avi,.mov,.wmv,.flv,.webm,.m4v,.ts"
        @change="handleFileSelect"
        class="hidden"
      />

      <!-- 按钮组 -->
      <div class="flex gap-2">
        <button
          @click="selectFolder"
          :disabled="isRecognizing"
          class="flex-1 px-4 py-3 text-sm gradient-theme text-white rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!isRecognizing">选择文件夹</span>
          <span v-else>识别中...</span>
        </button>

        <button
          @click="selectFiles"
          :disabled="isRecognizing"
          class="flex-1 px-4 py-3 text-sm bg-teal-500 text-white rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          选择文件
        </button>
      </div>
    </div>

    <!-- 识别进度 -->
    <div v-if="isRecognizing" class="mb-3 sm:mb-4">
      <div class="flex justify-between text-xs text-gray-600 mb-1">
        <span>识别进度</span>
        <span>{{ recognitionProgress.current }} / {{ recognitionProgress.total }}</span>
      </div>
      <div class="w-full h-2 bg-gray-300 rounded overflow-hidden">
        <div
          class="gradient-theme-h h-full transition-all duration-300"
          :style="{ width: recognitionProgressPercent + '%' }"
        ></div>
      </div>
      <div v-if="currentRecognizingFile" class="text-xs text-gray-500 mt-1 truncate">
        当前: {{ currentRecognizingFile }}
      </div>
    </div>

    <!-- 识别结果列表 -->
    <div v-if="recognitionResult && (recognitionResult.success.length > 0 || recognitionResult.errors.length > 0)" class="mt-3 sm:mt-4">
      <!-- 移动端头部 -->
      <div class="flex sm:hidden items-center justify-between gap-2 mb-3">
        <!-- 左侧标题 -->
        <div class="flex-1 min-w-0">
          <h3 class="text-gray-800 font-medium mb-0.5 text-xs">识别结果</h3>
          <div class="text-[10px] text-gray-500 leading-tight">
            <span class="text-green-600">{{ recognitionResult.success.length }} 成功</span>
            <span v-if="recognitionResult.errors.length > 0" class="text-red-600 ml-1">{{ recognitionResult.errors.length }} 失败</span>
          </div>
        </div>
        <!-- 右侧按钮 -->
        <div class="flex gap-1.5 shrink-0">
          <button
            @click="resetRecognition"
            class="px-2 py-1.5 text-[10px] bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors active:scale-95 whitespace-nowrap"
          >
            重新选择
          </button>
          <button
            v-if="recognitionResult.success.length > 0"
            @click="addToQueue"
            class="px-2 py-1.5 text-[10px] gradient-theme text-white rounded-lg hover:shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            添加到队列
          </button>
        </div>
      </div>

      <!-- 桌面端头部 -->
      <div class="hidden sm:flex sm:items-center justify-between gap-3 mb-3">
        <h3 class="text-gray-800 font-medium text-sm">
          识别结果
          <span class="text-xs text-gray-500 ml-2">
            (<span class="text-green-600">{{ recognitionResult.success.length }} 成功</span><span v-if="recognitionResult.errors.length > 0" class="text-red-600">, {{ recognitionResult.errors.length }} 失败</span>)
          </span>
        </h3>
        <div class="flex gap-2">
          <button
            @click="resetRecognition"
            class="px-2.5 sm:px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            重新选择
          </button>
          <button
            v-if="recognitionResult.success.length > 0"
            @click="addToQueue"
            class="px-2.5 sm:px-3 py-1.5 text-xs gradient-theme text-white rounded-lg hover:shadow-md transition-all"
          >
            添加到队列
          </button>
        </div>
      </div>

      <!-- 成功的文件列表 -->
      <div class="space-y-3 mb-3">
        <div
          v-for="(item, index) in recognitionResult.success"
          :key="'success-' + index"
          class="bg-white border-2 border-gray-300 rounded-lg p-2.5 sm:p-3"
        >
          <!-- 移动端布局 -->
          <div class="block sm:hidden">
            <!-- 第一行：文件名 -->
            <div class="mb-2">
              <span class="font-medium text-gray-800 text-sm block truncate">{{ item.fileName }}</span>
            </div>

            <!-- 第二行：视频ID、视频名称 -->
            <div class="text-[10px] text-gray-500 mb-2 leading-relaxed">
              <span>{{ item.videoId }}</span>
              <span class="mx-1">·</span>
              <span>{{ item.displayTitle }}</span>
            </div>

            <!-- 第三行：操作按钮 -->
            <div class="flex items-center justify-end gap-1.5">
              <button
                @click="openEditModal(index, 'success')"
                class="px-2.5 py-1 text-xs gradient-theme text-white rounded hover:shadow-md transition-all"
              >
                获取
              </button>
              <button
                @click="removeRecognitionItem(index, 'success')"
                class="px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </div>
          </div>

          <!-- 桌面端布局 -->
          <div class="hidden sm:flex sm:items-center">
            <!-- 左侧：文件信息 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="font-medium text-gray-800 truncate text-sm">{{ item.fileName }}</span>
              </div>
              <div class="text-xs text-gray-500">
                <span>{{ item.videoId }}</span>
                <span class="mx-1.5">·</span>
                <span class="truncate">{{ item.displayTitle }}</span>
              </div>
            </div>

            <!-- 右侧：操作按钮 -->
            <div class="flex-shrink-0 flex flex-col gap-1.5 ml-3">
              <button
                @click="openEditModal(index, 'success')"
                class="px-3 py-1 text-xs gradient-theme text-white rounded hover:shadow-md transition-all"
              >
                获取
              </button>
              <button
                @click="removeRecognitionItem(index, 'success')"
                class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </div>
          </div>
        </div>

        <!-- 失败的文件列表 -->
        <div
          v-for="(item, index) in recognitionResult.errors"
          :key="'error-' + index"
          class="bg-white border-2 border-red-300 rounded-lg p-2.5 sm:p-3"
        >
          <!-- 移动端布局 -->
          <div class="block sm:hidden">
            <!-- 第一行：文件名 -->
            <div class="mb-2">
              <span class="font-medium text-gray-800 text-sm block truncate">{{ item.fileName }}</span>
            </div>

            <!-- 第二行：错误信息 -->
            <div class="text-[10px] text-red-600 mb-2 leading-relaxed">
              {{ item.error }}
            </div>

            <!-- 第三行：操作按钮 -->
            <div class="flex items-center justify-end gap-1.5">
              <button
                @click="openEditModal(index, 'error')"
                class="px-2.5 py-1 text-xs gradient-theme text-white rounded hover:shadow-md transition-all"
              >
                获取
              </button>
              <button
                @click="removeRecognitionItem(index, 'error')"
                class="px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </div>
          </div>

          <!-- 桌面端布局 -->
          <div class="hidden sm:flex sm:items-center">
            <!-- 左侧：文件信息 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="font-medium text-gray-800 truncate text-sm">{{ item.fileName }}</span>
              </div>
              <div class="text-xs text-red-600">
                {{ item.error }}
              </div>
            </div>

            <!-- 右侧：操作按钮 -->
            <div class="flex-shrink-0 flex flex-col gap-1.5 ml-3">
              <button
                @click="openEditModal(index, 'error')"
                class="px-3 py-1 text-xs gradient-theme text-white rounded hover:shadow-md transition-all"
              >
                获取
              </button>
              <button
                @click="removeRecognitionItem(index, 'error')"
                class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 手动获取视频ID模态框 -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeEditModal"
    >
      <div class="bg-white rounded-xl shadow-2xl p-4 sm:p-6 max-w-md w-full relative">
        <!-- 关闭按钮 -->
        <button
          @click="closeEditModal"
          class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-gray-800 font-bold text-lg mb-4 pr-8">手动获取视频信息</h3>

        <!-- 当前文件名 -->
        <div class="mb-4">
          <div class="text-xs text-gray-500 mb-1">文件名</div>
          <div class="text-sm text-gray-800 break-all">{{ editingItem?.fileName }}</div>
        </div>

        <!-- 视频ID输入 -->
        <div class="mb-4">
          <label class="block text-sm text-gray-700 mb-2">视频 ID</label>
          <input
            v-model="editVideoId"
            type="text"
            placeholder="请输入视频 ID (如: vl-123 或 ve-456)"
            :class="[
              'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
              editVideoIdValid ? 'border-green-500' : 'border-gray-300'
            ]"
            @input="validateEditVideoId"
          />
          <div v-if="editVideoIdError" class="text-xs text-red-600 mt-1">
            {{ editVideoIdError }}
          </div>
        </div>

        <!-- 获取的视频信息 -->
        <div v-if="editVideoInfo" class="mb-4 p-3 bg-gray-50 rounded-lg">
          <div class="text-xs text-gray-500 mb-1">视频信息</div>
          <div class="text-sm text-gray-800 font-medium">{{ editVideoInfo.title }}</div>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingVideoInfo" class="mb-4 text-center text-sm text-gray-600">
          正在获取视频信息...
        </div>

        <!-- 按钮组 -->
        <div class="flex gap-3">
          <button
            @click="fetchEditVideoInfo"
            :disabled="!editVideoIdValid || isLoadingVideoInfo"
            class="flex-1 px-4 py-2 text-sm gradient-theme text-white rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoadingVideoInfo ? '获取中...' : '获取' }}
          </button>
          <button
            @click="saveEditVideoInfo"
            :disabled="!editVideoInfo"
            class="flex-1 px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFileRecognition } from '../composables/useFileRecognition.js'
import { BASE_URL } from '../config.js'

const emit = defineEmits(['add-to-queue', 'recognition-error'])

// 文件夹选择器引用
const folderInput = ref(null)
const fileInput = ref(null)

// 识别状态
const isRecognizing = ref(false)
const recognitionProgress = ref({ current: 0, total: 0 })
const currentRecognizingFile = ref('')
const recognitionResult = ref(null)

// 使用识别功能
const { recognizeFiles } = useFileRecognition()

// 模态框状态
const showEditModal = ref(false)
const editingIndex = ref(null)
const editingType = ref(null) // 'success' or 'error'
const editingItem = ref(null)
const editVideoId = ref('')
const editVideoIdValid = ref(false)
const editVideoIdError = ref('')
const editVideoInfo = ref(null)
const isLoadingVideoInfo = ref(false)

// 识别进度百分比
const recognitionProgressPercent = computed(() => {
  if (recognitionProgress.value.total === 0) return 0
  return Math.round((recognitionProgress.value.current / recognitionProgress.value.total) * 100)
})

// 选择文件夹
const selectFolder = () => {
  if (folderInput.value) {
    folderInput.value.click()
  }
}

// 选择文件
const selectFiles = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// 处理文件夹选择
const handleFolderSelect = async (event) => {
  const files = event.target.files

  if (!files || files.length === 0) {
    return
  }

  // 过滤视频文件
  const videoFiles = Array.from(files).filter(file => {
    return file.type.startsWith('video/') ||
           /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|ts)$/i.test(file.name)
  })

  if (videoFiles.length === 0) {
    emit('recognition-error', '未找到视频文件')
    return
  }

  // 开始识别
  await startRecognition(videoFiles)

  // 清空input，允许重新选择同一文件夹
  event.target.value = ''
}

// 处理文件多选
const handleFileSelect = async (event) => {
  const files = event.target.files

  if (!files || files.length === 0) {
    return
  }

  // 转换为数组
  const videoFiles = Array.from(files)

  if (videoFiles.length === 0) {
    emit('recognition-error', '请选择视频文件')
    return
  }

  // 开始识别
  await startRecognition(videoFiles)

  // 清空input，允许重新选择
  event.target.value = ''
}

// 开始识别
const startRecognition = async (files) => {
  isRecognizing.value = true
  recognitionProgress.value = { current: 0, total: files.length }
  currentRecognizingFile.value = ''
  recognitionResult.value = null

  const token = sessionStorage.getItem('token')
  if (!token) {
    emit('recognition-error', '未登录，请先登录')
    isRecognizing.value = false
    return
  }

  try {
    const result = await recognizeFiles(files, token, (current, total, progressResult) => {
      recognitionProgress.value = { current, total }

      if (progressResult.success) {
        const result = progressResult.result
        const { title, type, season, episode } = result

        // 构建显示文本
        let displayText = `✓ ${title}`
        if (type === '电视剧' && season && episode) {
          displayText += ` - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
        }
        currentRecognizingFile.value = displayText
      } else {
        currentRecognizingFile.value = `✗ ${progressResult.fileName}`
      }
    })

    // 为每个成功的项添加 displayTitle 字段用于编辑
    result.success.forEach(item => {
      let displayTitle = item.title
      if (item.type === '电视剧' && item.season != null && item.episode != null) {
        const seasonEpisode = `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
        if (displayTitle.trim().endsWith('-')) {
          displayTitle = `${displayTitle.trim()} ${seasonEpisode}`
        } else {
          displayTitle += ` - ${seasonEpisode}`
        }
      }
      item.displayTitle = displayTitle
    })

    recognitionResult.value = result
  } catch (error) {
    console.error('识别过程出错:', error)
    emit('recognition-error', `识别失败: ${error.message}`)
  } finally {
    isRecognizing.value = false
    currentRecognizingFile.value = ''
  }
}

// 添加到队列
const addToQueue = () => {
  if (recognitionResult.value && recognitionResult.value.success.length > 0) {
    emit('add-to-queue', recognitionResult.value.success)
    resetRecognition()
  }
}

// 移除识别结果中的某一项
const removeRecognitionItem = (index, type) => {
  if (type === 'success') {
    recognitionResult.value.success.splice(index, 1)
  } else {
    recognitionResult.value.errors.splice(index, 1)
  }

  // 如果没有成功项和失败项了，重置整个识别结果
  if (recognitionResult.value.success.length === 0 && recognitionResult.value.errors.length === 0) {
    resetRecognition()
  }
}

// 重置识别状态
const resetRecognition = () => {
  recognitionResult.value = null
  recognitionProgress.value = { current: 0, total: 0 }
  currentRecognizingFile.value = ''
}

// ========== 手动获取视频ID功能 ==========

// 打开编辑模态框
const openEditModal = (index, type) => {
  editingIndex.value = index
  editingType.value = type

  if (type === 'success') {
    // 编辑成功项
    editingItem.value = recognitionResult.value.success[index]
    editVideoId.value = editingItem.value.videoId || ''
  } else {
    // 编辑失败项，创建一个基础对象
    const errorItem = recognitionResult.value.errors[index]
    editingItem.value = {
      fileName: errorItem.fileName,
      file: errorItem.file || null
    }
    editVideoId.value = ''
  }

  editVideoIdValid.value = false
  editVideoIdError.value = ''
  editVideoInfo.value = null
  showEditModal.value = true

  // 如果有videoId，自动验证
  if (editVideoId.value) {
    validateEditVideoId()
  }
}

// 关闭编辑模态框
const closeEditModal = () => {
  showEditModal.value = false
  editingIndex.value = null
  editingType.value = null
  editingItem.value = null
  editVideoId.value = ''
  editVideoIdValid.value = false
  editVideoIdError.value = ''
  editVideoInfo.value = null
}

// 验证视频ID格式
const validateEditVideoId = () => {
  const value = editVideoId.value.trim()

  if (!value) {
    editVideoIdValid.value = false
    editVideoIdError.value = ''
    return
  }

  const regex = /^(vl|ve)-(\d+)$/
  if (regex.test(value)) {
    editVideoIdValid.value = true
    editVideoIdError.value = ''
  } else {
    editVideoIdValid.value = false
    editVideoIdError.value = '视频 ID 格式不正确，必须以 vl- 或 ve- 开头，后跟正整数'
  }
}

// 获取视频信息
const fetchEditVideoInfo = async () => {
  if (!editVideoIdValid.value) return

  const videoId = editVideoId.value.trim()
  const match = videoId.match(/^(vl|ve)-(\d+)$/)
  const itemType = match[1]
  const itemId = match[2]

  isLoadingVideoInfo.value = true
  editVideoInfo.value = null

  try {
    const token = sessionStorage.getItem('token')
    if (!token) {
      emit('recognition-error', '未登录，请先登录')
      closeEditModal()
      return
    }

    const apiUrl = `${BASE_URL}/api/upload/video/base?item_type=${itemType}&item_id=${itemId}`
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error(`获取失败: HTTP ${response.status}`)
    }

    const data = await response.json()
    editVideoInfo.value = data
  } catch (error) {
    console.error('获取视频信息失败:', error)
    emit('recognition-error', `获取视频信息失败: ${error.message}`)
  } finally {
    isLoadingVideoInfo.value = false
  }
}

// 保存修改后的视频信息
const saveEditVideoInfo = () => {
  if (!editVideoInfo.value || editingIndex.value === null) return

  // 构建新的成功项
  const newItem = {
    file: editingItem.value.file,
    fileName: editingItem.value.fileName,
    videoId: editVideoId.value.trim(),
    displayTitle: editVideoInfo.value.title,
    title: editVideoInfo.value.title,
    recognitionData: null, // 手动获取的没有识别数据
    itemIdData: null
  }

  // 从title中提取season和episode信息（如果是电视剧）
  if (editVideoInfo.value.season_number && editVideoInfo.value.episode_number) {
    const seasonMatch = editVideoInfo.value.season_number.match(/S(\d+)/)
    const episodeMatch = editVideoInfo.value.episode_number.match(/E(\d+)/)
    if (seasonMatch) newItem.season = parseInt(seasonMatch[1])
    if (episodeMatch) newItem.episode = parseInt(episodeMatch[1])
    newItem.type = '电视剧'
  } else {
    newItem.type = '电影'
  }

  if (editingType.value === 'success') {
    // 更新成功列表中的项
    recognitionResult.value.success[editingIndex.value] = newItem
  } else {
    // 从错误列表中移除，添加到成功列表
    recognitionResult.value.errors.splice(editingIndex.value, 1)
    recognitionResult.value.success.push(newItem)
  }

  closeEditModal()
}
</script>

<style scoped>
/* 自定义details样式 */
details > summary {
  list-style: none;
}

details > summary::-webkit-details-marker {
  display: none;
}

details[open] > summary::after {
  content: ' ▲';
}

details:not([open]) > summary::after {
  content: ' ▼';
}
</style>
