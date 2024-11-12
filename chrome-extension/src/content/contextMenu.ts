interface Position {
  x: number
  y: number
}

interface SaveData {
  type: string
  content: string
  comment?: string
  paragraph: string
  url: string
  timestamp: string
}

export class ContextMenu {
  private element: HTMLElement
  private styleElement: HTMLStyleElement | null = null
  private onMarkClick: (text: string) => void
  private onMarkWithCommentClick: (text: string) => void

  constructor(
    onMark: (text: string) => void,
    onMarkWithComment: (text: string) => void
  ) {
    this.onMarkClick = onMark
    this.onMarkWithCommentClick = onMarkWithComment
    this.injectStyles()
    this.element = this.createMenuElement()
    document.body.appendChild(this.element)
  }

  private injectStyles(): void {
    const styleContent = `
      .magic-pocket-context-menu {
        position: absolute;
        background: #2c3e50;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        padding: 4px;
        z-index: 10000;
        display: flex;
        gap: 4px;
        transform: translateX(-50%);
      }

      .magic-pocket-menu-item {
        width: 32px;
        height: 32px;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;
        background: transparent;
        border: none;
        padding: 0;
      }

      .magic-pocket-menu-item:hover {
        background: #34495e;
        transform: translateY(-1px);
      }

      .magic-pocket-menu-item:active {
        transform: translateY(0px);
      }

      .magic-pocket-menu-item svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
      }
    `

    this.styleElement = document.createElement('style')
    this.styleElement.textContent = styleContent
    document.head.appendChild(this.styleElement)
  }

  private createMenuElement(): HTMLElement {
    const menu = document.createElement('div')
    menu.className = 'magic-pocket-context-menu'
    
    menu.innerHTML = `
      <button class="magic-pocket-menu-item" data-action="mark" title="标记文本">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
      <button class="magic-pocket-menu-item" data-action="mark-with-comment" title="添加评论并标记">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    `

    this.attachMenuListeners(menu)
    return menu
  }

  private attachMenuListeners(menu: HTMLElement): void {
    menu.addEventListener('click', async (e) => {
      e.stopPropagation()
      const target = e.target as HTMLElement
      const menuItem = target.closest('.magic-pocket-menu-item') as HTMLElement
      if (!menuItem) return

      const action = menuItem.dataset.action
      const selection = window.getSelection()
      const text = selection?.toString().trim() || ''

      if (text) {
        try {
          if (action === 'mark') {
            await this.saveSelection(text)
          } else if (action === 'mark-with-comment') {
            await this.promptForComment(text)
          }
          selection?.removeAllRanges()
        } catch (error) {
          console.error('Error saving selection:', error)
        }
      }

      this.hide()
    })
  }

  private async saveSelection(text: string): Promise<void> {
    console.log('Saving selection:', text)
    const data = await this.prepareData(text)
    await this.saveData(data)
    this.onMarkClick(text)
  }

  private async promptForComment(text: string): Promise<void> {
    const comment = prompt('Please input your comment:')
    if (comment !== null) {
      const data = await this.prepareData(text, comment)
      await this.saveData(data)
      this.onMarkWithCommentClick(`${text}\nComment: ${comment}`)
    }
  }

  private async prepareData(text: string, comment?: string): Promise<SaveData> {
    const selection = window.getSelection()
    const paragraph = selection?.anchorNode?.parentElement
    
    const data: SaveData = {
      type: 'text',
      content: text,
      paragraph: paragraph?.textContent || '',
      url: window.location.href,
      timestamp: new Date().toISOString()
    }

    if (comment) {
      data.comment = comment
    }

    return data
  }

  private async saveData(data: SaveData): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'saveData', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError)
          reject(chrome.runtime.lastError)
        } else {
          console.log('Save response:', response)
          resolve()
        }
      })
    })
  }

  public show(position: Position): void {
    const { x, y } = this.adjustPosition(position)
    this.element.style.left = `${x}px`
    this.element.style.top = `${y}px`
    this.element.style.display = 'flex'
    console.log('Showing context menu at:', { x, y })
  }

  public hide(): void {
    this.element.style.display = 'none'
    console.log('Hiding context menu')
  }

  private adjustPosition(position: Position): Position {
    const selection = window.getSelection()
    if (!selection) return position

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    const centerX = rect.left + (rect.width / 2) + window.scrollX
    let menuY = rect.top + window.scrollY - 50 // 增加了偏移量，使菜单显示在更上方

    // 确保菜单不会超出视口
    if (rect.top < 60) { // 考虑到菜单高度和间距
      menuY = rect.bottom + window.scrollY + 10
    }

    return {
      x: centerX,
      y: menuY
    }
  }

  public destroy(): void {
    this.element.remove()
    if (this.styleElement) {
      this.styleElement.remove()
    }
    console.log('Context menu destroyed')
  }
} 