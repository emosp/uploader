<template>
  <div v-if="uploadInfo" class="upload-summary mt-4 p-5 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg border-2 border-teal-200 shadow-md">
    <!-- 上传成功标题 -->
    <div class="flex items-center gap-2 mb-4">
      <span class="text-2xl">✅</span>
      <h3 class="text-lg font-bold text-teal-700">上传完成</h3>
    </div>

    <!-- 文件信息部分 -->
    <div class="mb-4 p-3 bg-white rounded-lg shadow-sm">
      <h4 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
        <span>📄</span> 文件信息
      </h4>
      <div class="space-y-1.5 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">文件名:</span>
          <span class="text-gray-800 font-medium">{{ uploadInfo.fileName || '未知' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">文件大小:</span>
          <span class="text-gray-800 font-medium">{{ formatSize(uploadInfo.fileSize) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">上传时间:</span>
          <span class="text-gray-800 font-medium">{{ formatDateTime(uploadInfo.uploadTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 上传统计和奖励部分 -->
    <div class="p-3 bg-white rounded-lg shadow-sm">
      <h4 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
        <span>🎉</span> 上传统计
      </h4>
      <div class="space-y-2">
        <div class="flex items-center justify-between p-2 bg-blue-50 rounded">
          <span class="text-gray-700 text-sm">已上传资源数量</span>
          <span class="text-xl font-bold text-blue-600">{{ uploadInfo.totalCount || 0 }}</span>
        </div>
        <div v-if="uploadInfo.radishReward && uploadInfo.radishReward > 0"
             class="flex items-center justify-between p-2 bg-orange-50 rounded animate-pulse">
          <span class="text-gray-700 text-sm flex items-center gap-1">
            <span>🥕</span> 胡萝卜奖励
          </span>
          <span class="text-2xl font-bold text-orange-600">+{{ uploadInfo.radishReward }}</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="mt-4">
      <button
        @click="$emit('continue-upload')"
        class="w-full px-4 py-2 gradient-theme text-white rounded-lg text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
      >
        继续上传
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  uploadInfo: {
    type: Object,
    default: null
    // uploadInfo 结构:
    // {
    //   fileName: string,
    //   fileSize: number (bytes),
    //   uploadTime: Date,
    //   totalCount: number,
    //   radishReward: number
    // }
  }
})

const emit = defineEmits(['continue-upload'])

// 格式化文件大小
const formatSize = (bytes) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 格式化日期时间
const formatDateTime = (date) => {
  if (!date) return '未知'
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.upload-summary {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
