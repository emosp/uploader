<template>
  <div
    :class="['status-message', type, { show: visible }]"
  >
    {{ message }}
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'success',
    validator: (value) => ['success', 'error', 'uploading'].includes(value)
  },
  visible: {
    type: Boolean,
    default: false
  }
})
</script>
