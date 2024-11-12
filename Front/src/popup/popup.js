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
    // displayRecords();

    // document.getElementById("recordsList").addEventListener("click", (e) => {
    //     if (e.target.classList.contains("delete-btn")) {
    //         const index = parseInt(e.target.getAttribute("data-index"));
    //         deleteRecord(index);
    //     }
    // });
});

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateList") {
        console.log("updateList message received in popup.js");
        displayRecords();
    }
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
    chrome.storage.local.set({ records: [] }, () => {
        displayRecords();
    });
});

document.getElementById("screenshotBtn").addEventListener("click", () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        console.log("screenshotBtn clicked in popup.js");
        chrome.tabs.sendMessage(tabs[0].id, {action: "startScreenshot"});
    });
    window.close(); // 关闭popup窗口
});
