<template>
  <div class="w-full lg:flex-1">
    <div class="mb-4">
      <label for="videoId" class="block text-gray-800 font-medium mb-2 text-sm">
        视频 ID
      </label>
      <div class="flex gap-2.5">
        <input
          id="videoId"
          v-model="localVideoId"
          type="text"
          placeholder="输入 vl-123 或 ve-456"
          autocomplete="off"
          :disabled="isUploading"
          :class="[
            'flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-sm transition-all duration-300 outline-none',
            'focus:border-teal-500 focus:shadow-[0_0_0_3px_rgba(76,191,170,0.1)]',
            {
              'border-red-500': !isValid && localVideoId,
              'border-green-500': isValid,
              'bg-gray-100 cursor-not-allowed': isUploading
            }
          ]"
          @input="handleInput"
        />
        <button
          type="button"
          :disabled="isLoading || isUploading"
          @click="handleFetch"
          class="gradient-theme px-5 py-3 text-white rounded-lg text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {{ isLoading ? '获取中...' : isUploading ? '上传中' : '获取' }}
        </button>
      </div>
      <div :class="['input-hint mt-1.5 text-xs', !isValid && localVideoId ? 'text-red-500' : 'text-gray-500']">
        {{ validationMessage }}
      </div>
    </div>

    <!-- 视频信息显示 -->
    <div
      v-if="showInfo"
      class="video-info-container bg-gray-100 rounded-lg p-5 mb-0"
    >
      <div class="font-semibold text-gray-800 mb-3 text-base">视频信息</div>
      <div class="text-gray-600 text-sm leading-relaxed">
        <!-- 加载中 -->
        <div v-if="isLoading" class="video-info-loading">
          ⏳ 正在获取视频信息...
        </div>

        <!-- 错误信息 -->
        <div v-else-if="error" class="video-info-error">
          ❌ 获取视频信息失败: {{ error }}
          <br><br>
          <small>提示: 请确保视频 ID 正确，且 API 端点已正确配置</small>
        </div>

        <!-- 视频信息 -->
        <div v-else-if="videoInfo">
          <div class="video-info-item">
            <strong>视频ID:</strong> {{ videoInfo.id || localVideoId }}
          </div>
          <div class="video-info-item">
            <strong>视频名称:</strong> {{ videoInfo.title || '未知' }}
          </div>
        </div>

        <!-- 默认提示 -->
        <p v-else class="text-gray-500 italic m-0">
          输入视频 ID 并点击"获取"按钮
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  videoId: {
    type: String,
    default: ''
  },
  videoInfo: {
    type: Object,
    default: null
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  isValid: {
    type: Boolean,
    default: false
  },
  isUploading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:videoId', 'fetch', 'validate'])

const localVideoId = ref(props.videoId)

watch(() => props.videoId, (newVal) => {
  localVideoId.value = newVal
})

const showInfo = computed(() => {
  return props.isLoading || props.error || props.videoInfo
})

const validationMessage = computed(() => {
  if (!localVideoId.value) {
    return '必须以 vl- 或 ve- 开头，后跟正整数'
  }
  if (props.isValid) {
    return '✓ 格式正确'
  }
  return '✗ 格式错误：必须以 vl- 或 ve- 开头，后跟正整数'
})

const handleInput = () => {
  emit('update:videoId', localVideoId.value)
  emit('validate', localVideoId.value)
}

const handleFetch = () => {
  emit('fetch')
}
</script>
