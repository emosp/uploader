<template>
  <div>
    <!-- 上传类型选择 -->
    <div v-if="!isUploading && !isSaving && !uploadSummaryInfo && !showResave" class="mb-3 sm:mb-4">
      <label class="block text-gray-800 font-medium mb-1.5 sm:mb-2 text-xs sm:text-sm">上传类型</label>

      <!-- 移动端布局 -->
      <div class="flex sm:hidden gap-2 flex-wrap">
        <button
          @click="uploadType = 'video'"
          :class="[
            'flex-1 min-w-[90px] px-2 py-2 rounded-lg text-[10px] font-medium transition-all duration-300 active:scale-95 flex flex-col items-center gap-1',
            uploadType === 'video'
              ? 'gradient-theme text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          ]"
        >
          <span class="text-base">📹</span>
          <span>视频</span>
        </button>
        <button
          disabled
          class="flex-1 min-w-[90px] px-2 py-2 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-400 cursor-not-allowed flex flex-col items-center gap-1"
        >
          <span class="text-base">📝</span>
          <span>字幕</span>
        </button>
        <button
          disabled
          class="flex-1 min-w-[90px] px-2 py-2 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-400 cursor-not-allowed flex flex-col items-center gap-1"
        >
          <span class="text-base">🖼️</span>
          <span>封面</span>
        </button>
      </div>

      <!-- 桌面端布局 -->
      <div class="hidden sm:flex gap-2 sm:gap-3">
        <button
          @click="uploadType = 'video'"
          :class="[
            'px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 active:scale-95',
            uploadType === 'video'
              ? 'gradient-theme text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          ]"
        >
          📹 视频
        </button>
        <button
          disabled
          class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          📝 字幕（即将开放）
        </button>
        <button
          disabled
          class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          🖼️ 封面（即将开放）
        </button>
      </div>
    </div>

    <!-- 上传区域 -->
    <div
      v-if="!isUploading && !isSaving && !uploadSummaryInfo && !showResave"
      :class="[
        'border-2 border-dashed border-teal-500 rounded-lg p-6 sm:p-8 lg:p-10 text-center transition-all duration-300 bg-teal-50',
        'cursor-pointer hover:border-teal-600 hover:bg-teal-100 active:bg-teal-200',
        { 'dragging': isDragging }
      ]"
      @click="handleClick()"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <div class="text-4xl sm:text-5xl mb-2 sm:mb-2.5">📁</div>
      <div class="text-teal-600 font-medium mb-1 text-sm sm:text-base">
        点击或拖拽文件到此处选择
      </div>
      <div class="text-gray-500 text-xs">
        {{ getAcceptHint() }}
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      :accept="getAcceptType()"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- 文件信息（上传和保存过程中都显示） -->
    <div v-if="selectedFile && !uploadSummaryInfo" class="file-info mt-3 sm:mt-4 lg:mt-5 p-3 sm:p-4 bg-gray-100 rounded-lg">
      <!-- 移动端布局 -->
      <div class="block sm:hidden">
        <div class="font-medium text-gray-800 mb-1.5 text-sm truncate">
          {{ selectedFile.name }}
        </div>
        <div class="text-[10px] text-gray-500 leading-relaxed">
          <span>{{ formatFileSize(selectedFile.size) }}</span>
          <span class="mx-1">·</span>
          <span>{{ getUploadTypeLabel() }}</span>
          <span v-if="videoId" class="mx-1">·</span>
          <span v-if="videoId">{{ videoId }}</span>
        </div>
      </div>

      <!-- 桌面端布局 -->
      <div class="hidden sm:block">
        <div class="font-medium text-gray-800 mb-1 text-sm sm:text-base">
          文件名: {{ selectedFile.name }}
        </div>
        <div class="text-gray-600 text-xs sm:text-sm mb-2">
          大小: {{ formatFileSize(selectedFile.size) }} | 类型: {{ getUploadTypeLabel() }}
        </div>
        <div class="text-gray-600 text-xs sm:text-sm" v-if="videoId">
          视频ID: {{ videoId }}
        </div>
      </div>
    </div>

    <!-- 进度条（上传过程中显示，保存期间和保存失败时隐藏） -->
    <div v-if="(isUploading || uploadProgress > 0) && !isSaving && !uploadSummaryInfo && !showResave" class="progress-container mt-3 sm:mt-4">
      <div class="w-full h-1.5 sm:h-2 bg-gray-300 rounded overflow-hidden mb-2 sm:mb-2.5">
        <div
          class="gradient-theme-h h-full transition-all duration-300"
          :style="{ width: uploadProgress + '%' }"
        ></div>
      </div>
      <!-- 移动端进度信息 -->
      <div class="flex sm:hidden justify-between text-[10px] text-gray-600">
        <span>{{ uploadProgress }}%</span>
        <div class="flex gap-1.5">
          <span v-if="uploadTimeRemaining">{{ uploadTimeRemaining }}</span>
          <span>{{ uploadSpeed }}</span>
        </div>
      </div>
      <!-- 桌面端进度信息 -->
      <div class="hidden sm:flex justify-between text-xs text-gray-600">
        <span>{{ uploadProgress }}%</span>
        <div class="flex gap-2 sm:gap-3">
          <span v-if="uploadTimeRemaining">剩余时间: {{ uploadTimeRemaining }}</span>
          <span>{{ uploadSpeed }}</span>
        </div>
      </div>
    </div>

    <!-- 上传信息面板 -->
    <UploadSummary
      :upload-info="uploadSummaryInfo"
      @continue-upload="$emit('continue-upload')"
    />

    <!-- 上传按钮 -->
    <button
      v-if="selectedFile && !isUploading && uploadProgress === 0 && !uploadSummaryInfo && !showReupload"
      @click="handleStartUpload"
      class="mt-3 sm:mt-4 w-full px-4 sm:px-6 py-2.5 sm:py-3 gradient-theme text-white rounded-lg text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all duration-300"
    >
      开始上传
    </button>

    <!-- 添加到队列按钮 -->
    <button
      v-if="selectedFile && !isUploading && uploadProgress === 0 && !uploadSummaryInfo && !showReupload && enableQueue"
      @click="handleAddToQueue"
      class="mt-2 w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all duration-300 hover:bg-blue-600"
    >
      添加到队列
    </button>

    <!-- 重新上传按钮 -->
    <button
      v-if="showReupload"
      @click="handleReupload"
      class="reupload-btn mt-3 sm:mt-4 w-full px-4 sm:px-6 py-2.5 sm:py-3 gradient-theme text-white rounded-lg text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all duration-300"
    >
      🔄 重新上传
    </button>

    <!-- 重新保存按钮 -->
    <button
      v-if="showResave"
      @click="handleResave"
      class="resave-btn mt-3 sm:mt-4 w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-orange-500 text-white rounded-lg text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all duration-300 hover:bg-orange-600"
    >
      💾 重新保存
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import UploadSummary from './UploadSummary.vue'

