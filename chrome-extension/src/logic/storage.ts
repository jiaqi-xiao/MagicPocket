import { useLocalStorage } from '@vueuse/core'

// 基础存储
export const storageDemo = useLocalStorage('webext-demo', 'Storage Demo', { listenToStorageChanges: true })

// Chrome 存储接口
interface StorageData {
  [key: string]: any
}

export class Storage {
  constructor(private storageArea: 'local' | 'sync' = 'local') {}

  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage[this.storageArea].get(key, (result) => {
        resolve(result[key] || null)
      })
    })
  }

  async set(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage[this.storageArea].set({ [key]: value }, resolve)
    })
  }

  async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage[this.storageArea].remove(key, resolve)
    })
  }

  async clear(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage[this.storageArea].clear(resolve)
    })
  }

  async getAll(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage[this.storageArea].get(null, (items) => {
        resolve(items)
      })
    })
  }

  onChange(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === this.storageArea) {
        callback(changes)
      }
    })
  }
}

// 导出默认实例
export const storage = new Storage('local')
