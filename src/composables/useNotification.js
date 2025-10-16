import { ref, onMounted } from 'vue'

export function useNotification() {
  const message = ref('')
  const type = ref('success')
  const visible = ref(false)
  let timeout = null

  const showStatus = (msg, msgType = 'success') => {
    if (timeout) {
      clearTimeout(timeout)
    }

    message.value = msg
    type.value = msgType
    visible.value = true

    timeout = setTimeout(() => {
      hideStatus()
    }, 2000)
  }

  const hideStatus = () => {
    visible.value = false
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return {
    message,
    type,
    visible,
    showStatus,
    hideStatus
  }
}
