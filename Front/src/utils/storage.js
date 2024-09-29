function saveData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get("records", (result) => {
            let records = result.records || [];
            records.push(data);
            chrome.storage.sync.set({ records: records }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    });
}

function getRecords() {
    return new Promise((resolve) => {
        chrome.storage.sync.get("records", (data) => {
            resolve(data.records || []);
        });
    });
}

function deleteRecord(index) {
    return new Promise((resolve) => {
        chrome.storage.sync.get("records", (data) => {
            const records = data.records || [];
            records.splice(index, 1);
            chrome.storage.sync.set({ records: records }, resolve);
        });
    });
}

// export { saveData, getRecords, deleteRecord };