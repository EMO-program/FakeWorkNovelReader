const { app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const iconv = require('iconv-lite')

const isMac = process.platform === 'darwin'

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')
const BOOKMARKS_PATH = path.join(app.getPath('userData'), 'bookmarks.json')
const HISTORY_PATH = path.join(app.getPath('userData'), 'history.json')

let mainWindow = null

function loadJSON(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch (_) { }
  return fallback
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (_) { }
}

function readTextFile(filePath) {
  const buf = fs.readFileSync(filePath)
  const utf8 = buf.toString('utf-8')
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length
  if (replacementCount > utf8.length * 0.01 && replacementCount > 3) {
    return iconv.decode(buf, 'gbk')
  }
  return utf8
}

function buildMenu() {
  const template = [
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { label: '关于文档报表管理系统', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于文档报表管理系统',
            message: '文档报表管理系统 V2.0',
            detail: '专业的文档处理与报表生成工具。\n\n版本 2.0.0\n© 2024 综合办公系统部'
          })
        }},
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '文件(&F)',
      submenu: [
        {
          label: '新建报表(&N)',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-action', 'new')
        },
        {
          label: '打开文档(&O)...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile()
        },
        { type: 'separator' },
        {
          label: '保存(&S)',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-action', 'save')
        },
        { type: 'separator' },
        {
          label: '打印预览(&V)',
          click: () => mainWindow.webContents.send('menu-action', 'print-preview')
        },
        {
          label: '页面设置(&U)...',
          click: () => mainWindow.webContents.send('menu-action', 'page-setup')
        },
        { type: 'separator' },
        ...(isMac ? [] : [{
          label: '退出(&X)',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }])
      ]
    },
    {
      label: '编辑(&E)',
      submenu: [
        {
          label: '撤消(&U)',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-action', 'undo')
        },
        {
          label: '恢复(&R)',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu-action', 'redo')
        },
        { type: 'separator' },
        {
          label: '剪切(&T)',
          accelerator: 'CmdOrCtrl+X',
          click: () => mainWindow.webContents.send('menu-action', 'cut')
        },
        {
          label: '复制(&C)',
          accelerator: 'CmdOrCtrl+C',
          click: () => mainWindow.webContents.send('menu-action', 'copy')
        },
        {
          label: '粘贴(&P)',
          accelerator: 'CmdOrCtrl+V',
          click: () => mainWindow.webContents.send('menu-action', 'paste')
        },
        { type: 'separator' },
        {
          label: '查找(&F)...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu-action', 'find')
        },
        {
          label: '替换(&R)...',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow.webContents.send('menu-action', 'replace')
        },
        {
          label: '定位(&G)...',
          accelerator: 'CmdOrCtrl+G',
          click: () => mainWindow.webContents.send('menu-action', 'goto')
        }
      ]
    },
    {
      label: '视图(&V)',
      submenu: [
        {
          label: '普通视图(&N)',
          click: () => mainWindow.webContents.send('menu-action', 'view-normal')
        },
        {
          label: '页面视图(&P)',
          click: () => mainWindow.webContents.send('menu-action', 'view-page')
        },
        { type: 'separator' },
        {
          label: '显示标尺(&R)',
          type: 'checkbox',
          checked: true,
          click: () => mainWindow.webContents.send('menu-action', 'toggle-ruler')
        },
        {
          label: '显示状态栏(&B)',
          type: 'checkbox',
          checked: true,
          click: () => mainWindow.webContents.send('menu-action', 'toggle-statusbar')
        },
        { type: 'separator' },
        {
          label: '全屏显示(&U)',
          accelerator: isMac ? 'Cmd+Ctrl+F' : 'F11',
          click: () => {
            const isFullScreen = mainWindow.isFullScreen()
            mainWindow.setFullScreen(!isFullScreen)
          }
        }
      ]
    },
    {
      label: '工具(&T)',
      submenu: [
        {
          label: '选项(&O)...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu-action', 'options')
        },
        {
          label: '修订(&T)',
          type: 'checkbox',
          checked: false,
          click: () => mainWindow.webContents.send('menu-action', 'toggle-track-changes')
        },
        {
          label: '演示模式(&D)',
          accelerator: 'F5',
          click: () => mainWindow.webContents.send('menu-action', 'autoplay')
        },
        { type: 'separator' },
        {
          label: '宏(&M)',
          submenu: [
            {
              label: '宏录制...',
              click: () => mainWindow.webContents.send('menu-action', 'macro-record')
            },
            {
              label: '宏列表...',
              click: () => mainWindow.webContents.send('menu-action', 'macro-list')
            }
          ]
        }
      ]
    },
    {
      label: '帮助(&H)',
      submenu: [
        {
          label: '文档报表帮助(&H)',
          accelerator: 'F1',
          click: () => mainWindow.webContents.send('menu-action', 'help')
        },
        { type: 'separator' },
        ...(isMac ? [] : [{
          label: '关于文档报表管理系统(&A)',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于文档报表管理系统',
              message: '文档报表管理系统 V2.0',
              detail: '专业的文档处理与报表生成工具。\n\n版本 2.0.0\n© 2024 综合办公系统部'
            })
          }
        }])
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文档',
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const fileName = path.basename(filePath)
    const content = readTextFile(filePath)
    mainWindow.webContents.send('file-opened', { fileName, filePath, content })
    saveHistory(filePath, fileName)
  }
}

