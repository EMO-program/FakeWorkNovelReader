const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千万\d]+[章节回卷]\s*.*$/,
  /^Chapter\s+\d+.*$/i,
  /^第[一二三四五六七八九十百千万\d]+卷\s*.*$/,
  /^[第卷]\s*\d+\s*[章节回卷].*$/,
  /^\d+[\.、]\s*.+$/
]

const BOSS_FAKE_DATA = [
  ['2025-05-17', 'G15沈海高速K1285+300', '追尾碰撞', '3', '2重伤', '闵行大队', '已结案'],
  ['2025-05-16', 'G60沪昆高速K65+800', '侧面刮擦', '0', '1轻伤', '松江大队', '处理中'],
  ['2025-05-16', 'S20外环高速K45+200', '单车撞护栏', '5', '死亡1人', '浦东大队', '调查中'],
  ['2025-05-15', 'G2京沪高速K1189+500', '多车连环追尾', '8', '3轻伤', '昆山大队', '已结案'],
  ['2025-05-15', 'G50沪渝高速K30+100', '货车侧翻', '1', '无', '青浦大队', '已结案'],
  ['2025-05-14', 'S4沪金高速K18+600', '追尾碰撞', '2', '1轻伤', '奉贤大队', '处理中'],
  ['2025-05-14', 'G1503绕城高速K95+400', '夜间视线不清碰撞', '4', '2重伤', '宝山大队', '调查中'],
  ['2025-05-13', 'G15沈海高速K1320+700', '疲劳驾驶追尾', '3', '死亡2人', '嘉定大队', '已结案'],
  ['2025-05-13', 'S32申嘉湖高速K22+800', '爆胎失控', '1', '1轻伤', '金山大队', '处理中'],
  ['2025-05-12', 'G2京沪高速K1201+300', '雨天侧滑碰撞护栏', '2', '无', '嘉定大队', '已结案'],
  ['2025-05-12', 'S20外环高速K50+100', '违规变道刮擦', '3', '无', '闵行大队', '处理中'],
  ['2025-05-11', 'G60沪昆高速K72+400', '超速追尾', '5', '3重伤', '松江大队', '调查中'],
  ['2025-05-11', 'S4沪金高速K20+300', '爆胎翻车', '1', '死亡1人', '奉贤大队', '已结案'],
  ['2025-05-10', 'G40沪陕高速K36+800', '疲劳驾驶冲入隔离带', '2', '1重伤', '崇明大队', '处理中'],
]

