let intentNetwork = null;
let networkGraph = null;
let networkManager = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeTaskDescription();
    initializeRecordsArea();
});

function initializeTaskDescription() {
    const taskDescription = document.getElementById("currentTaskDescription");
    chrome.storage.local.get("currentTask", (data) => {
        if (data.currentTask && data.currentTask.description) {
            taskDescription.textContent = `📋 ${data.currentTask.description}`;
        } else {
            taskDescription.textContent = "📋 No active task";
            taskDescription.style.color = "#a0aec0";
            taskDescription.style.fontStyle = "italic";
        }
    });

    // 监听任务更新
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.currentTask) {
            const newTask = changes.currentTask.newValue;
            if (newTask && newTask.description) {
                taskDescription.textContent = `📋 ${newTask.description}`;
                taskDescription.style.color = "#4a5568";
                taskDescription.style.fontStyle = "normal";
            } else {
                taskDescription.textContent = "📋 No active task";
                taskDescription.style.color = "#a0aec0";
                taskDescription.style.fontStyle = "italic";
            }
        }
    });
}

function initializeRecordsArea() {
    const scrollArea = document.getElementById("recordsScrollArea");
    const buttonArea = document.querySelector(".button-area");
    const buttonArea2 = document.querySelector(".button-area-2");

    // 创建按钮
    const clearAllBtn = createButton("Clear All", "clearAllBtn");
    const startGenerateBtn = createButton("Start Generation", "startGenerateBtn");
    const analyzeBtn = createButton("Analyze", "analyzeBtn");

    // 添加按钮到按钮区域
    buttonArea.appendChild(clearAllBtn);
    buttonArea.appendChild(startGenerateBtn);
    buttonArea.appendChild(analyzeBtn);

    // 设置按钮事件监听器
    clearAllBtn.addEventListener('click', () => {
        chrome.storage.local.set({ records: [] }, updateRecordsList);
        hideNetworkVisualization();
    });

    startGenerateBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/new_task/new_task.html') });
    });

    analyzeBtn.addEventListener('click', async () => {
        try {
            // 获取当前任务描述
            const taskDescription = await new Promise((resolve) => {
                chrome.storage.local.get("currentTask", (data) => {
                    resolve(data.currentTask?.description || "General Task");
                });
            });
            
            // 获取所有记录
            const records = await getRecords();

            if (!records.length) {
                alert('No records found to visualize.');
                return;
            }

            // 显示加载状态
            showLoadingState();

            // 调用后端 group_nodes API
            const groupResponse = await fetch('http://localhost:8000/group/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: records.map(record => ({
                        id: parseInt(record.id) || Date.now(),
                        content: record.content || "",
                        context: record.context || "",
                        comment: record.comment || "",
                        isLeafNode: true
                    }))
                })
            });

            if (!groupResponse.ok) {
                const errorData = await groupResponse.json();
                throw new Error(`Group API error (${groupResponse.status}): ${JSON.stringify(errorData.detail)}`);
            }
            
            const groupsOfNodes = await groupResponse.json();

            // 调用后端 construct API
            const constructResponse = await fetch('http://localhost:8000/construct/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scenario: taskDescription,
                    groupsOfNodes: groupsOfNodes,
                    target_level: 3
                })
            });
            
            if (!constructResponse.ok) {
                const errorData = await constructResponse.json();
                throw new Error(`Construct API error: ${JSON.stringify(errorData.detail)}`);
            }

            const intentTree = await constructResponse.json();
            if (!intentTree || !intentTree.item) {
                throw new Error('Invalid intent tree structure received from server');
            }

            // 添加场景信息
            intentTree.scenario = taskDescription;
            
            // 显示网络可视化容器
            showNetworkContainer();
            
            // 初始化或更新网络可视化
            if (!networkManager) {
                networkManager = window.showNetworkVisualization(
                    intentTree, 
                    document.getElementById('networkVisualizationContainer'),
                    'sidepanel'
                );
            } else {
                networkManager.updateData(intentTree);
            }
            
        } catch (error) {
            console.error('Visualization error:', error);
            alert(`无法加载网络可视化：${error.message}\n\n请确保：\n1. 后端服务器正在运行(http://localhost:8000)\n2. 没有网络连接问题\n3. 浏览器控制台中查看详细错误信息`);
            hideNetworkVisualization();
        } finally {
            hideLoadingState();
        }
    });

    // 初始化记录列表
    updateRecordsList();

    // 监听记录更新
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.records) {
            updateRecordsList();
        }
    });
}