function saveHistory(filePath, fileName) {
  const history = loadJSON(HISTORY_PATH, { files: {}, lastOpened: null })
  history.files[filePath] = {
    fileName,
    filePath,
    lastOpened: Date.now()
  }
  history.lastOpened = filePath
  saveJSON(HISTORY_PATH, history)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '文档报表管理系统',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: isMac ? 'default' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.on('close', () => {
    mainWindow.webContents.send('app-closing')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerGlobalShortcuts() {
  const bossKeyCombo = isMac ? 'Cmd+`' : 'Ctrl+`'
  globalShortcut.register(bossKeyCombo, () => {
    mainWindow.webContents.send('boss-key-toggle')
  })

  globalShortcut.register('F2', () => {
    mainWindow.webContents.send('fish-mode-toggle')
  })
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文档',
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const fileName = path.basename(filePath)
    const content = readTextFile(filePath)
    saveHistory(filePath, fileName)
    return { fileName, filePath, content }
  }
  return null
})

ipcMain.handle('get-config', () => {
  return loadJSON(CONFIG_PATH, {
    fontSize: 16,
    fontFamily: 'SimSun',
    lineHeight: 1.8,
    pageWidth: 80,
    autoPlaySpeed: 5,
    disguiseLevel: 'deep',
    fishScrollSpeed: 30,
    fishScrollOffset: 0
  })
})

ipcMain.handle('save-config', (_event, config) => {
  saveJSON(CONFIG_PATH, config)
  return true
})

ipcMain.handle('get-bookmarks', () => {
  return loadJSON(BOOKMARKS_PATH, {})
})

ipcMain.handle('save-bookmark', (_event, bookmark) => {
  const bookmarks = loadJSON(BOOKMARKS_PATH, {})
  const key = bookmark.filePath
  if (!bookmarks[key]) {
    bookmarks[key] = []
  }
  bookmarks[key].push({
    chapter: bookmark.chapter,
    position: bookmark.position,
    label: bookmark.label,
    timestamp: Date.now()
  })
  saveJSON(BOOKMARKS_PATH, bookmarks)
  return bookmarks[key]
})

ipcMain.handle('remove-bookmark', (_event, data) => {
  const bookmarks = loadJSON(BOOKMARKS_PATH, {})
  const key = data.filePath
  if (bookmarks[key]) {
    bookmarks[key] = bookmarks[key].filter((b, i) => i !== data.index)
    saveJSON(BOOKMARKS_PATH, bookmarks)
  }
  return bookmarks[key] || []
})

ipcMain.handle('get-history', () => {
  return loadJSON(HISTORY_PATH, { files: {}, lastOpened: null })
})

ipcMain.handle('clear-history', () => {
  saveJSON(HISTORY_PATH, { files: {}, lastOpened: null })
  return true
})

ipcMain.handle('get-file-content', (_event, filePath) => {
  try {
    return readTextFile(filePath)
  } catch (_) {
    return null
  }
})

ipcMain.handle('remove-from-history', (_event, filePath) => {
  const history = loadJSON(HISTORY_PATH, { files: {}, lastOpened: null })
  delete history.files[filePath]
  if (history.lastOpened === filePath) {
    history.lastOpened = null
  }
  saveJSON(HISTORY_PATH, history)
  return history
})
