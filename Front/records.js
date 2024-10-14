document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const index = parseInt(urlParams.get("index"));

    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];
        const recordsList = document.getElementById("recordsList");
        const recordDetails = document.getElementById("recordDetails");

        recordsList.innerHTML = "";
        records.forEach((record, i) => {
            const item = document.createElement("li");
            const date = new Date(record.timestamp);
            const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            item.textContent = `${record.type === "text" ? "Text" : "Image"} - ${formattedDate}`;
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
        const items = document.querySelectorAll("#recordsList li");
        items.forEach(item => item.classList.remove("selected"));
        selectedItem.classList.add("selected");

        document.getElementById("recordTime").textContent = new Date(record.timestamp).toLocaleString();
        document.getElementById("recordText").textContent = record.content;
        document.getElementById("recordParagraph").textContent = record.paragraph;
        document.getElementById("recordComment").textContent = record.comment || "--";
        document.getElementById("recordUrl").textContent = record.url;
        document.getElementById("recordId").textContent = record.id;
        document.getElementById("placeFormattedAddress").textContent = record.extraGMLocationContext.PlaceFormattedAddress || "--";
        document.getElementById("placeEditorialSummary").textContent = record.extraGMLocationContext.PlaceEditorialSummary || "--";
    }
});