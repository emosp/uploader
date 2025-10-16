import { ref, onMounted } from 'vue'
import { BASE_URL, LOGIN_URL } from '../config'

export function useAuth() {
  const token = ref('')
  const username = ref('')
  const isLoggedIn = ref(false)

  // 获取用户信息
  const getUserInfo = () => {
    const savedToken = sessionStorage.getItem('token')
    const savedUsername = sessionStorage.getItem('username')

    if (savedToken && savedUsername) {
      return { token: savedToken, username: savedUsername }
    }
    return null
  }

  // 保存用户信息
  const saveUserInfo = (userToken, userName) => {
    sessionStorage.setItem('token', userToken)
    sessionStorage.setItem('username', userName)
    token.value = userToken
    username.value = userName
    isLoggedIn.value = true
  }

  // 清除用户信息
  const clearUserInfo = () => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('username')
    token.value = ''
    username.value = ''
    isLoggedIn.value = false
  }

  // 更新用户状态
  const updateUserState = () => {
    const userInfo = getUserInfo()
    if (userInfo) {
      token.value = userInfo.token
      username.value = userInfo.username
      isLoggedIn.value = true
      console.log('用户已登录:', userInfo)
    } else {
      console.log('用户未登录')
    }
  }

  // 处理登录回调
  const handleLoginCallback = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const callbackToken = urlParams.get('token')
    const callbackUsername = urlParams.get('username')

    if (callbackToken && callbackUsername) {
      console.log('检测到登录回调，保存用户信息')
      saveUserInfo(callbackToken, callbackUsername)

      // 清除 URL 中的参数
      const cleanUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, document.title, cleanUrl)

      return true
    }
    return false
  }

  // 登录
  const login = () => {
    const callbackUrl = encodeURIComponent(window.location.href)
    const loginUrl = `${BASE_URL}${LOGIN_URL}&url=${callbackUrl}`
    console.log('跳转到登录页面:', loginUrl)
    window.location.href = loginUrl
  }

  // 登出
  const logout = () => {
    console.log('用户登出')
    clearUserInfo()
  }

  // 初始化
  onMounted(() => {
    handleLoginCallback()
    updateUserState()
  })

  return {
    token,
    username,
    isLoggedIn,
    login,
    logout,
    handleLoginCallback
  }
}
