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
        recordsContainer.style.borderRadius = "4px";
        recordsContainer.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
        recordsContainer.style.zIndex = "1000";
        recordsContainer.style.height = "70vh";
        recordsContainer.style.maxWidth = "50vh";
        recordsContainer.style.display = "flex";
        recordsContainer.style.flexDirection = "column";
        document.body.appendChild(recordsContainer);

        let floatingWindow = document.getElementById("floatingWindow");
    }

    // 显示记录容器和浮动窗口
    recordsContainer.style.display = "flex";
    floatingWindow.style.display = "block";

    // 清空容器内容
    recordsContainer.innerHTML = "";

    // 创建滚动区域
    const scrollArea = document.createElement("div");
    scrollArea.style.overflowY = "auto";
    scrollArea.style.flex = "1";
    scrollArea.style.padding = "10px";

    // 创建按钮区域
    const buttonArea = document.createElement("div");
    buttonArea.style.padding = "10px";
    buttonArea.style.borderTop = "1px solid #ccc";
    buttonArea.style.display = "flex";
    buttonArea.style.justifyContent = "space-between";

    recordsContainer.appendChild(scrollArea);
    recordsContainer.appendChild(buttonArea);

    // 获取记录并显示
    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];

        console.log("records numbers: ", records.length);

        const renderRecords = () => {
            scrollArea.innerHTML = "";
            if (records.length === 0) {
                scrollArea.innerHTML = "<p>No records</p>";
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
                            window.open(url, "_blank");
                        }
                    });
                    scrollArea.appendChild(item);
                });

                // 清空按钮区域
                buttonArea.innerHTML = "";

                // 添加按钮到按钮区域
                const clearAllBtn = createButton("Clear All", "clearAllBtn");
                const startGenerateBtn = createButton("Start Generation", "startGenerateBtn");
                const showIntentBtn = createButton("Show Intent", "showIntentBtn");

                buttonArea.appendChild(clearAllBtn);
                buttonArea.appendChild(startGenerateBtn);
                buttonArea.appendChild(showIntentBtn);

                startGenerateBtn.addEventListener("click", () => {
                    const url = chrome.runtime.getURL(`start_generation.html`);
                    window.open(url, "_blank");
                });

                showIntentBtn.addEventListener("click", () => {
                    clickUserIntentBtn();
                });

                clearAllBtn.addEventListener("click", () => {
                    chrome.storage.local.clear(() => {
                        showRecordedItems();
                        console.log("Storage cleared");
                    });
                });

                scrollArea.addEventListener("click", (e) => {
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
                renderIntentVisualization(gIntentDataList);
            }
        };

        renderRecords();

        // 添加删除单条记录的事件监听器
        scrollArea.addEventListener("click", (e) => {
            if (e.target.classList.contains("delete-btn")) {
                const index = parseInt(e.target.getAttribute("data-index"));
                deleteRecord(index).then(() => {
                    records.splice(index, 1);
                    renderRecords();
                });
            }
        });
    });

    // 添加鼠标移开事件监听器
    let hideTimeout;
    const hideContainers = () => {
        hideTimeout = setTimeout(() => {
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

function createButton(text, id) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    return button;
}