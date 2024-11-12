import { FloatingWindow } from './floatingWindow'
import { ContextMenu } from './contextMenu'

let selectedText = ''
let floatingWindow: FloatingWindow | null = null
let contextMenu: ContextMenu | null = null

function createFloatingWindow(): void {
  floatingWindow = new FloatingWindow()
  floatingWindow.mount()
}

function createContextMenu(): void {
  contextMenu = new ContextMenu(
    (text) => {
      console.log('Marking text:', text)
      if (floatingWindow) {
        floatingWindow.addMarkedContent(text)
      }
    },
    (textWithComment) => {
      console.log('Marking text with comment:', textWithComment)
      if (floatingWindow) {
        floatingWindow.addMarkedContent(textWithComment)
      }
    }
  )
}

function handleMouseUp(event: MouseEvent): void {
  const selection = window.getSelection()
  if (selection) {
    selectedText = selection.toString().trim()
    if (selectedText && contextMenu) {
      // 直接使用 selection 的位置信息
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      
      contextMenu.show({
        x: rect.left + (rect.width / 2), // 使用选中文本的中心点
        y: rect.top
      })
    }
  }
}

function handleGlobalMouseDown(event: MouseEvent): void {
  // 点击其他区域时隐藏上下文菜单
  if (contextMenu) {
    const target = event.target as HTMLElement
    if (!target.closest('.magic-pocket-context-menu')) {
      contextMenu.hide()
    }
  }
}

function initializeExtension(): void {
  console.info('Initializing extension')
  createFloatingWindow()
  createContextMenu()
  addGlobalEventListeners()
}

function addGlobalEventListeners(): void {
  console.info('Adding global event listeners')
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('mousedown', handleGlobalMouseDown)
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection()
    if (!selection || selection.toString().trim() === '') {
      contextMenu?.hide()
    }
  })
}

// Initialize the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension)
} else {
  initializeExtension()
}

// Enable communication with webext-bridge
import { onMessage } from 'webext-bridge'

// Example of receiving messages from background script
onMessage('tab-prev', ({ data }) => {
  console.info(`Navigate from page "${data.title}"`)
})


