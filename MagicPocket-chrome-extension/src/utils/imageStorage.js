class ImageStorage {
    constructor() {
        this.dbName = 'MagicPocketDB';
        this.storeName = 'images';
        this.db = null;
        this.init();
    }

    init() {
        const request = indexedDB.open(this.dbName, 1);
        
        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { keyPath: "id" });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
        };
    }

    async saveImage(imageData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const imageRecord = {
                id: Date.now().toString(),
                data: imageData
            };
            
            const request = store.add(imageRecord);
            
            request.onsuccess = () => resolve(imageRecord.id);
            request.onerror = () => reject(request.error);
        });
    }

    async getImage(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            console.log("get image id:", id);
            
            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImage(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

const imageStorage = new ImageStorage();
// export default imageStorage;
