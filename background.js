// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveData") {
        console.log("Received data to save:", request.data);
        // 这里处理数据保存逻辑
        chrome.storage.sync.get("mp_mark_records", (result) => {
            const records = result.records || [];
            records.push(request.data);
            chrome.storage.sync.set({ records: records }, () => {
                console.log("Data saved successfully");
                sendResponse({ status: "success" });
            });
        });
        return true; // 这表明我们会异步发送响应
    }
});