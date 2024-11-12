interface ImageRecord {
  id: string
  data: string // base64 或其他格式的图片数据
}

export class ImageStorage {
  private dbName = 'MagicPocketDB'
  private storeName = 'images'
  private db: IDBDatabase | null = null
  private dbReady: Promise<void>

  constructor() {
    this.dbReady = this.init()
  }

  private init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = (event) => {
        console.error('Database error:', (event.target as IDBRequest).error)
        reject((event.target as IDBRequest).error)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' })
        }
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBRequest).result
        resolve()
      }
    })
  }

  private async ensureDbReady(): Promise<void> {
    if (!this.db) {
      await this.dbReady
    }
  }

  async saveImage(imageData: string): Promise<string> {
    await this.ensureDbReady()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const imageRecord: ImageRecord = {
        id: Date.now().toString(),
        data: imageData,
      }

      const request = store.add(imageRecord)

      request.onsuccess = () => resolve(imageRecord.id)
      request.onerror = () => reject(request.error)
    })
  }

  async getImage(id: string): Promise<string | null> {
    await this.ensureDbReady()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(id)

      console.log('Getting image:', id)

      request.onsuccess = () => {
        const record = request.result as ImageRecord | undefined
        resolve(record?.data || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteImage(id: string): Promise<void> {
    await this.ensureDbReady()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllImages(): Promise<ImageRecord[]> {
    await this.ensureDbReady()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clear(): Promise<void> {
    await this.ensureDbReady()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// 导出默认实例
export const imageStorage = new ImageStorage() 