const props = defineProps({
  videoId: {
    type: String,
    default: ''
  },
  videoInfo: {
    type: Object,
    default: null
  },
  uploadProgress: {
    type: Number,
    default: 0
  },
  uploadSpeed: {
    type: String,
    default: ''
  },
  uploadTimeRemaining: {
    type: String,
    default: ''
  },
  isUploading: {
    type: Boolean,
    default: false
  },
  isSaving: {
    type: Boolean,
    default: false
  },
  showReupload: {
    type: Boolean,
    default: false
  },
  showResave: {
    type: Boolean,
    default: false
  },
  uploadToken: {
    type: Object,
    default: null
  },
  uploadSummaryInfo: {
    type: Object,
    default: null
  },
  formatFileSize: {
    type: Function,
    required: true
  },
  enableQueue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['fileSelected', 'startUpload', 'reupload', 'resave', 'continue-upload', 'add-to-queue'])

const fileInputRef = ref(null)
const selectedFile = ref(null)
const isDragging = ref(false)
const uploadType = ref('video')

// 获取上传类型标签
const getUploadTypeLabel = () => {
  const labels = {
    video: '视频',
    subtitle: '字幕',
    cover: '封面'
  }
  return labels[uploadType.value] || '未知'
}

// 获取接受的文件类型
const getAcceptType = () => {
  const types = {
    video: 'video/*',
    subtitle: '.srt,.ass,.ssa,.vtt',
    cover: 'image/*'
  }
  return types[uploadType.value] || '*'
}

// 获取提示文本
const getAcceptHint = () => {
  const hints = {
    video: '仅支持视频文件 (MP4, AVI, MOV, MKV 等)',
    subtitle: '支持字幕文件 (SRT, ASS, SSA, VTT)',
    cover: '支持图片文件 (JPG, PNG, WEBP 等)'
  }
  return hints[uploadType.value] || '请选择文件'
}

// 验证文件类型
const isValidFile = (file) => {
  if (uploadType.value === 'video') {
    const fileName = file.name.toLowerCase()

    // 明确排除 .ts 文件（TypeScript 或 Transport Stream）
    if (fileName.endsWith('.ts')) {
      return false
    }

    // 检查 MIME 类型
    if (file.type.startsWith('video/')) {
      return true
    }

    // 检查文件扩展名
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp', '.ts']
    return videoExtensions.some(ext => fileName.endsWith(ext))
  }

  if (uploadType.value === 'subtitle') {
    const subtitleExtensions = ['.srt', '.ass', '.ssa', '.vtt']
    const fileName = file.name.toLowerCase()
    return subtitleExtensions.some(ext => fileName.endsWith(ext))
  }

  if (uploadType.value === 'cover') {
    return file.type.startsWith('image/')
  }

  return false
}

const handleClick = () => {
  if (!props.isUploading) {
    fileInputRef.value?.click()
  }
}

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    processFile(file)
  }
  // 重置 input，允许选择同一个文件
  event.target.value = ''
}

const handleDragOver = () => {
  if (!props.isUploading) {
    isDragging.value = true
  }
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (event) => {
  isDragging.value = false
  if (props.isUploading) return

  const file = event.dataTransfer.files[0]
  if (file) {
    processFile(file)
  }
}

const processFile = (file) => {
  if (!isValidFile(file)) {
    const typeLabel = getUploadTypeLabel()
    emit('fileSelected', null, null, `错误：只能上传${typeLabel}文件！`)
    return
  }

  selectedFile.value = file
  // 通知父组件文件已选择，需要获取上传令牌
  emit('fileSelected', file, uploadType.value)
}

const handleStartUpload = () => {
  if (selectedFile.value) {
    // 验证是否已获取视频信息
    if (!props.videoInfo) {
      emit('fileSelected', null, null, '请先获取视频信息后再上传！')
      return
    }

    emit('startUpload', selectedFile.value, uploadType.value)
  }
}

const handleReupload = () => {
  if (selectedFile.value) {
    emit('reupload', selectedFile.value, uploadType.value)
  }
}

const handleResave = () => {
  emit('resave')
}

// 添加到队列
const handleAddToQueue = () => {
  if (selectedFile.value && props.videoInfo) {
    emit('add-to-queue', selectedFile.value, uploadType.value)
  }
}

// 重置文件选择
const resetFile = () => {
  selectedFile.value = null
}

defineExpose({
  selectedFile,
  uploadType,
  resetFile
})
</script>
