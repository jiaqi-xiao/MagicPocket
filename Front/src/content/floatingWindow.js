let visJsLoaded = false;

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

    // 在 buttonArea 后添加第二行按钮区域
    const buttonArea2 = document.createElement("div");
    buttonArea2.style.padding = "10px";
    buttonArea2.style.borderTop = "1px solid #ccc";
    buttonArea2.style.display = "flex";
    buttonArea2.style.justifyContent = "space-between";

    recordsContainer.appendChild(buttonArea2);

    // 在渲染记录的部分，添加新按钮
    const showNetworkBtn = createButton("Show Network", "showNetworkBtn");
    showNetworkBtn.style.backgroundColor = "#81ecec"; // 使用与网络节点相同的颜色
    showNetworkBtn.style.color = "#333";
    showNetworkBtn.style.border = "1px solid #ccc";
    showNetworkBtn.style.borderRadius = "4px";
    showNetworkBtn.style.padding = "8px 12px";
    showNetworkBtn.style.cursor = "pointer";
    buttonArea2.appendChild(showNetworkBtn);

    showNetworkBtn.addEventListener("mouseover", () => {
        showNetworkBtn.style.backgroundColor = "#74c8c8"; // 悬停时稍微暗一点的颜色
    });

    showNetworkBtn.addEventListener("mouseout", () => {
        showNetworkBtn.style.backgroundColor = "#81ecec"; // 恢复原来的颜色
    });

    // 获取记录并显示
    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];

        console.log("records numbers: ", records.length);

        showNetworkBtn.addEventListener("click", async () => {
            if (!visJsLoaded) {
                await loadVisJs();
                visJsLoaded = true;
            }
            showNetworkVisualization(records);
        });

        const renderRecords = async () => {
            scrollArea.innerHTML = "";
            if (records.length === 0) {
                scrollArea.innerHTML = "<p>No records</p>";
            } else {
                await Promise.all(records.map(async (record, index) => {  // 这里也需要 async
                    const item = document.createElement("div");
                    item.className = "record-item";
                    
                    // 根据记录类型生成不同的内容显示
                    let contentHtml = '';
                    if (record.type === "text") {
                        contentHtml = `<p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>`;
                    } else if (record.type === "image") {
                        const imageData = await imageStorage.getImage(record.content);
                        // 创建一个临时图片对象来获取实际尺寸
                        const tempImg = new Image();
                        tempImg.src = imageData;
                        await new Promise(resolve => tempImg.onload = resolve);
                        
                        // 计算缩放比例，保持原始宽高比
                        const maxWidth = 200;  // 设置最大宽度
                        const maxHeight = 150; // 设置最大高度
                        let width = tempImg.width;
                        let height = tempImg.height;

                    //     contentHtml = `
                    //     <div class="image-preview" style="display: flex; justify-content: center; align-items: center; padding: 5px;">
                    //         <img src="${imageData}" alt="Screenshot" 
                    //             style="width: ${width}px; height: ${height}px; object-fit: contain; border: 1px solid #eee;">
                    //     </div>
                    // `;
                        
                        if (width <= maxWidth && height <= maxHeight) {
                            // 如果图片本身较小，直接使用原始尺寸
                            console.log("image small");
                            contentHtml = `
                                <div class="image-preview" style="display: flex; justify-content: center; align-items: center; padding: 5px;">
                                    <img src="${imageData}" alt="Screenshot" 
                                        style="width: ${width}px; height: ${height}px; object-fit: contain; border: 1px solid #eee;">
                                </div>
                            `;
                        } else {
                            // 如果图片较大，则等比例缩放
                            console.log("image large");
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width *= ratio;
                            height *= ratio;
                            contentHtml = `
                                <div class="image-preview" style="display: flex; justify-content: center; align-items: center; padding: 5px;">
                                    <img src="${imageData}" alt="Screenshot" 
                                        style="width: ${width}px; height: ${height}px; object-fit: contain; border: 1px solid #eee;">
                                </div>
                            `;
                        }
                    }

                    item.innerHTML = `
                        <strong>${record.type === "text" ? "Text" : "Image"}</strong>
                        ${contentHtml}
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
                }));

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

async function loadVisJs() {
    return new Promise((resolve, reject) => {
        // 加载 CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.type = 'text/css';
        cssLink.href = chrome.runtime.getURL('lib/vis-network.css');
        document.head.appendChild(cssLink);

        // 加载 JS
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('lib/vis-network.js');
        script.onload = () => {
            console.log('Vis.js loaded successfully');
            resolve();
        };
        script.onerror = (error) => {
            console.error('Error loading Vis.js:', error);
            reject(error);
        };
        document.head.appendChild(script);
    });
}
