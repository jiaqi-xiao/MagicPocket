import { storage } from '../logic/storage'

interface MarkedContent {
  text: string
  timestamp: number
  hasComment?: boolean
}

interface SavedRecord {
  id: string
  type: string
  content: string
  comment?: string
  timestamp: string
  url: string
}

export class FloatingWindow {
  private element: HTMLElement
  private contentList: MarkedContent[] = []
  private isExpanded = false
  private styleElement: HTMLStyleElement | null = null

  constructor() {
    this.injectStyles()
    this.element = this.createFloatingElement()
    this.attachEventListeners()
    this.loadSavedRecords()
  }

  private injectStyles(): void {
    const styleContent = `
      .magic-pocket-extension-window {
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 50px;
        height: 50px;
        min-height: 50px;
        background: #2c3e50;
        color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        transition: all 0.3s ease;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .magic-pocket-extension-window.expanded {
        width: 300px;
        height: auto;
      }

      .magic-pocket-header {
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .magic-pocket-content {
        padding: 12px;
        max-height: 400px;
        overflow-y: auto;
        display: none;
      }

      .magic-pocket-extension-window.expanded .magic-pocket-content {
        display: block;
      }

      .magic-pocket-items {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .magic-pocket-item {
        padding: 12px;
        border-radius: 6px;
        background: #34495e;
        font-size: 14px;
        line-height: 1.4;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .magic-pocket-item .text {
        color: #ffffff;
        margin-bottom: 6px;
      }

      .magic-pocket-item .timestamp {
        color: #94a3b8;
        font-size: 12px;
      }

      .magic-pocket-content::-webkit-scrollbar {
        width: 6px;
      }

      .magic-pocket-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }

      .magic-pocket-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      .magic-pocket-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      @media (prefers-color-scheme: dark) {
        .magic-pocket-extension-window {
          background: #1a1f2e;
        }

        .magic-pocket-item {
          background: #2d3748;
        }
      }

      .magic-pocket-item .comment {
        color: #94a3b8;
        font-size: 13px;
        margin-top: 4px;
        padding-left: 12px;
        border-left: 2px solid rgba(255, 255, 255, 0.2);
      }

      .magic-pocket-item .text-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .magic-pocket-item .original-text {
        color: #ffffff;
      }

      .magic-pocket-item .comment {
        color: #94a3b8;
        font-size: 13px;
        padding-left: 12px;
        border-left: 2px solid rgba(255, 255, 255, 0.2);
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }

      .magic-pocket-item .comment-icon {
        font-size: 14px;
      }

      .magic-pocket-item .timestamp {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .magic-pocket-empty {
        color: #94a3b8;
        text-align: center;
        padding: 20px;
      }

      .item-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .delete-btn {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .delete-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }
    `

    this.styleElement = document.createElement('style')
    this.styleElement.textContent = styleContent
    document.head.appendChild(this.styleElement)
  }

  private createFloatingElement(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'magic-pocket-extension-window'
    
    container.innerHTML = `
      <div class="magic-pocket-header">
        <span class="icon">📌</span>
      </div>
      <div class="magic-pocket-content">
        <div class="magic-pocket-items"></div>
      </div>
    `

    return container
  }

  private attachEventListeners(): void {
    const header = this.element.querySelector('.magic-pocket-header')
    if (header) {
        header.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded
            this.element.classList.toggle('expanded', this.isExpanded)
            this.updateContentVisibility()
        })
    }
  }

  private updateContentVisibility(): void {
    const content = this.element.querySelector('.magic-pocket-content') as HTMLElement
    if (content) {
        content.style.display = this.isExpanded ? 'block' : 'none'
    }
  }

  public addMarkedContent(text: string): void {
    console.log('Adding marked content:', text)
    const newContent: MarkedContent = {
      text,
      timestamp: Date.now(),
    }
    this.contentList.push(newContent)
    this.updateContentDisplay()
    
    if (!this.isExpanded) {
      this.isExpanded = true
      this.element.classList.add('expanded')
      this.updateContentVisibility()
    }
  }

  private updateContentDisplay(): void {
    console.log('Updating content display, items:', this.contentList.length)
    const markedItems = this.element.querySelector('.magic-pocket-items')
    if (markedItems) {
      if (this.contentList.length === 0) {
        markedItems.innerHTML = '<div class="magic-pocket-empty">No saved items</div>'
        return
      }

      markedItems.innerHTML = this.contentList
        .map((item, index) => {
          const textParts = item.text.split('\n评论：')
          const hasComment = textParts.length > 1
          const originalText = textParts[0]
          const comment = hasComment ? textParts[1] : ''
          
          return `
            <div class="magic-pocket-item ${hasComment ? 'has-comment' : ''}">
              <div class="text-content">
                <div class="original-text">${originalText}</div>
                ${hasComment ? `
                  <div class="comment">
                    <span class="comment-icon">💬</span>
                    ${comment}
                  </div>
                ` : ''}
              </div>
              <div class="item-footer">
                <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                <button class="delete-btn" data-index="${index}">🗑️</button>
              </div>
            </div>
          `
        })
        .join('')

      const deleteButtons = markedItems.querySelectorAll('.delete-btn')
      deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation()
          const index = parseInt((e.target as HTMLElement).dataset.index || '0')
          const record = this.contentList[index]
          if (record) {
            await this.deleteRecord(record.timestamp.toString())
          }
        })
      })
    }
  }

  public mount(): void {
    document.body.appendChild(this.element)
  }

  public unmount(): void {
    this.element.remove()
    if (this.styleElement) {
      this.styleElement.remove()
    }
  }

  private async loadSavedRecords(): Promise<void> {
    try {
      const result = await storage.get<{ records: SavedRecord[] }>('records')
      if (result && result.records) {
        console.log('Loading saved records:', result.records)
        
        this.contentList = result.records
          .filter(record => record.type === 'text')
          .map(record => ({
            text: record.comment 
              ? `${record.content}\n评论：${record.comment}`
              : record.content,
            timestamp: new Date(record.timestamp).getTime(),
            hasComment: !!record.comment
          }))
          .sort((a, b) => b.timestamp - a.timestamp)

        this.updateContentDisplay()
      }
    } catch (error) {
      console.error('Error loading saved records:', error)
    }
  }

  private async deleteRecord(id: string): Promise<void> {
    try {
      const result = await storage.get<{ records: SavedRecord[] }>('records')
      if (result && result.records) {
        const updatedRecords = result.records.filter(record => record.id !== id)
        await storage.set('records', updatedRecords)
        await this.loadSavedRecords()
      }
    } catch (error) {
      console.error('Error deleting record:', error)
    }
  }

  private async clearAllRecords(): Promise<void> {
    try {
      await storage.clear()
      this.contentList = []
      this.updateContentDisplay()
    } catch (error) {
      console.error('Error clearing records:', error)
    }
  }
} 