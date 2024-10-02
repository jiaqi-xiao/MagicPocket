function createFloatingWindow() {
    console.log("Creating floating window");
    floatingWindow = document.createElement("div");
    floatingWindow.className = "floating-window";
    floatingWindow.textContent = "📌";
    document.body.appendChild(floatingWindow);

    floatingWindow.addEventListener("mouseover", showRecordedItems);
    floatingWindow.addEventListener("click", toggleLists);
}

function toggleLists() {
    console.log("FloatingWindow Toggling lists");
}

function showRecordedItems() {
    console.log("FloatingWindow Showing recorded items");

    // 创建或获取显示记录的容器
    let recordsContainer = document.getElementById("floatingRecordsContainer");
    if (!recordsContainer) {
        recordsContainer = document.createElement("div");
        recordsContainer.id = "floatingRecordsContainer";
        recordsContainer.style.position = "fixed";
        recordsContainer.style.bottom = "60px";
        recordsContainer.style.right = "20px";
        recordsContainer.style.backgroundColor = "#fff";
        recordsContainer.style.color = "#333";
        recordsContainer.style.border = "1px solid #ccc";
        recordsContainer.style.padding = "10px";
        recordsContainer.style.borderRadius = "4px";
        recordsContainer.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
        recordsContainer.style.zIndex = "1000";
        document.body.appendChild(recordsContainer);

        let floatingWindow = document.getElementById("floatingWindow");

        // // 添加鼠标移开事件监听器
        // recordsContainer.addEventListener("mouseleave", () => {
        //     recordsContainer.style.display = "none";
        // });
    }

    // 显示记录容器和浮动窗口
    recordsContainer.style.display = "block";
    floatingWindow.style.display = "block";

    // 清空容器内容
    recordsContainer.innerHTML = "";

    // 获取记录并显示
    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];

        console.log("records numbers: ", records.length);

        const renderRecords = () => {
            recordsContainer.innerHTML = "";
            if (records.length === 0) {
                recordsContainer.innerHTML = "<p>No records</p>";
            } else {
                records.forEach((record, index) => {
                    const item = document.createElement("div");
                    item.className = "record-item";
                    item.innerHTML = `
              <strong>${record.type === "text" ? "Text" : "Image"}</strong>
              <p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>
              ${record.comment ? `<p class="comment" style="font-size: 0.9em; color: #666;">Comment: ${record.comment}</p>` : ''}
              <small>${new Date(record.timestamp).toLocaleString()}</small>
              <button class="delete-btn" data-index="${index}">Delete</button>
            `;
                    item.addEventListener("click", (e) => {
                        if (!e.target.classList.contains("delete-btn")) {
                            const url = chrome.runtime.getURL(`records.html?index=${index}`);
                            // window.location.href = url;
                            window.open(url, "_blank");
                        }
                    });
                    recordsContainer.appendChild(item);
                });

                // clearAllBtn
                const clearAllBtn = document.createElement("button");
                clearAllBtn.id = "clearAllBtn";
                clearAllBtn.textContent = "Clear All";
                recordsContainer.appendChild(clearAllBtn);

                // startGenerateBtn
                const startGenerateBtn = document.createElement("button");
                startGenerateBtn.id = "startGenerateBtn";
                startGenerateBtn.textContent = "Start Generation";
                recordsContainer.appendChild(startGenerateBtn);

                startGenerateBtn.addEventListener("click", () => {
                    const url = chrome.runtime.getURL(`start_generation.html`);
                    window.open(url, "_blank");
                });

                // showIntentBtn
                const showIntentBtn = document.createElement("button");
                showIntentBtn.id = "showIntentBtn";
                showIntentBtn.textContent = "Show Intent";
                recordsContainer.appendChild(showIntentBtn);

                showIntentBtn.addEventListener("click", () => {
                    clickUserIntentBtn();
                });

                clearAllBtn.addEventListener("click", () => {
                    // chrome.storage.local.set({ records: [] }, () => {
                    //     showRecordedItems();
                    // });
                    chrome.storage.local.clear(() => {
                        showRecordedItems();
                        console.log("Storage cleared");
                    });
                });

                recordsContainer.addEventListener("click", (e) => {
                    if (e.target.classList.contains("delete-btn")) {
                        const index = parseInt(e.target.getAttribute("data-index"));
                        deleteRecord(index).then(() => {
                            records.splice(index, 1);
                            renderRecords();
                        });
                    }
                });
            }
            if (isIntentVisible) {
                // showUserIntentVisualization();
                renderIntentVisualization(gIntentDataList);
            }

        };

        renderRecords();
    });

    // 添加鼠标移开事件监听器
    let hideTimeout;
    const hideContainers = () => {
        hideTimeout = setTimeout(() => {
            // recordsContainer.style.display = "none";
            if (!isAnalysisIntent) {
                console.log("isAnalysisIntent", isAnalysisIntent);
                recordsContainer.style.display = "none";
            }
        }, 200);
    };

    const cancelHide = () => {
        clearTimeout(hideTimeout);
    };

    recordsContainer.addEventListener("mouseleave", hideContainers);
    floatingWindow.addEventListener("mouseleave", hideContainers);
    recordsContainer.addEventListener("mouseenter", cancelHide);
    floatingWindow.addEventListener("mouseenter", cancelHide);
}