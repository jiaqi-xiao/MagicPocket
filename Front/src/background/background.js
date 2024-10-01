// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveData") {
        chrome.storage.sync.get("records", (result) => {
            let records = result.records || [];
            // 添加唯一id字段
            const newRecord = {
                id: Date.now().toString(),
                ...request.data
            };
            // console.log("Save New record:", newRecord);
            records.push(newRecord);
            chrome.storage.sync.set({ records: records }, () => {
                console.log("Data saved successfully");
                sendResponse({ status: "success" });
            });
        });
        return true; // 这表明我们会异步发送响应
    }
});