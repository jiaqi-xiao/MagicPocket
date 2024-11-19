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
});