<template>
  <div>
    <label class="block text-gray-800 font-medium mb-1.5 sm:mb-2 text-xs sm:text-sm">存储位置</label>
    <div class="flex gap-2 sm:gap-3">
      <button
        v-for="option in storageOptions"
        :key="option.value"
        @click="selectStorage(option.value)"
        :class="[
          'px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 active:scale-95',
          selectedStorageValue === option.value
            ? 'gradient-theme text-white shadow-md'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        ]"
        :disabled="isUploading"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  selectedStorage: {
    type: String,
    default: 'default'
  },
  isUploading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:selectedStorage'])

const storageOptions = [
  { value: 'default', label: '默认', description: '自动选择最优线路' },
  { value: 'internal', label: '国内', description: '使用国内存储，速度更快' },
  { value: 'global', label: '国际', description: '使用国际存储，全球访问' }
]

const selectedStorageValue = ref(props.selectedStorage)

const selectStorage = (value) => {
  selectedStorageValue.value = value
  emit('update:selectedStorage', value)

  // 保存到 localStorage
  localStorage.setItem('preferred_storage', value)
}

// 初始化时从 localStorage 读取
const savedStorage = localStorage.getItem('preferred_storage')
if (savedStorage && ['default', 'internal', 'global'].includes(savedStorage)) {
  selectedStorageValue.value = savedStorage
  emit('update:selectedStorage', savedStorage)
}

// 监听 props 变化
watch(() => props.selectedStorage, (newValue) => {
  selectedStorageValue.value = newValue
})
</script>
