document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const index = parseInt(urlParams.get("index"));

    chrome.storage.sync.get("records", (data) => {
        const records = data.records || [];
        const recordsList = document.getElementById("recordsList");
        const recordDetails = document.getElementById("recordDetails");

        recordsList.innerHTML = "";
        records.forEach((record, i) => {
            const item = document.createElement("li");
            item.textContent = `${record.type === "text" ? "Text" : "Screenshot"} - ${new Date(record.timestamp).toLocaleString()}`;
            item.addEventListener("click", () => {
                displayRecordDetails(record, item);
            });
            recordsList.appendChild(item);
        });

        if (index >= 0 && index < records.length) {
            displayRecordDetails(records[index], recordsList.children[index]);
        }
    });

    function displayRecordDetails(record, selectedItem) {
        // Clear background color of all items
        const items = document.querySelectorAll("#recordsList li");
        items.forEach(item => item.style.backgroundColor = "");

        // Set background color of the selected item
        selectedItem.style.backgroundColor = "gray";

        document.getElementById("recordTime").textContent = new Date(record.timestamp).toLocaleString();
        document.getElementById("recordText").textContent = record.content;
        document.getElementById("recordParagraph").textContent = record.paragraph;
        document.getElementById("recordComment").textContent = record.comment || "--";
    }
});