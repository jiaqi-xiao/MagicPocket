// popup.js


function displayRecords() {
    chrome.storage.local.get("records", async (data) => {
        const records = data.records || [];
        const recordsList = document.getElementById("recordsList");
        recordsList.innerHTML = "";

        if (records.length === 0) {
            recordsList.innerHTML = "<p>No items saved yet.</p>";
        } else {
            for (const record of records) {
                const item = document.createElement("div");
                item.className = "record-item";
                
                let contentHtml = '';
                if (record.type === "text") {
                    contentHtml = `<p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>`;
                } else if (record.type === "image") {
                    try {
                        const imageData = await imageStorage.getImage(record.content);
                        contentHtml = `
                            <div class="image-preview">
                                <img src="${imageData}" alt="Screenshot" style="max-width: 100%; max-height: 150px; object-fit: contain;">
                            </div>
                        `;
                    } catch (error) {
                        console.warn('Error loading image:', error);
                        contentHtml = '<p>Error loading image</p>';
                    }
                }

                item.innerHTML = `
                    <strong>${record.type === "text" ? "Text" : "Screenshot"}</strong>
                    ${contentHtml}
                    <small>${new Date(record.timestamp).toLocaleString()}</small>
                    <button class="delete-btn" data-index="${records.indexOf(record)}">Delete</button>
                `;
                recordsList.appendChild(item);
            }
        }
    });
}

function deleteRecord(index) {
    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];
        records.splice(index, 1);
        chrome.storage.local.set({ records: records }, () => {
            displayRecords();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("mp-popup-new-task-btn").addEventListener("click", () => {
        if (confirm("Are you sure you want to start a new task? This will clear all current records.")) {
            chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/new_task/new_task.html') });
            window.close();
        }
    });

    document.getElementById("mp-popup-side-panel-btn").addEventListener("click", () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.sidePanel.open({tabId: tabs[0].id}).catch(error => {
                console.error('Error opening side panel:', error);
            });
        });
        window.close();
    });

    // 日志导出功能
    document.getElementById('mp-popup-export-logs-btn').addEventListener('click', async () => {
        await Logger.exportLogs();
        window.close(); // 导出后关闭弹出窗口
    });

    // 日志清空功能
    document.getElementById('mp-popup-clear-logs-btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
            await Logger.clearLogs();
            alert('Logs cleared successfully');
            window.close();
        }
    });
});

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateList") {
        console.log("updateList message received in popup.js");
        displayRecords();
    }
});

document.getElementById("mp-popup-screenshot-btn").addEventListener("click", () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        console.log("screenshotBtn clicked in popup.js");
        chrome.tabs.sendMessage(tabs[0].id, {action: "startScreenshot"});
    });
    window.close();
});
