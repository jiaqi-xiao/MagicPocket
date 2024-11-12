import { sendMessage, onMessage } from 'webext-bridge'

// 定义数据接口
interface SaveData {
  type: string
  content: string
  comment?: string
  paragraph: string
  url: string
  timestamp: string
}

interface SavedRecord extends SaveData {
  id: string
}

interface MessageResponse {
  status: 'success' | 'error'
  message?: string
}

// 安装监听器
chrome.runtime.onInstalled.addListener((): void => {
  console.log('Extension installed')
})

// 标签页相关逻辑
let previousTabId = 0

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!previousTabId) {
    previousTabId = tabId
    return
  }
  const tab = await chrome.tabs.get(previousTabId)
  previousTabId = tabId
  if (!tab) return

  console.log('previous tab', tab)
  sendMessage(
    'tab-prev',
    { title: tab.title },
    { context: 'content-script', tabId }
  )
})

// 数据保存逻辑
chrome.runtime.onMessage.addListener((
  request: { action: string; data: SaveData },
  sender,
  sendResponse: (response: MessageResponse) => void
) => {
  if (request.action === 'saveData') {
    handleSaveData(request.data, sendResponse)
    return true // 表明会异步发送响应
  }
})

async function handleSaveData(
  data: SaveData,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['records'])
    let records: SavedRecord[] = result.records || []

    // 添加唯一id字段
    const newRecord: SavedRecord = {
      id: Date.now().toString(),
      ...data
    }

    console.log('newRecord start to save: ', newRecord)

    // 检查数据大小
    const recordSize = JSON.stringify(newRecord).length
    if (recordSize > 10240) {
      console.warn('Record size exceeds limit:', recordSize)
      sendResponse({ status: 'error', message: 'Record size too large' })
      return
    }

    records.push(newRecord)

    await chrome.storage.local.set({ records })
    console.log('Data saved successfully')
    sendResponse({ status: 'success' })

  } catch (error) {
    console.error('Error saving data:', error)
    sendResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// 获取当前标签页
onMessage('get-current-tab', async () => {
  try {
    const tab = await chrome.tabs.get(previousTabId)
    return {
      title: tab.title || ''
    }
  } catch {
    return {
      title: ''
    }
  }
})
