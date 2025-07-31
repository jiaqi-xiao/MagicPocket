function saveData(data) {
    return new Promise((resolve, reject) => {
        if (!chrome || !chrome.storage || !chrome.storage.local) {
            reject(new Error('Chrome storage API not available'));
            return;
        }
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
        if (!chrome || !chrome.storage || !chrome.storage.local) {
            resolve([]);
            return;
        }
        chrome.storage.local.get("records", (data) => {
            resolve(data.records || []);
        });
    });
}

function deleteRecord(index) {
    return new Promise((resolve) => {
        if (!chrome || !chrome.storage || !chrome.storage.local) {
            resolve();
            return;
        }
        chrome.storage.local.get("records", (data) => {
            const records = data.records || [];
            records.splice(index, 1);
            chrome.storage.local.set({ records: records }, resolve);
        });
    });
}

function getGoogleAPIKey() {
    return new Promise((resolve) => {
        if (!chrome || !chrome.storage || !chrome.storage.sync) {
            resolve(null);
            return;
        }
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