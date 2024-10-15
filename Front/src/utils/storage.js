function saveData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get("records", (result) => {
            let records = result.records || [];
            records.push(data);
            chrome.storage.local.set({ records: records }, () => {
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
        chrome.storage.local.get("records", (data) => {
            resolve(data.records || []);
        });
    });
}

function deleteRecord(index) {
    return new Promise((resolve) => {
        chrome.storage.local.get("records", (data) => {
            const records = data.records || [];
            records.splice(index, 1);
            chrome.storage.local.set({ records: records }, resolve);
        });
    });
}

function getGoogleAPIKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('googleApiKey', (data) => {
            if (data.googleApiKey) {
                resolve(data.googleApiKey);
            } else {
                console.log('Google API Key is not set');
                resolve(null);
            }
        });
    });
}

// export { saveData, getRecords, deleteRecord };