const App = {
  currentFile: null,
  chapters: [],
  currentChapter: 0,
  currentPage: 0,
  totalPages: 0,
  pages: [],
  autoPlayTimer: null,
  autoScrollTimer: null,
  isAutoPlaying: false,
  bossKeyActive: false,
  fishModeActive: false,
  fishPaused: false,
  fishTimer: null,
  fishScrollOffset: 0,
  fishTickerText: null,
  fishTickerFile: null,
  bookmarks: {},

  config: {
    fontSize: 16,
    fontFamily: 'SimSun',
    lineHeight: 1.8,
    pageWidth: 80,
    autoPlaySpeed: 5,
    disguiseLevel: 'deep',
    fishScrollSpeed: 30,
    fishScrollOffset: 0,
    eyeCareMode: false
  },

  async init() {
    await this.loadConfig()
    await this.loadBookmarks()
    await this.loadHistory()
    this.bindEvents()
    this.bindIPC()
    this.updateRowNumbers()
    this.renderBossFakeTable()
    this.initAutoPlaySpeedSlider()
    this.initFishSpeedSlider()
    this.applyEyeCareMode()
    this.updateStatusBar()
  },

  async loadConfig() {
    try {
      const config = await window.electronAPI.getConfig()
      if (config) {
        Object.assign(this.config, config)
      }
    } catch (_) { }
    this.applyConfig()
  },

  applyConfig() {
    const display = document.getElementById('text-display')
    if (display) {
      display.style.fontSize = this.config.fontSize + 'px'
      display.style.fontFamily = this.config.fontFamily + ', serif'
      display.style.lineHeight = this.config.lineHeight
    }
  },

  async saveConfigToDisk() {
    try {
      await window.electronAPI.saveConfig(this.config)
    } catch (_) { }
  },

  async loadBookmarks() {
    try {
      const bookmarks = await window.electronAPI.getBookmarks()
      this.bookmarks = bookmarks || {}
    } catch (_) { }
  },

  async loadHistory() {
    try {
      const history = await window.electronAPI.getHistory()
      this.history = history
      this.renderFileList()
    } catch (_) {
      this.history = { files: {}, lastOpened: null }
    }
  },

  bindIPC() {
    window.electronAPI.onFileOpened((data) => {
      this.openFileContent(data)
    })
    window.electronAPI.onMenuAction((action) => {
      this.handleMenuAction(action)
    })
    window.electronAPI.onBossKeyToggle(() => {
      this.toggleBossKey()
    })
    window.electronAPI.onFishModeToggle(() => {
      this.toggleFishMode()
    })
    window.electronAPI.onAppClosing(() => {
      this.onAppClosing()
    })
  },

  bindEvents() {
    document.querySelectorAll('.tb-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action
        if (action) this.handleMenuAction(action)
      })
    })

    document.getElementById('reading-container').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.nextPage()
      }
    })

    document.addEventListener('keydown', (e) => {
      this.handleKeydown(e)
    })

    document.getElementById('text-display').addEventListener('wheel', (e) => {
      if (this.isAutoPlaying || this.bossKeyActive) return
      const display = document.getElementById('text-display')
      const atTop = display.scrollTop <= 0
      const atBottom = display.scrollTop + display.clientHeight >= display.scrollHeight - 2
      if (e.deltaY > 0 && atBottom) {
        e.preventDefault()
        this.nextPage()
      } else if (e.deltaY < 0 && atTop) {
        e.preventDefault()
        this.prevPage()
      }
    }, { passive: false })

    document.getElementById('text-display').addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.showContextMenu(e.clientX, e.clientY)
    })

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('custom-context-menu')
      if (menu && !menu.contains(e.target)) {
        menu.style.display = 'none'
      }
      const popup = document.getElementById('chapter-list-popup')
      const btn = document.querySelector('.sheet-add-btn')
      if (popup && popup.style.display !== 'none' && !popup.contains(e.target) && !btn.contains(e.target)) {
        popup.style.display = 'none'
      }
    })

    document.querySelectorAll('[data-action="close-settings"]').forEach(el => {
      el.addEventListener('click', () => this.closeSettings())
    })

    document.querySelectorAll('[data-action="close-help"]').forEach(el => {
      el.addEventListener('click', () => this.closeHelp())
    })

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      this.saveSettings()
    })

    document.getElementById('btn-autoplay').addEventListener('click', () => {
      this.toggleAutoPlay()
    })

    document.getElementById('btn-eyecare').addEventListener('click', () => {
      this.toggleEyeCareMode()
    })

    document.querySelector('.sheet-add-btn').addEventListener('click', () => {
      this.toggleChapterPopup()
    })

    document.getElementById('chapter-list-popup').addEventListener('click', (e) => {
      const item = e.target.closest('.chapter-list-item')
      if (item) {
        const index = parseInt(item.dataset.index)
        this.goToChapter(index)
        this.toggleChapterPopup()
      }
    })

    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeSettings()
      }
    })

    document.getElementById('help-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeHelp()
      }
    })

    document.getElementById('set-auto-speed').addEventListener('input', (e) => {
      document.getElementById('set-auto-speed-val').textContent = e.target.value + '秒'
    })

    document.getElementById('set-fish-speed').addEventListener('input', (e) => {
      document.getElementById('set-fish-speed-val').textContent = e.target.value + '字符/秒'
    })

    document.getElementById('btn-fish-pause').addEventListener('click', () => {
      this.toggleFishPause()
    })
  },

  initAutoPlaySpeedSlider() {
    const slider = document.getElementById('autoplay-speed-slider')
    const display = document.getElementById('autoplay-speed-display')
    slider.value = this.config.autoPlaySpeed
    display.textContent = this.config.autoPlaySpeed + 's'
    slider.addEventListener('input', () => {
      this.config.autoPlaySpeed = parseInt(slider.value)
      display.textContent = slider.value + 's'
      this.saveConfigToDisk()
      if (this.isAutoPlaying) {
        if (this.autoPlayTimer) {
          clearTimeout(this.autoPlayTimer)
          this.autoPlayTimer = null
        }
        this.autoPlayStep()
      }
    })
  },

  initFishSpeedSlider() {
    const slider = document.getElementById('fish-speed-slider')
    slider.value = this.config.fishScrollSpeed
    slider.addEventListener('input', () => {
      this.config.fishScrollSpeed = parseInt(slider.value)
      this.saveConfigToDisk()
    })
  },

  showContextMenu(x, y) {
    let menu = document.getElementById('custom-context-menu')
    if (!menu) {
      menu = document.createElement('div')
      menu.id = 'custom-context-menu'
      menu.className = 'context-menu'
      menu.innerHTML = `
        <div class="context-menu-item" data-action="bookmark">📌 标记此行</div>
        <div class="context-menu-item" data-action="prev-page">◀ 上翻页</div>
        <div class="context-menu-item" data-action="next-page">下翻页 ▶</div>
        <div class="context-menu-sep"></div>
        <div class="context-menu-item" data-action="autoplay">▶ 演示模式</div>
      `
      menu.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item')
        if (item) {
          const action = item.dataset.action
          menu.style.display = 'none'
          this.handleMenuAction(action)
        }
      })
      document.body.appendChild(menu)
    }
    menu.style.display = 'block'
    menu.style.left = x + 'px'
    menu.style.top = y + 'px'

    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menu.style.left = (x - rect.width) + 'px'
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (y - rect.height) + 'px'
    }
  },

  handleKeydown(e) {
    if (e.key === 'F1') {
      e.preventDefault()
      this.openHelp()
      return
    }

    if (e.key === 'F2') {
      e.preventDefault()
      this.toggleFishMode()
      return
    }

    if (this.bossKeyActive) return

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault()
        this.nextPage()
        break
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault()
        this.prevPage()
        break
      case 'Home':
        if (e.ctrlKey) {
          e.preventDefault()
          this.goToChapter(0)
          this.goToPage(0)
        }
        break
      case 'End':
        if (e.ctrlKey) {
          e.preventDefault()
          this.goToChapter(this.chapters.length - 1)
          this.goToPage(this.totalPages - 1)
        }
        break
      case 'F5':
        e.preventDefault()
        this.toggleAutoPlay()
        break
      case 'Escape':
        if (this.isAutoPlaying) {
          this.stopAutoPlay()
        }
        break
      default:
        if (e.key === 'd' && e.ctrlKey) {
          e.preventDefault()
          this.addBookmark()
        }
        break
    }
  },

  async handleMenuAction(action) {
    switch (action) {
      case 'open':
      case 'new':
        await this.openFile()
        break
      case 'save':
        this.saveCurrentPosition()
        break
      case 'find':
        this.showFindDialog()
        break
      case 'goto':
        this.showGotoDialog()
        break
      case 'prev-page':
        this.prevPage()
        break
      case 'next-page':
        this.nextPage()
        break
      case 'autoplay':
        this.toggleAutoPlay()
        break
      case 'options':
        this.openSettings()
        break
      case 'help':
        this.openHelp()
        break
      case 'print-preview':
        this.toggleBossKey()
        break
      case 'undo':
        this.prevPage()
        break
      case 'redo':
        this.nextPage()
        break
      case 'bookmark':
        this.addBookmark()
        break
      default:
        break
    }
  },

  async openFile() {
    try {
      const result = await window.electronAPI.openFileDialog()
      if (result) {
        this.openFileContent(result)
      }
    } catch (err) {
      console.error('打开文件失败:', err)
    }
  },

  openFileContent(data) {
    this.currentFile = data
    if (!this.history) this.history = { files: {}, lastOpened: null }
    this.history.files[data.filePath] = {
      fileName: data.fileName,
      filePath: data.filePath,
      lastOpened: Date.now()
    }
    this.history.lastOpened = data.filePath
    this.parseChapters(data.content)
    this.currentChapter = 0
    this.updateChapterTabs()
    this.gotoChapterStart(0)
    this.renderFileList()
    this.renderBookmarkList()
    document.getElementById('formula-input').value = data.fileName
    document.getElementById('cell-ref').textContent = 'A1'
  },

  parseChapters(content) {
    const lines = content.split(/\r?\n/)
    this.chapters = []
    let currentChapter = { title: '前言', startLine: 0, lines: [] }
    let foundFirstChapter = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (this.isChapterTitle(line)) {
        if (foundFirstChapter || currentChapter.lines.length > 0) {
          this.chapters.push(currentChapter)
        }
        currentChapter = { title: line, startLine: i, lines: [] }
        foundFirstChapter = true
      } else {
        currentChapter.lines.push(line)
      }
    }
    if (currentChapter.lines.length > 0 || this.chapters.length === 0) {
      this.chapters.push(currentChapter)
    }

    if (this.chapters.length === 0) {
      this.chapters.push({ title: '全文', startLine: 0, lines: lines })
    }
  },

  isChapterTitle(line) {
    if (!line || line.length > 50) return false
    for (const pattern of CHAPTER_PATTERNS) {
      if (pattern.test(line)) return true
    }
    return false
  },

  buildPages(chapterIndex) {
    if (chapterIndex < 0 || chapterIndex >= this.chapters.length) return
    const chapter = this.chapters[chapterIndex]
    this.pages = []
    const lineHeightPx = this.config.fontSize * this.config.lineHeight
    const containerHeight = document.getElementById('text-display').clientHeight
    const effectiveContainerHeight = containerHeight - 16
    const linesPerPage = Math.max(1, Math.floor(effectiveContainerHeight / lineHeightPx))
    const allLines = [chapter.title, ...chapter.lines]
    const totalLineCount = allLines.length

    for (let i = 0; i < totalLineCount; i += linesPerPage) {
      this.pages.push({
        startLine: i,
        endLine: Math.min(i + linesPerPage - 1, totalLineCount - 1),
        lines: allLines.slice(i, Math.min(i + linesPerPage, totalLineCount))
      })
    }
    this.totalPages = this.pages.length
  },

  gotoChapterStart(chapterIndex) {
    this.currentChapter = chapterIndex
    this.buildPages(chapterIndex)
    this.goToPage(0)
    this.updateChapterTabs()
  },

  goToChapter(chapterIndex) {
    if (chapterIndex < 0 || chapterIndex >= this.chapters.length) return
    this.gotoChapterStart(chapterIndex)
    this.saveCurrentPosition()
  },

  goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.totalPages) return
    this.currentPage = pageIndex
    this.renderPage()
    this.updateStatusBar()
  },

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.goToPage(this.currentPage + 1)
    } else if (this.currentChapter < this.chapters.length - 1) {
      this.gotoChapterStart(this.currentChapter + 1)
    }
  },

  prevPage() {
    if (this.currentPage > 0) {
      this.goToPage(this.currentPage - 1)
    } else if (this.currentChapter > 0) {
      this.gotoChapterStart(this.currentChapter - 1)
      this.goToPage(this.totalPages - 1)
    }
  },

  renderPage() {
    const display = document.getElementById('text-display')
    if (this.pages.length === 0 || !this.pages[this.currentPage]) {
      display.innerHTML = ''
      return
    }

    const page = this.pages[this.currentPage]
    const lines = page.lines
    let html = ''

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      line = this.escapeHTML(line)

      if (i === 0 && this.currentPage === 0) {
        html += `<div class="chapter-title-line">${line}</div>`
      } else if (this.isChapterTitle(lines[i])) {
        html += `<div class="chapter-title-line">${line}</div>`
      } else if (line.trim() === '') {
        html += `<div class="reading-line empty-line">&nbsp;</div>`
      } else {
        const isBookmarked = this.isLineBookmarked(page.startLine + i)
        const cls = isBookmarked ? 'reading-line bookmarked' : 'reading-line'
        html += `<div class="${cls}">${line || '&nbsp;'}</div>`
      }
    }

    display.innerHTML = html
    display.scrollTop = 0

    this.updateRowNumbers()
    document.getElementById('cell-ref').textContent =
      'A' + (this.currentPage + 1)
  },

  isLineBookmarked(lineIndex) {
    if (!this.currentFile) return false
    const key = this.currentFile.filePath
    const bms = this.bookmarks[key] || []
    return bms.some(b => b.chapter === this.currentChapter && b.position === lineIndex)
  },

  escapeHTML(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  },

  updateRowNumbers() {
    const rowNumbers = document.getElementById('row-numbers')
    const display = document.getElementById('text-display')
    const lineHeightPx = this.config.fontSize * this.config.lineHeight
    const containerHeight = display.clientHeight
    const count = Math.max(1, Math.floor(containerHeight / lineHeightPx))
    let html = ''
    for (let i = 1; i <= count; i++) {
      html += `<div class="row-num">${i}</div>`
    }
    rowNumbers.innerHTML = html
  },

  updateChapterTabs() {
    const tabs = document.getElementById('sheet-tabs')
    tabs.innerHTML = ''

    const maxVisible = 10
    const total = this.chapters.length

    let startIdx = 0
    let endIdx = total
    if (total > maxVisible) {
      const half = Math.floor(maxVisible / 2)
      startIdx = Math.max(0, this.currentChapter - half)
      endIdx = Math.min(total, startIdx + maxVisible)
      if (endIdx - startIdx < maxVisible) {
        startIdx = Math.max(0, endIdx - maxVisible)
      }
    }

    for (let i = startIdx; i < endIdx; i++) {
      const tab = document.createElement('span')
      tab.className = 'sheet-tab'
      if (i === this.currentChapter) tab.classList.add('active')
      tab.textContent = 'Sheet' + (i + 1)
      tab.title = this.chapters[i].title
      tab.dataset.index = i
      tab.addEventListener('click', () => {
        this.goToChapter(i)
      })
      tabs.appendChild(tab)
    }
  },

  toggleChapterPopup() {
    if (this.chapters.length === 0) return
    const popup = document.getElementById('chapter-list-popup')
    if (popup.style.display === 'none') {
      popup.innerHTML = this.chapters.map((ch, i) => {
        const active = i === this.currentChapter ? ' active' : ''
        return `<div class="chapter-list-item${active}" data-index="${i}">Sheet${i + 1} — ${this.escapeHTML(ch.title)}</div>`
      }).join('')
      popup.style.display = 'block'
    } else {
      popup.style.display = 'none'
    }
  },

  toggleEyeCareMode() {
    this.config.eyeCareMode = !this.config.eyeCareMode
    this.applyEyeCareMode()
    this.saveConfigToDisk()
  },

  applyEyeCareMode() {
    const container = document.getElementById('reading-container')
    const btn = document.getElementById('btn-eyecare')
    if (this.config.eyeCareMode) {
      container.classList.add('eye-care')
      btn.classList.add('active')
      btn.textContent = '🌿 护眼 ✓'
    } else {
      container.classList.remove('eye-care')
      btn.classList.remove('active')
      btn.textContent = '🌿 护眼'
    }
  },

  toggleAutoPlay() {
    if (this.isAutoPlaying) {
      this.stopAutoPlay()
    } else {
      this.startAutoPlay()
    }
  },

  startAutoPlay() {
    if (this.chapters.length === 0) return
    this.isAutoPlaying = true
    const btn = document.getElementById('btn-autoplay')
    btn.textContent = '⏸ 停止演示'
    btn.classList.add('active')
    document.getElementById('status-autoplay').style.display = ''
    document.getElementById('status-sep-autoplay').style.display = ''
    document.getElementById('autoplay-speed-group').style.display = ''
    document.getElementById('autoplay-speed-slider').value = this.config.autoPlaySpeed
    document.getElementById('autoplay-speed-display').textContent = this.config.autoPlaySpeed + 's'
    this.autoPlayStep()
  },

  stopAutoPlay() {
    this.isAutoPlaying = false
    const btn = document.getElementById('btn-autoplay')
    btn.textContent = '▶ 演示模式'
    btn.classList.remove('active')
    document.getElementById('status-autoplay').style.display = 'none'
    document.getElementById('status-sep-autoplay').style.display = 'none'
    document.getElementById('autoplay-speed-group').style.display = 'none'
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer)
      this.autoPlayTimer = null
    }
    if (this.autoScrollTimer) {
      clearInterval(this.autoScrollTimer)
      this.autoScrollTimer = null
    }
  },

  autoPlayStep() {
    if (!this.isAutoPlaying) return
    const display = document.getElementById('text-display')
    if (!display) return

    const maxScroll = Math.floor(display.scrollHeight - display.clientHeight)
    if (maxScroll > 2) {
      this.startAutoScroll(display, maxScroll)
    } else {
      this.flipToNextContent()
    }
  },

  startAutoScroll(display, maxScroll) {
    if (this.autoScrollTimer) clearInterval(this.autoScrollTimer)
    const intervalMs = 30
    const pixelsPerStep = (maxScroll / this.config.autoPlaySpeed) * (intervalMs / 1000)
    const step = Math.max(1, pixelsPerStep)
    this.autoScrollTimer = setInterval(() => {
      if (!this.isAutoPlaying) {
        clearInterval(this.autoScrollTimer)
        this.autoScrollTimer = null
        return
      }
      const prevScrollTop = display.scrollTop
      display.scrollTop += step
      if (display.scrollTop >= maxScroll || display.scrollTop === prevScrollTop) {
        display.scrollTop = maxScroll
        clearInterval(this.autoScrollTimer)
        this.autoScrollTimer = null
        this.flipToNextContent()
      }
    }, intervalMs)
  },

  flipToNextContent() {
    if (!this.isAutoPlaying) return
    if (this.currentPage < this.totalPages - 1) {
      this.goToPage(this.currentPage + 1)
    } else if (this.currentChapter < this.chapters.length - 1) {
      this.gotoChapterStart(this.currentChapter + 1)
    } else {
      this.stopAutoPlay()
      return
    }
    this.autoPlayTimer = setTimeout(() => this.autoPlayStep(), 200)
  },

  toggleBossKey() {
    this.bossKeyActive = !this.bossKeyActive
    const bossContent = document.getElementById('boss-key-content')
    const readingContainer = document.getElementById('reading-container')
    const disguiseHeader = document.getElementById('disguise-header')
    const colHeaders = document.getElementById('col-headers')
    const fileList = document.getElementById('file-list')
    const bookmarkList = document.getElementById('bookmark-list')
    const statusMode = document.getElementById('status-mode')
    const statusSepMode = document.getElementById('status-sep-mode')

    if (this.bossKeyActive) {
      if (this.fishModeActive) this.exitFishMode()
      bossContent.style.display = ''
      readingContainer.style.display = 'none'
      disguiseHeader.style.display = 'none'
      colHeaders.style.display = 'none'
      fileList.innerHTML = '<div class="file-item-empty">项目列表已锁定</div>'
      bookmarkList.innerHTML = '<div class="bookmark-empty">标记列表已锁定</div>'
      statusMode.style.display = ''
      statusSepMode.style.display = ''
      this.renderBossFakeTable()
      this.renderBossRowNumbers()
    } else {
      bossContent.style.display = 'none'
      readingContainer.style.display = ''
      disguiseHeader.style.display = ''
      colHeaders.style.display = ''
      statusMode.style.display = 'none'
      statusSepMode.style.display = 'none'
      this.renderFileList()
      this.renderBookmarkList()
    }
  },

  renderBossFakeTable() {
    const tbody = document.getElementById('boss-fake-table-body')
    let html = ''
    for (let i = 0; i < BOSS_FAKE_DATA.length; i++) {
      html += '<tr><td>' + (i + 1) + '</td>'
      for (const cell of BOSS_FAKE_DATA[i]) {
        html += '<td>' + cell + '</td>'
      }
      html += '</tr>'
    }
    tbody.innerHTML = html
  },

  renderBossRowNumbers() {
    const container = document.getElementById('boss-row-numbers')
    let html = ''
    for (let i = 1; i <= BOSS_FAKE_DATA.length; i++) {
      html += `<div class="row-num" style="height:30px;">${i}</div>`
    }
    container.innerHTML = html
  },

  toggleFishMode() {
    if (this.bossKeyActive) return
    if (!this.currentFile) return

    this.fishModeActive = !this.fishModeActive
    const ticker = document.getElementById('fish-ticker')
    const statusMode = document.getElementById('status-mode')
    const statusSepMode = document.getElementById('status-sep-mode')
    const bossContent = document.getElementById('boss-key-content')
    const readingContainer = document.getElementById('reading-container')
    const disguiseHeader = document.getElementById('disguise-header')
    const colHeaders = document.getElementById('col-headers')
    const fileList = document.getElementById('file-list')
    const bookmarkList = document.getElementById('bookmark-list')

    if (this.fishModeActive) {
      ticker.style.display = ''
      bossContent.style.display = ''
      bossContent.classList.add('fish-active')
      readingContainer.style.display = 'none'
      disguiseHeader.style.display = 'none'
      colHeaders.style.display = 'none'
      fileList.innerHTML = '<div class="file-item-empty">项目列表已锁定</div>'
      bookmarkList.innerHTML = '<div class="bookmark-empty">标记列表已锁定</div>'
      statusMode.style.display = ''
      statusMode.textContent = '🔍 校验模式'
      statusSepMode.style.display = ''
      this.fishPaused = false
      document.getElementById('btn-fish-pause').textContent = '⏸ 暂停'
      document.getElementById('fish-speed-slider').value = this.config.fishScrollSpeed
      this.renderFishTickerContent()
      this.startFishScroll()
      this.renderBossFakeTable()
      this.renderBossRowNumbers()
    } else {
      this.exitFishMode()
    }
  },

  exitFishMode() {
    this.config.fishScrollOffset = this.fishScrollOffset
    this.saveConfigToDisk()
    this.fishModeActive = false
    document.getElementById('fish-ticker').style.display = 'none'
    document.getElementById('boss-key-content').style.display = 'none'
    document.getElementById('boss-key-content').classList.remove('fish-active')
    document.getElementById('reading-container').style.display = ''
    document.getElementById('disguise-header').style.display = ''
    document.getElementById('col-headers').style.display = ''
    document.getElementById('status-mode').style.display = 'none'
    document.getElementById('status-sep-mode').style.display = 'none'
    this.renderFileList()
    this.renderBookmarkList()
    if (this.fishTimer) {
      clearInterval(this.fishTimer)
      this.fishTimer = null
    }
    this.fishPaused = false
  },

  renderFishTickerContent() {
    const fileKey = this.currentFile ? this.currentFile.filePath : null
    if (this.fishTickerFile !== fileKey || !this.fishTickerText) {
      let text = ''
      for (const chapter of this.chapters) {
        text += '  【' + chapter.title + '】  '
        text += chapter.lines.join(' ') + '  '
      }
      this.fishTickerText = this.escapeHTML(text)
      this.fishTickerFile = fileKey
    }
    const content = document.getElementById('fish-ticker-content')
    content.innerHTML = '<span class="ticker-text">' + this.fishTickerText + '</span>'
    this.fishScrollOffset = this.config.fishScrollOffset || 0
    const tickerText = content.querySelector('.ticker-text')
    if (tickerText && this.fishScrollOffset > 0) {
      tickerText.style.transform = 'translateX(-' + this.fishScrollOffset + 'px)'
    }
  },

  startFishScroll() {
    if (this.fishTimer) clearInterval(this.fishTimer)
    const content = document.getElementById('fish-ticker-content')
    const tickerText = content.querySelector('.ticker-text')
    if (!tickerText) return

    this.fishTimer = setInterval(() => {
      if (this.fishPaused) return
      const speed = this.config.fishScrollSpeed
      this.fishScrollOffset += speed / 10
      tickerText.style.transform = 'translateX(-' + this.fishScrollOffset + 'px)'

      if (this.fishScrollOffset > tickerText.scrollWidth) {
        this.fishScrollOffset = -content.clientWidth
      }
    }, 100)
  },

  toggleFishPause() {
    this.fishPaused = !this.fishPaused
    document.getElementById('btn-fish-pause').textContent = this.fishPaused ? '▶ 继续' : '⏸ 暂停'
  },

  addBookmark() {
    if (!this.currentFile || this.pages.length === 0) return
    const page = this.pages[this.currentPage]
    const label = this.chapters[this.currentChapter].title + ' - 第' + (this.currentPage + 1) + '页'
    this.saveBookmarkToDisk({
      filePath: this.currentFile.filePath,
      chapter: this.currentChapter,
      position: page.startLine,
      label: label
    })
  },

  async saveBookmarkToDisk(bookmark) {
    try {
      const result = await window.electronAPI.saveBookmark(bookmark)
      const key = bookmark.filePath
      this.bookmarks[key] = result
      this.renderBookmarkList()
      this.renderPage()
    } catch (_) { }
  },

  async removeBookmark(filePath, index) {
    try {
      const result = await window.electronAPI.removeBookmark({ filePath, index })
      this.bookmarks[filePath] = result
      this.renderBookmarkList()
      this.renderPage()
    } catch (_) { }
  },

  renderBookmarkList() {
    const list = document.getElementById('bookmark-list')
    if (!this.currentFile) {
      list.innerHTML = '<div class="bookmark-empty">暂无标记</div>'
      return
    }
    const key = this.currentFile.filePath
    const bms = this.bookmarks[key] || []
    if (bms.length === 0) {
      list.innerHTML = '<div class="bookmark-empty">暂无标记</div>'
      return
    }
    list.innerHTML = bms.map((bm, i) =>
      `<div class="bookmark-item" data-index="${i}" data-chapter="${bm.chapter}" data-position="${bm.position}" title="跳转到标记位置">
        <span class="bm-label">📌 ${this.escapeHTML(bm.label || '未命名标记')}</span>
        <span class="bm-delete" data-index="${i}">×</span>
      </div>`
    ).join('')

    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bm-delete')) {
          const index = parseInt(e.target.dataset.index)
          this.removeBookmark(this.currentFile.filePath, index)
          return
        }
        const chapter = parseInt(item.dataset.chapter)
        this.goToChapter(chapter)
      })
    })
  },

  renderFileList() {
    const list = document.getElementById('file-list')
    const h = this.history || { files: {} }
    const files = Object.values(h.files)
    if (files.length === 0) {
      list.innerHTML = '<div class="file-item-empty">暂无文档，请打开文件</div>'
      return
    }
    files.sort((a, b) => b.lastOpened - a.lastOpened)
    list.innerHTML = files.map(f =>
      `<div class="file-item" data-path="${this.escapeHTML(f.filePath)}" title="${this.escapeHTML(f.filePath)}">
        <span class="file-name">📄 ${this.escapeHTML(f.fileName)}</span>
        <span class="file-delete" data-path="${this.escapeHTML(f.filePath)}" title="从列表中移除">×</span>
      </div>`
    ).join('')

    if (this.currentFile) {
      list.querySelectorAll('.file-item').forEach(item => {
        if (item.dataset.path === this.currentFile.filePath) {
          item.classList.add('active')
        }
      })
    }

    list.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('file-delete')) return
        const filePath = item.dataset.path
        try {
          const content = await window.electronAPI.getFileContent(filePath)
          if (content) {
            const fileName = filePath.split(/[\\/]/).pop()
            this.openFileContent({ fileName, filePath, content })
          }
        } catch (_) { }
      })
    })

    list.querySelectorAll('.file-delete').forEach(del => {
      del.addEventListener('click', async (e) => {
        e.stopPropagation()
        const filePath = del.dataset.path
        if (confirm('确定要从列表中移除该文档吗？\n\n注意：此操作仅移除记录，不会删除源文件。')) {
          try {
            const result = await window.electronAPI.removeFromHistory(filePath)
            this.history = result
            this.renderFileList()
          } catch (_) { }
        }
      })
    })
  },

  async saveCurrentPosition() {
    if (!this.currentFile) return
    const history = this.history || { files: {}, lastOpened: null }
    history.files[this.currentFile.filePath] = {
      fileName: this.currentFile.fileName,
      filePath: this.currentFile.filePath,
      lastOpened: Date.now(),
      lastChapter: this.currentChapter,
      lastPage: this.currentPage
    }
    history.lastOpened = this.currentFile.filePath
    this.history = history
  },

  onAppClosing() {
    this.saveCurrentPosition()
    this.stopAutoPlay()
    if (this.autoScrollTimer) clearInterval(this.autoScrollTimer)
    this.config.fishScrollOffset = this.fishScrollOffset
    this.saveConfigToDisk()
    if (this.fishTimer) clearInterval(this.fishTimer)
  },

  updateStatusBar() {
    const display = document.getElementById('text-display')
    const text = display.textContent || ''
    const charCount = text.replace(/\s/g, '').length
    const lineCount = this.pages.length > 0 && this.pages[this.currentPage]
      ? this.pages[this.currentPage].lines.length
      : 0

    document.getElementById('status-state').textContent = this.isAutoPlaying ? '演示模式中' : '就绪'
    document.getElementById('status-page').textContent =
      `页码: ${this.currentPage + 1}/${this.totalPages}`
    document.getElementById('status-chars').textContent =
      `字数: ${charCount.toLocaleString()}`
    document.getElementById('status-lines').textContent =
      `行: ${lineCount}, 列: 80`
  },

  showFindDialog() {
    alert('[查找和替换]\n\n功能开发中，即将上线。')
  },

  showGotoDialog() {
    if (this.chapters.length === 0) return
    const input = prompt(`定位到页码 (1-${this.totalPages})：`, String(this.currentPage + 1))
    if (input !== null) {
      const page = parseInt(input) - 1
      if (page >= 0 && page < this.totalPages) {
        this.goToPage(page)
      }
    }
  },

  openHelp() {
    document.getElementById('help-modal').style.display = 'flex'
  },

  closeHelp() {
    document.getElementById('help-modal').style.display = 'none'
  },

  openSettings() {
    document.getElementById('set-font-size').value = this.config.fontSize
    document.getElementById('set-line-height').value = this.config.lineHeight
    document.getElementById('set-page-width').value = this.config.pageWidth
    document.getElementById('set-auto-speed').value = this.config.autoPlaySpeed
    document.getElementById('set-auto-speed-val').textContent = this.config.autoPlaySpeed + '秒'
    document.getElementById('set-fish-speed').value = this.config.fishScrollSpeed
    document.getElementById('set-fish-speed-val').textContent = this.config.fishScrollSpeed + '字符/秒'
    document.getElementById('set-disguise-level').value = this.config.disguiseLevel
    document.getElementById('settings-modal').style.display = 'flex'
  },

  closeSettings() {
    document.getElementById('settings-modal').style.display = 'none'
  },

  saveSettings() {
    this.config.fontSize = parseInt(document.getElementById('set-font-size').value) || 16
    this.config.lineHeight = parseFloat(document.getElementById('set-line-height').value) || 1.8
    this.config.pageWidth = parseInt(document.getElementById('set-page-width').value) || 80
    this.config.autoPlaySpeed = parseInt(document.getElementById('set-auto-speed').value) || 5
    this.config.fishScrollSpeed = parseInt(document.getElementById('set-fish-speed').value) || 30
    this.config.disguiseLevel = document.getElementById('set-disguise-level').value

    this.applyConfig()
    this.saveConfigToDisk()

    document.getElementById('autoplay-speed-slider').value = this.config.autoPlaySpeed
    document.getElementById('autoplay-speed-display').textContent = this.config.autoPlaySpeed + 's'
    document.getElementById('fish-speed-slider').value = this.config.fishScrollSpeed

    if (this.chapters.length > 0) {
      this.buildPages(this.currentChapter)
      this.goToPage(Math.min(this.currentPage, this.totalPages - 1))
    }

    this.updateRowNumbers()
    this.updateStatusBar()
    this.closeSettings()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  App.init()
})

window.addEventListener('resize', () => {
  if (App.chapters.length > 0) {
    App.buildPages(App.currentChapter)
    const savedPage = App.currentPage
    App.goToPage(Math.min(savedPage, App.totalPages - 1))
    App.updateRowNumbers()
  }
})
