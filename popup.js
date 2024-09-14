// popup.js

function displayRecords() {
    chrome.storage.sync.get("records", (data) => {
        const records = data.records || [];
        const recordsList = document.getElementById("recordsList");
        recordsList.innerHTML = "";

        if (records.length === 0) {
            recordsList.innerHTML = "<p>No items saved yet.</p>";
        } else {
            records.forEach((record, index) => {
                const item = document.createElement("div");
                item.className = "record-item";
                item.innerHTML = `
            <strong>${record.type === "text" ? "Text" : "Screenshot"}</strong>
            <p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>
            <small>${new Date(record.timestamp).toLocaleString()}</small>
            <button class="delete-btn" data-index="${index}">Delete</button>
          `;
                recordsList.appendChild(item);
            });
        }
    });
}

function deleteRecord(index) {
    chrome.storage.sync.get("records", (data) => {
        const records = data.records || [];
        records.splice(index, 1);
        chrome.storage.sync.set({ records: records }, () => {
            displayRecords();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    displayRecords();

    document.getElementById("recordsList").addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn")) {
            const index = parseInt(e.target.getAttribute("data-index"));
            deleteRecord(index);
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

document.getElementById("clearAllBtn").addEventListener("click", () => {
    chrome.storage.sync.set({ records: [] }, () => {
        displayRecords();
    });
});