<template>
  <div v-if="queue.length > 0 || queueSummaryInfo" class="upload-queue mt-4 sm:mt-6">
    <!-- 队列上传汇总信息 -->
    <UploadSummary
      v-if="queueSummaryInfo"
      :upload-info="queueSummaryInfo"
      :is-queue-summary="true"
      @close-summary="$emit('clear-summary')"
      class="mb-4"
    />
    <!-- 移动端队列头部 -->
    <div class="flex sm:hidden flex-col gap-2 mb-3">
      <div class="flex items-center justify-between gap-2">
        <!-- 左侧统计 -->
        <div class="flex-1 min-w-0">
          <h3 class="text-gray-800 font-medium mb-0.5 text-xs">上传队列</h3>
          <div class="text-[10px] text-gray-500 leading-tight">
            {{ idleCount }} 待命 | {{ pendingCount }} 等待 | {{ uploadingCount }} 上传中 | {{ completedCount }} 已完成
          </div>
        </div>
        <!-- 右侧按钮 -->
        <div class="flex gap-1.5 shrink-0">
          <button
            v-if="pendingCount > 0 || idleCount > 0"
            @click="$emit('upload-all')"
            class="px-2 py-1.5 text-[10px] gradient-theme text-white rounded-lg hover:shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            全部开始
          </button>
          <button
            v-if="completedCount > 0"
            @click="$emit('clear-completed')"
            class="px-2 py-1.5 text-[10px] bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors active:scale-95 whitespace-nowrap"
          >
            清除已完成
          </button>
        </div>
      </div>
      <!-- 移动端并发数控制 -->
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-gray-600">任务数:</span>
        <div class="flex items-center">
          <button @click="updateConcurrentUploads(maxConcurrentUploads - 1)" :disabled="maxConcurrentUploads <= 1" class="px-2 py-0.5 text-[10px] bg-gray-200 rounded-l-md disabled:opacity-50">-</button>
          <span class="px-2 text-[10px] font-medium bg-gray-100">{{ maxConcurrentUploads }}</span>
          <button @click="updateConcurrentUploads(maxConcurrentUploads + 1)" :disabled="maxConcurrentUploads >= 10" class="px-2 py-0.5 text-[10px] bg-gray-200 rounded-r-md disabled:opacity-50">+</button>
        </div>
      </div>
    </div>

    <!-- 桌面端队列头部 -->
    <div class="hidden sm:flex sm:items-center justify-between gap-3 mb-4">
      <h3 class="text-gray-800 font-medium text-sm">
        上传队列
        <span class="text-xs sm:text-sm text-gray-500 ml-2">
          ({{ idleCount }} 待命 | {{ pendingCount }} 等待 | {{ uploadingCount }} 上传中 | {{ completedCount }} 已完成)
        </span>
      </h3>
      <div class="flex gap-3 items-center">
        <!-- 并发数控制 -->
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-600">任务数:</span>
          <div class="flex items-center">
            <button @click="updateConcurrentUploads(maxConcurrentUploads - 1)" :disabled="maxConcurrentUploads <= 1" class="px-2 py-0.5 text-xs bg-gray-200 rounded-l-md disabled:opacity-50">-</button>
            <span class="px-2 text-xs font-medium bg-gray-100">{{ maxConcurrentUploads }}</span>
            <button @click="updateConcurrentUploads(maxConcurrentUploads + 1)" :disabled="maxConcurrentUploads >= 10" class="px-2 py-0.5 text-xs bg-gray-200 rounded-r-md disabled:opacity-50">+</button>
          </div>
        </div>

        <button
          v-if="completedCount > 0"
          @click="$emit('clear-completed')"
          class="px-2.5 sm:px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          清除已完成
        </button>
        <button
          v-if="pendingCount > 0 || idleCount > 0"
          @click="$emit('upload-all')"
          class="px-2.5 sm:px-3 py-1.5 text-xs gradient-theme text-white rounded-lg hover:shadow-md transition-all"
        >
          全部开始
        </button>
      </div>
    </div>

    <!-- 队列列表 -->
    <div class="space-y-3">
      <div
        v-for="item in queue"
        :key="item.id"
        :class="[
          'queue-item bg-white border-2 rounded-lg p-2.5 sm:p-3 transition-all duration-300',
          {
            'border-gray-300': item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.IDLE,
            'border-teal-500 bg-teal-50': item.status === QUEUE_STATUS.UPLOADING || item.status === QUEUE_STATUS.SAVING,
            'border-green-500 bg-green-50': item.status === QUEUE_STATUS.COMPLETED,
            'border-red-500 bg-red-50': item.status === QUEUE_STATUS.FAILED
          }
        ]"
      >
        <!-- 移动端布局 -->
        <div class="block sm:hidden">
          <!-- 第一行：文件名 -->
          <div class="mb-2">
            <span class="font-medium text-gray-800 text-sm block truncate">{{ item.file.name }}</span>
          </div>

          <!-- 第二行：视频ID、大小、视频名称 -->
          <div class="text-[10px] text-gray-500 mb-2 leading-relaxed">
            <span>{{ item.videoId }}</span>
            <span class="mx-1">·</span>
            <span>{{ formatFileSize(item.file.size) }}</span>
            <span v-if="item.videoInfo" class="mx-1">·</span>
            <span v-if="item.videoInfo">{{ item.videoInfo.title }}</span>
          </div>

          <!-- 进度条 -->
          <div v-if="item.status === QUEUE_STATUS.UPLOADING || item.status === QUEUE_STATUS.SAVING" class="mb-2">
            <div class="w-full h-1.5 bg-gray-300 rounded overflow-hidden mb-1">
              <div
                class="gradient-theme-h h-full transition-all duration-300"
                :style="{ width: item.progress + '%' }"
              ></div>
            </div>
            <div class="flex justify-between text-[10px] text-gray-600">
              <span>{{ item.progress }}%</span>
              <div class="flex gap-1.5">
                <span v-if="item.timeRemaining && item.timeRemaining !== '计算中...' && item.progress < 100">{{ item.timeRemaining }}</span>
                <span v-if="item.speed">{{ item.speed }}</span>
              </div>
            </div>
          </div>

          <!-- 第三行：标签和按钮 -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <span class="text-xs px-1.5 py-1 leading-none bg-gray-200 text-gray-600 rounded flex-shrink-0">{{ getUploadTypeLabel(item.uploadType) }}</span>
              <span
                class="text-xs px-1.5 py-1 leading-none rounded flex-shrink-0"
                :class="{
                  'bg-blue-200 text-blue-700': item.status === QUEUE_STATUS.IDLE,
                  'bg-gray-200 text-gray-600': item.status === QUEUE_STATUS.PENDING,
                  'bg-teal-200 text-teal-700': item.status === QUEUE_STATUS.UPLOADING || item.status === QUEUE_STATUS.SAVING,
                  'bg-green-200 text-green-700': item.status === QUEUE_STATUS.COMPLETED,
                  'bg-red-200 text-red-700': item.status === QUEUE_STATUS.FAILED
                }"
              >
                <span v-if="item.status === QUEUE_STATUS.IDLE">待命</span>
                <span v-else-if="item.status === QUEUE_STATUS.PENDING">等待</span>
                <span v-else-if="item.status === QUEUE_STATUS.UPLOADING">上传中</span>
                <span v-else-if="item.status === QUEUE_STATUS.SAVING">保存中</span>
                <span v-else-if="item.status === QUEUE_STATUS.COMPLETED">已完成</span>
                <span v-else-if="item.status === QUEUE_STATUS.FAILED">失败</span>
              </span>
            </div>

            <!-- 移动端按钮组 -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <template v-if="item.status === QUEUE_STATUS.IDLE">
                <button
                  @click="$emit('start-item', item.id)"
                  class="px-2.5 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  开始
                </button>
                <button
                  @click="$emit('remove-item', item.id)"
                  class="px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  移除
                </button>
              </template>

              <template v-else-if="item.status === QUEUE_STATUS.PENDING">
                <button
                  disabled
                  class="px-2.5 py-1 text-xs bg-gray-400 text-white rounded cursor-not-allowed"
                >
                  排队中
                </button>
                <button
                  @click="$emit('remove-item', item.id)"
                  class="px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  移除
                </button>
              </template>

              <template v-else-if="item.status === QUEUE_STATUS.COMPLETED">
                <button
                  @click="$emit('remove-item', item.id)"
                  class="px-2.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  移除
                </button>
              </template>

              <template v-else-if="item.status === QUEUE_STATUS.FAILED">
                <button
                  @click="$emit('retry-item', item.id)"
                  class="px-2.5 py-1 text-xs gradient-theme text-white rounded hover:shadow-md transition-all"
                >
                  重试
                </button>
                <button
                  @click="$emit('remove-item', item.id)"
                  class="px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  移除
                </button>
              </template>
            </div>
          </div>

          <!-- 错误信息 -->
          <div v-if="item.status === QUEUE_STATUS.FAILED && item.error" class="text-xs text-red-600 mt-2">
            {{ item.error }}
          </div>
        </div>

        <!-- 桌面端布局 -->
        <div class="hidden sm:flex sm:items-center">
          <!-- 左侧：文件信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="font-medium text-gray-800 truncate text-sm">{{ item.file.name }}</span>
            </div>
            <div class="text-xs text-gray-500">
              <span>{{ item.videoId }}</span>
              <span class="mx-1.5">·</span>
              <span>{{ formatFileSize(item.file.size) }}</span>
              <span v-if="item.videoInfo" class="mx-1.5">·</span>
              <span v-if="item.videoInfo" class="truncate">{{ item.videoInfo.title }}</span>
            </div>

            <!-- 进度条 -->
            <div v-if="item.status === QUEUE_STATUS.UPLOADING || item.status === QUEUE_STATUS.SAVING" class="mt-2">
              <div class="w-full h-1.5 bg-gray-300 rounded overflow-hidden mb-1">
                <div
                  class="gradient-theme-h h-full transition-all duration-300"
                  :style="{ width: item.progress + '%' }"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-gray-600">
                <span>{{ item.progress }}%</span>
                <div class="flex gap-2">
                  <span v-if="item.timeRemaining && item.timeRemaining !== '计算中...' && item.progress < 100">剩余: {{ item.timeRemaining }}</span>
                  <span v-if="item.speed">{{ item.speed }}</span>
                </div>
              </div>
            </div>

            <!-- 状态标签 -->
            <div class="mt-2 flex items-center gap-2">
              <span class="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">{{ getUploadTypeLabel(item.uploadType) }}</span>
              <span
                class="text-xs px-1.5 py-0.5 rounded"
                :class="{
                  'bg-blue-200 text-blue-700': item.status === QUEUE_STATUS.IDLE,
                  'bg-gray-200 text-gray-600': item.status === QUEUE_STATUS.PENDING,
                  'bg-teal-200 text-teal-700': item.status === QUEUE_STATUS.UPLOADING || item.status === QUEUE_STATUS.SAVING,
                  'bg-green-200 text-green-700': item.status === QUEUE_STATUS.COMPLETED,
                  'bg-red-200 text-red-700': item.status === QUEUE_STATUS.FAILED
                }"
              >
                <span v-if="item.status === QUEUE_STATUS.IDLE">待命</span>
                <span v-else-if="item.status === QUEUE_STATUS.PENDING">等待上传</span>
                <span v-else-if="item.status === QUEUE_STATUS.UPLOADING">上传中</span>
                <span v-else-if="item.status === QUEUE_STATUS.SAVING">保存中</span>
                <span v-else-if="item.status === QUEUE_STATUS.COMPLETED">已完成</span>
                <span v-else-if="item.status === QUEUE_STATUS.FAILED">失败</span>
              </span>
              <span v-if="item.status === QUEUE_STATUS.FAILED && item.error" class="text-xs text-red-600">
                {{ item.error }}
              </span>
            </div>
          </div>

          <!-- 右侧：操作按钮 -->
          <div class="flex-shrink-0 flex flex-col gap-1.5 ml-3">
            <!-- 等待状态：上传 + 删除 -->
            <template v-if="item.status === QUEUE_STATUS.IDLE">
              <button
                @click="$emit('start-item', item.id)"
                class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                开始
              </button>
              <button
                @click="$emit('remove-item', item.id)"
                class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </template>

            <!-- 等待状态：显示排队中 + 删除 -->
            <template v-else-if="item.status === QUEUE_STATUS.PENDING">
              <button
                disabled
                class="px-3 py-1 text-xs bg-gray-400 text-white rounded cursor-not-allowed"
              >
                排队中
              </button>
              <button
                @click="$emit('remove-item', item.id)"
                class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </template>

            <!-- 已完成：删除 -->
            <template v-if="item.status === QUEUE_STATUS.COMPLETED">
              <button
                @click="$emit('remove-item', item.id)"
                class="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                移除
              </button>
            </template>

            <!-- 失败：重试 + 删除 -->
            <template v-if="item.status === QUEUE_STATUS.FAILED">
              <button
                @click="$emit('retry-item', item.id)"
                class="px-3 py-1 text-xs gradient-theme text-white rounded hover:shadow-md transition-all"
              >
                重试
              </button>
              <button
                @click="$emit('remove-item', item.id)"
                class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                移除
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import UploadSummary from './UploadSummary.vue'
const props = defineProps({
  queue: {
    type: Array,
    required: true
  },
  idleCount: {
    type: Number,
    required: true
  },
  pendingCount: {
    type: Number,
    required: true
  },
  uploadingCount: {
    type: Number,
    required: true
  },
  completedCount: {
    type: Number,
    required: true
  },
  hasUploading: {
    type: Boolean,
    required: true
  },
  QUEUE_STATUS: {
    type: Object,
    required: true
  },
  formatFileSize: {
    type: Function,
    required: true
  },
  queueSummaryInfo: {
    type: Object,
    default: null
  },
  maxConcurrentUploads: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['start-item', 'remove-item', 'retry-item', 'upload-all', 'clear-completed', 'clear-summary', 'update:max-concurrent-uploads'])

const updateConcurrentUploads = (newValue) => {
  if (newValue >= 1 && newValue <= 10) {
    emit('update:max-concurrent-uploads', newValue)
  }
}

// 获取上传类型标签
const getUploadTypeLabel = (type) => {
  const labels = {
    video: '视频',
    subtitle: '字幕',
    cover: '封面'
  }
  return labels[type] || '未知'
}
</script>

<style scoped>
.queue-item {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

