const { ipcRenderer } = require('electron')

let miniPaused = false
let miniTimer = null
let miniScrollOffset = 0
let scrollSpeed = 30

function escapeHTML(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

async function init() {
  const data = await ipcRenderer.invoke('get-mini-data')
  if (!data || !data.text) return

  scrollSpeed = data.speed || 30
  document.getElementById('mini-speed-slider').value = scrollSpeed

  if (data.width) {
    document.getElementById('mini-width-input').value = data.width
  }

  const content = document.getElementById('mini-ticker-content')
  content.innerHTML = '<span class="ticker-text">' + escapeHTML(data.text) + '</span>'

  startScroll()
}

function startScroll() {
  if (miniTimer) clearInterval(miniTimer)
  const content = document.getElementById('mini-ticker-content')
  const tickerText = content.querySelector('.ticker-text')
  if (!tickerText) return

  miniTimer = setInterval(() => {
    if (miniPaused) return
    miniScrollOffset += scrollSpeed / 10
    tickerText.style.transform = 'translateX(-' + miniScrollOffset + 'px)'

    if (miniScrollOffset > tickerText.scrollWidth) {
      miniScrollOffset = -content.clientWidth
    }
  }, 100)
}

// 暂停/继续
document.getElementById('btn-mini-pause').addEventListener('click', () => {
  miniPaused = !miniPaused
  document.getElementById('btn-mini-pause').textContent = miniPaused ? '▶' : '⏸'
})

// 还原
document.getElementById('btn-mini-restore').addEventListener('click', () => {
  ipcRenderer.send('exit-mini-mode')
})

// 速度滑块
document.getElementById('mini-speed-slider').addEventListener('input', (e) => {
  scrollSpeed = parseInt(e.target.value)
})

// 宽度输入
document.getElementById('mini-width-input').addEventListener('change', (e) => {
  let val = parseInt(e.target.value)
  if (isNaN(val) || val < 200) val = 200
  if (val > 3840) val = 3840
  e.target.value = val
  ipcRenderer.send('resize-mini-window', val)
})

// F3 退出
document.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    e.preventDefault()
    ipcRenderer.send('exit-mini-mode')
  }
})

window.addEventListener('beforeunload', () => {
  if (miniTimer) clearInterval(miniTimer)
})

init()
