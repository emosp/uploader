<template>
  <div class="gradient-theme rounded-xl p-5 shadow-lg w-full lg:flex-[0_0_auto] lg:min-w-[320px] lg:max-w-[360px] shrink-0 self-start">
    <!-- 未登录状态 -->
    <div v-if="!isLoggedIn" class="flex items-center gap-4 text-white">
      <div class="bg-white/30 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden">
        <img src="../assets/avatar.png" alt="用户头像" class="w-full h-full object-cover" />
      </div>
      <div class="flex-1 text-base font-medium">未登录</div>
      <button
        @click="handleLogin"
        class="px-6 py-2.5 bg-white text-teal-600 rounded-lg text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
      >
        登录
      </button>
    </div>

    <!-- 已登录状态 -->
    <div v-else class="flex items-center gap-4 text-white">
      <div class="bg-white/30 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden">
        <img src="../assets/avatar.png" alt="用户头像" class="w-full h-full object-cover" />
      </div>
      <div class="flex-1">
        <div class="text-base font-semibold">{{ username }}</div>
      </div>
      <button
        @click="handleLogout"
        :disabled="isUploading"
        :class="[
          'px-5 py-2 border-2 rounded-lg text-sm font-medium transition-all duration-300',
          isUploading
            ? 'bg-white/10 text-white/50 border-white/30 cursor-not-allowed'
            : 'bg-white/20 text-white border-white hover:bg-white hover:text-teal-600'
        ]"
      >
        登出
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    default: ''
  },
  isUploading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['login', 'logout'])

const handleLogin = () => {
  emit('login')
}

const handleLogout = () => {
  if (!props.isUploading) {
    emit('logout')
  }
}
</script>