function createButton(text, id) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    Object.assign(button.style, {
        padding: "6px 12px",
        borderRadius: "8px",
        border: "none",
        fontSize: "13px",
        fontWeight: "500",
        cursor: "pointer",
        transition: "all 0.2s ease",
        backgroundColor: getButtonColor(id),
        color: getButtonTextColor(id),
        height: "32px",
        lineHeight: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    });

    // 添加悬停效果
    button.addEventListener("mouseover", () => {
        button.style.filter = "brightness(0.95)";
        button.style.transform = "translateY(-1px)";
    });

    button.addEventListener("mouseout", () => {
        button.style.filter = "none";
        button.style.transform = "translateY(0)";
    });

    return button;
}

function getButtonColor(id) {
    const colors = {
        clearAllBtn: "#FEE2E2",
        startGenerateBtn: "#E6FFFA",
        showIntentBtn: "#EBF4FF",
        showNetworkBtn: "#F0FFF4",
        highlightTextBtn: "#FFF5F7"
    };
    return colors[id] || "#EDF2F7";
}

function getButtonTextColor(id) {
    const colors = {
        clearAllBtn: "#E53E3E",
        startGenerateBtn: "#319795",
        showIntentBtn: "#3182CE",
        showNetworkBtn: "#38A169",
        highlightTextBtn: "#D53F8C"
    };
    return colors[id] || "#4A5568";
}

async function updateRecordsList() {
    const scrollArea = document.getElementById("recordsScrollArea");
    const records = await getRecords();
    
    scrollArea.innerHTML = "";
    
    for (const record of records) {
        const item = document.createElement("div");
        item.className = "record-item";
        
        let contentHtml = '';
        if (record.type === "text") {
            contentHtml = `<p>${record.content}</p>`;
        } else if (record.type === "image") {
            try {
                const imageData = await imageStorage.getImage(record.content);
                contentHtml = `
                    <div class="image-preview">
                        <img src="${imageData}" alt="Screenshot">
                    </div>
                `;
            } catch (error) {
                console.warn('Error loading image:', error);
                contentHtml = '<p>Error loading image</p>';
            }
        }

        item.innerHTML = `
            <div class="record-item-content">
                ${contentHtml}
                ${record.comment ? `<div class="comment">${record.comment}</div>` : ''}
            </div>
            <div class="record-item-meta">
                <div class="record-item-info">
                    <button class="goto-page-btn" data-url="${record.url || ''}" title="Go to page">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                    <span class="record-time">${new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <button class="delete-btn" data-id="${record.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `;

        scrollArea.appendChild(item);

        // 添加跳转按钮事件监听器
        item.querySelector('.goto-page-btn').addEventListener('click', async (e) => {
            const url = e.currentTarget.dataset.url;
            if (!url) return;
            // 查找当前打开的标签页中是否有匹配的URL
            chrome.tabs.query({}, function(tabs) {
                // console.log(tabs);
                const existingTab = tabs.find(tab => tab.url === url);
                if (existingTab) {
                    chrome.tabs.update(existingTab.id, { active: true });
                    chrome.windows.update(existingTab.windowId, { focused: true });
                } else {
                    chrome.tabs.create({ url });
                }
            });
        });
    }

    // 添加删除按钮事件监听器
    scrollArea.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const records = await getRecords();
            const updatedRecords = records.filter(record => record.id !== id);
            await chrome.storage.local.set({ records: updatedRecords });
            updateRecordsList();
        });
    });
}

async function getRecords() {
    const data = await chrome.storage.local.get("records");
    return data.records || [];
}

function showNetworkContainer() {
    const container = document.getElementById('networkVisualizationContainer');
    container.classList.add('visible');
}

function hideNetworkVisualization() {
    if (networkManager) {
        networkManager.cleanup();
        networkManager = null;
    }
    const container = document.getElementById('networkVisualizationContainer');
    container.classList.remove('visible');
}

function showLoadingState() {
    const container = document.getElementById('networkVisualizationContainer');
    container.classList.add('visible');
    container.innerHTML = '<div class="loading">Loading visualization...</div>';
}

function hideLoadingState() {
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) {
        loadingEl.remove();
    }
}
