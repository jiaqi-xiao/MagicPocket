// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveData") {
        chrome.storage.local.get(["records"], (result) => {
            let records = result.records || [];
            // 添加唯一id字段
            const newRecord = {
                id: Date.now().toString(),
                ...request.data
            };

            console.log("newRecord start to save: ", newRecord);
            
            // 检查数据大小
            const recordSize = JSON.stringify(newRecord).length;
            if (recordSize > 10240) {
                console.warn("Record size exceeds limit:", recordSize);
                sendResponse({ status: "error", message: "Record size too large" });
                return;
            }
            
            records.push(newRecord);
            chrome.storage.local.set({ records: records }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving data:", chrome.runtime.lastError);
                    sendResponse({ status: "error", message: chrome.runtime.lastError.message });
                } else {
                    console.log("Data saved successfully");
                    sendResponse({ status: "success" });
                }
            });
        });
        return true; // 这表明我们会异步发送响应
    }
    
    // Handle IntentTree storage
    if (request.action === "saveIntentTree") {
        chrome.storage.local.set({ intentTree: request.intentTree }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving intent tree:", chrome.runtime.lastError);
                sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            } else {
                console.log("Intent tree saved successfully");
                // console.log("Intent tree: ", request.intentTree);
                sendResponse({ status: "success" });
            }
        });
        return true;
    }

    if (request.action === "getIntentTree") {
        chrome.storage.local.get(['intentTree'], (result) => {
            sendResponse({ intentTree: result.intentTree });
            console.log("Intent tree sent to content script: ", result.intentTree);
        });
        return true;
    }

    if (request.action === "fetchRAG") {
        chrome.storage.sync.get(['selectedHost'], async (result) => {
            const host = result.selectedHost || 'http://localhost:8000/';
            fetch(`${host}rag`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request.data)
            })
            .then(response => response.json())
            .then(result => {
                sendResponse({ result });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        });
        return true; // 保持消息通道开放
    }

    if (request.action === "openSidePanel") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.sidePanel.open({tabId: tabs[0].id}).catch(error => {
                console.error('Error opening side panel:', error);
            });
        });
        return true;
    }
});