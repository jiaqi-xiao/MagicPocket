let visJsLoaded = false;

// FloatingWindow核心类
class FloatingWindow {
    constructor() {
        this.element = null;
        this.containers = new Map(); // 存储所有容器
        this.isVisible = false;
        this.networkManager = null; // 添加 networkManager 属性
        this.init();
    }

    init() {
        console.log("Initializing floating window");
        this.element = document.createElement("div");
        this.element.className = "floating-window";
        this.element.textContent = "📌";
        document.body.appendChild(this.element);

        // 创建容器管理区域
        this.containerArea = document.createElement("div");
        this.containerArea.className = "floating-container-area";
        this.setupContainerAreaStyle();
        document.body.appendChild(this.containerArea);

        // 添加主容器（包含任务和记录）
        const mainContainer = this.addContainer("main", {
            title: "Magic Pocket",
            height: "70vh"
        });
        
        // 初始化主容器内容
        this.initializeMainContainer(mainContainer.getContent());

        this.setupEventListeners();
    }

    setupContainerAreaStyle() {
        Object.assign(this.containerArea.style, {
            position: "fixed",
            bottom: "60px",
            right: "20px",
            display: "none",
            zIndex: "1000",
            minWidth: "400px",
            maxWidth: "600px",
            width: "40vw",
            backgroundColor: "transparent",
            gap: "10px",
            maxHeight: "80vh",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "4px",
            borderRadius: "16px",
            scrollbarWidth: "thin",
            scrollbarColor: "#CBD5E0 transparent"
        });
    }

    setupEventListeners() {
        // 鼠标悬停事件
        this.element.addEventListener("mouseover", () => this.showContainers());
        this.element.addEventListener("mouseleave", () => this.handleMouseLeave());
        this.containerArea.addEventListener("mouseenter", () => this.cancelHide());
        this.containerArea.addEventListener("mouseleave", () => this.handleMouseLeave());
    }

    // 添加新容器
    addContainer(id, config) {
        const container = new FloatingContainer(id, config);
        this.containers.set(id, container);
        this.containerArea.appendChild(container.element);
        this.updateLayout();
        return container;
    }

    // 移除容器
    removeContainer(id) {
        const container = this.containers.get(id);
        
        if (container) {
            console.log("Removing container:", id);
            container.element.remove();
            this.containers.delete(id);
            this.updateLayout();
        }
    }

    // 更新容器布局
    updateLayout() {
        this.containers.forEach(container => {
            container.element.style.display = "block";
        });
    }

    showContainers() {
        this.isVisible = true;
        this.containerArea.style.display = "block";
        this.containers.forEach(container => {
            container.show();
            // 如果是主容器，更新记录列表
            if (container.id === 'main') {
                const scrollArea = document.getElementById('recordsScrollArea');
                if (scrollArea) {
                    const buttonArea = scrollArea.nextElementSibling.querySelector('div');
                    updateRecordsList(scrollArea, buttonArea);
                }
                this.updateTaskDescription();
            }
        });
    }

    hideContainers() {
        this.isVisible = false;
        this.containerArea.style.display = "none";
        this.containers.forEach(container => container.hide());
    }

    handleMouseLeave() {
        this.hideTimeout = setTimeout(() => {
            if (!this.isAnalysisMode()) {
                this.hideContainers();
            }
        }, 200);
    }

    cancelHide() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
    }

    isAnalysisMode() {
        // 检查是否处于分析模式(可以从外部设置)
        return window.isAnalysisIntent || false;
    }

    // 初始化主容器
    initializeMainContainer(container) {
        // 创建任务描述区域
        const taskArea = document.createElement("div");
        Object.assign(taskArea.style, {
            padding: "12px 16px",
            borderBottom: "1px solid #edf2f7",
            backgroundColor: "#f8fafc",
            flexShrink: 0  // 防止任务区域被压缩
        });

        const taskDescription = document.createElement("div");
        taskDescription.id = "currentTaskDescription";
        Object.assign(taskDescription.style, {
            fontSize: "14px",
            color: "#4a5568",
            lineHeight: "1.5"
        });

        // 从storage获取并显示当前任务描述
        chrome.storage.local.get("currentTask", (data) => {
            if (data.currentTask && data.currentTask.description) {
                taskDescription.textContent = `📋 ${data.currentTask.description}`;
            } else {
                taskDescription.textContent = "📋 No active task";
                taskDescription.style.color = "#a0aec0";
                taskDescription.style.fontStyle = "italic";
            }
        });

        taskArea.appendChild(taskDescription);
        container.appendChild(taskArea);

        // 创建记录区域，设置为flex容器并占据剩余空间
        const recordsArea = document.createElement("div");
        Object.assign(recordsArea.style, {
            flex: "1",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,  // 关键：允许flex子项小于内容高度
            height: "100%"  // 确保占据剩余空间
        });
        container.appendChild(recordsArea);

        // 初始化记录容器
        initializeRecordsContainer(recordsArea);
    }

    updateTaskDescription() {
        const taskDescription = document.getElementById("currentTaskDescription");
        if (taskDescription) {
            chrome.storage.local.get("currentTask", (data) => {
                if (data.currentTask && data.currentTask.description) {
                    taskDescription.textContent = `📋 ${data.currentTask.description}`;
                    taskDescription.style.color = "#4a5568";
                    taskDescription.style.fontStyle = "normal";
                } else {
                    taskDescription.textContent = "📋 No active task";
                    taskDescription.style.color = "#a0aec0";
                    taskDescription.style.fontStyle = "italic";
                }
            });
        }
    }
}

// 单个浮动容器类
class FloatingContainer {
    constructor(id, config) {
        this.id = id;
        this.config = {
            title: config.title || "",
            width: config.width || "300px",
            height: config.height || "auto",
            position: config.position || "right",
            ...config
        };
        this.element = this.createContainer();
    }

    createContainer() {
        const container = document.createElement("div");
        container.className = `floating-container ${this.id}-container`;
        this.setupContainerStyle(container);
        
        // 添加标题栏
        if (this.config.title) {
            const titleBar = this.createTitleBar();
            container.appendChild(titleBar);
        }

        // 添加内容区域
        const content = document.createElement("div");
        content.className = "container-content";
        Object.assign(content.style, {
            height: "calc(100% - 40px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
        });
        container.appendChild(content);

        return container;
    }

    setupContainerStyle(container) {
        Object.assign(container.style, {
            position: "relative",
            width: "100%",
            height: this.config.height,
            backgroundColor: "#fff",
            borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            transition: "all 0.3s ease",
            marginBottom: "12px",
            border: "1px solid rgba(226, 232, 240, 0.8)"
        });
    }

    createTitleBar() {
        const titleBar = document.createElement("div");
        titleBar.className = "container-title-bar";
        Object.assign(titleBar.style, {
            padding: "12px 16px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #edf2f7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "48px"
        });

        const titleWrapper = document.createElement("div");
        titleWrapper.style.display = "flex";
        titleWrapper.style.alignItems = "center";
        titleWrapper.style.gap = "8px";

        const icon = document.createElement("span");
        icon.textContent = this.getContainerIcon();
        icon.style.fontSize = "16px";

        const title = document.createElement("span");
        title.textContent = this.config.title;
        title.style.fontWeight = "600";
        title.style.fontSize = "14px";
        title.style.color = "#2d3748";

        titleWrapper.appendChild(icon);
        titleWrapper.appendChild(title);
        titleBar.appendChild(titleWrapper);

        const controls = this.createControls();
        titleBar.appendChild(controls);

        return titleBar;
    }

    getContainerIcon() {
        // 根据容器类型返回相应的图标
        const icons = {
            records: "📝",
            network: "🔗",
            intent: "🎯",
            default: "📌"
        };
        return icons[this.id] || icons.default;
    }

    createControls() {
        const controls = document.createElement("div");
        controls.className = "container-controls";
        Object.assign(controls.style, {
            display: "flex",
            gap: "8px"
        });

        const sidebarBtn = this.createSidebarButton();
        controls.appendChild(sidebarBtn);

        return controls;
    }

    createSidebarButton() {
        const button = document.createElement("button");
        Object.assign(button.style, {
            background: "transparent",
            border: "none",
            borderRadius: "6px",
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#718096",
            transition: "all 0.2s ease",
            padding: "0"
        });

        // 创建SVG图标
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M21 12H8M21 12L15 6M21 12l-6 6"/>
            </svg>
        `;
        
        // 添加悬停效果
        button.addEventListener("mouseover", () => {
            button.style.backgroundColor = "#f7fafc";
            button.style.color = "#4a5568";
        });
        
        button.addEventListener("mouseout", () => {
            button.style.backgroundColor = "transparent";
            button.style.color = "#718096";
        });

        // 添加点击事件
        button.addEventListener("click", async () => {
            if (isNetworkVisible) {
                isNetworkVisible = false;
                if (this.networkManager) {
                    this.networkManager.cleanup(); // 使用 this.networkManager
                }
            } else {
                try {
                    await loadVisJs();
                    chrome.storage.local.get("records", (data) => {
                        const records = data.records || [];
                        this.networkManager = showNetworkVisualization(records, floatingWindow.containerArea);
                    });
                } catch (error) {
                    console.error('Failed to load visualization:', error);
                    alert('Failed to load network visualization.');
                }
            }
        });

        return button;
    }

    show() {
        this.element.style.display = "block";
    }

    hide() {
        this.element.style.display = "none";
    }

    getContent() {
        return this.element.querySelector(".container-content");
    }
}

// 初始化FloatingWindow
let floatingWindow = null;

function createFloatingWindow() {
    if (!floatingWindow) {
        floatingWindow = new FloatingWindow();
    }
    return floatingWindow;
}

// 初始化Records容器的内容
function initializeRecordsContainer(container) {
    // 创建滚动区域
    const scrollArea = document.createElement("div");
    scrollArea.id = "recordsScrollArea";
    Object.assign(scrollArea.style, {
        flex: "1",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "10px",
        marginBottom: "10px",
        minHeight: 0  // 关键：允许flex子项小于内容高度
    });
    container.appendChild(scrollArea);

    // 创建按钮区域容器
    const buttonContainer = document.createElement("div");
    Object.assign(buttonContainer.style, {
        flexShrink: 0,  // 防止按钮区域被压缩
        borderTop: "1px solid #eee"
    });
    container.appendChild(buttonContainer);

    // 创建两个按钮区域
    const buttonArea = document.createElement("div");
    setupButtonArea(buttonArea);
    buttonContainer.appendChild(buttonArea);

    const buttonArea2 = document.createElement("div");
    setupButtonArea(buttonArea2);
    buttonContainer.appendChild(buttonArea2);

    // 添加网络可视化按钮
    const showNetworkBtn = createButton("Show Network", "showNetworkBtn");
    buttonArea2.appendChild(showNetworkBtn);

    // 更新记录显示
    updateRecordsList(scrollArea, buttonArea);
}

function setupButtonArea(buttonArea) {
    Object.assign(buttonArea.style, {
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        borderTop: "1px solid #edf2f7",
        gap: "8px"
    });
}

function createButton(text, id) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    Object.assign(button.style, {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "none",
        fontSize: "13px",
        fontWeight: "500",
        cursor: "pointer",
        transition: "all 0.2s ease",
        backgroundColor: getButtonColor(id),
        color: getButtonTextColor(id)
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
        showNetworkBtn: "#F0FFF4"
    };
    return colors[id] || "#EDF2F7";
}

function getButtonTextColor(id) {
    const colors = {
        clearAllBtn: "#E53E3E",
        startGenerateBtn: "#319795",
        showIntentBtn: "#3182CE",
        showNetworkBtn: "#38A169"
    };
    return colors[id] || "#4A5568";
}

function updateRecordsList(scrollArea, buttonArea) {
    chrome.storage.local.get("records", async (data) => {
        const records = data.records || [];
        console.log("records numbers: ", records.length);

        // 清空容器内容
        scrollArea.innerHTML = "";

        // 添加按钮到按钮区域
        buttonArea.innerHTML = "";
        const clearAllBtn = createButton("Clear All", "clearAllBtn");
        const startGenerateBtn = createButton("Start Generation", "startGenerateBtn");
        const showIntentBtn = createButton("Show Intent", "showIntentBtn");

        buttonArea.appendChild(clearAllBtn);
        buttonArea.appendChild(startGenerateBtn);
        buttonArea.appendChild(showIntentBtn);

        // 设置按钮事件监听器
        setupButtonListeners(clearAllBtn, startGenerateBtn, showIntentBtn);

        // 渲染记录
        await renderRecords(records, scrollArea);

        // // 设置网络可视化按钮事件
        // const showNetworkBtn = document.getElementById("showNetworkBtn");
        // if (showNetworkBtn) {
        //     showNetworkBtn.addEventListener("click", async () => {
        //         try {
        //             await loadVisJs();
        //             chrome.storage.local.get("records", (data) => {
        //                 const records = data.records || [];
        //                 // Use integrated mode when clicking from floating window
        //                 showNetworkVisualization(records, floatingWindow.containerArea);
        //             });
        //         } catch (error) {
        //             console.error('Failed to load visualization:', error);
        //             alert('Failed to load network visualization.');
        //         }
        //     });
        // }
    });
}

async function renderRecords(records, scrollArea) {
    if (records.length === 0) {
        scrollArea.innerHTML = "<p>No records</p>";
        return;
    }

    await Promise.all(records.map(async (record, index) => {
        const item = document.createElement("div");
        item.className = "record-item";
        
        // 根据记录类型生成不同的内容显示
        let contentHtml = '';
        if (record.type === "text") {
            contentHtml = `<p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>`;
        } else if (record.type === "image") {
            const imageData = await imageStorage.getImage(record.content);
            const tempImg = new Image();
            tempImg.src = imageData;
            await new Promise(resolve => tempImg.onload = resolve);
            
            const maxWidth = 200;
            const maxHeight = 150;
            let width = tempImg.width;
            let height = tempImg.height;
            
            if (width <= maxWidth && height <= maxHeight) {
                contentHtml = createImagePreview(imageData, width, height);
            } else {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
                contentHtml = createImagePreview(imageData, width, height);
            }
        }

        item.innerHTML = createRecordItemHtml(record, contentHtml, index);
        setupRecordItemEvents(item, index);
        scrollArea.appendChild(item);
    }));
}

function createImagePreview(imageData, width, height) {
    return `
        <div class="image-preview" style="display: flex; justify-content: center; align-items: center; padding: 5px; width: 100%;">
            <img src="${imageData}" alt="Screenshot" 
                style="max-width: 100%; height: auto; object-fit: contain; border: 1px solid #eee;">
        </div>
    `;
}

function createRecordItemHtml(record, contentHtml, index) {
    return `
        <div class="record-item-content">
            ${contentHtml}
            ${record.comment ? `<p class="comment">${record.comment}</p>` : ''}
        </div>
        <div class="record-item-meta">
            <div class="record-item-info">
                <span class="record-type">${record.type === "text" ? "Text" : "Image"}</span>
                <span class="record-time">${new Date(record.timestamp).toLocaleString()}</span>
            </div>
            <button class="delete-btn" data-index="${index}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
            </button>
        </div>
    `;
}

function setupRecordItemEvents(item, index) {
    item.addEventListener("click", (e) => {
        if (e.target.closest('.delete-btn')) {
            e.stopPropagation();
            deleteRecord(index).then(() => {
                const scrollArea = item.closest('.container-content').querySelector('div');
                const buttonArea = scrollArea.nextElementSibling.querySelector('div');
                updateRecordsList(scrollArea, buttonArea);
            });
        } else {
            const url = chrome.runtime.getURL(`records.html?index=${index}`);
            window.open(url, "_blank");
        }
    });
}

async function deleteRecord(index) {
    return new Promise((resolve) => {
        chrome.storage.local.get("records", (data) => {
            const records = data.records || [];
            records.splice(index, 1);
            chrome.storage.local.set({ records: records }, () => {
                console.log("Record deleted at index:", index);
                resolve();
            });
        });
    });
}

function setupButtonListeners(clearAllBtn, startGenerateBtn, showIntentBtn) {
    startGenerateBtn.addEventListener("click", () => {
        const url = chrome.runtime.getURL(`start_generation.html`);
        window.open(url, "_blank");
    });

    showIntentBtn.addEventListener("click", () => {
        clickUserIntentBtn();
    });

    clearAllBtn.addEventListener("click", () => {
        chrome.storage.local.clear(() => {
            updateRecordsList(
                document.querySelector(".records-container .container-content > div"),
                document.querySelector(".records-container .container-content > div:nth-child(2)")
            );
            console.log("Storage cleared");
        });
    });

    // const showNetworkBtn = document.getElementById("showNetworkBtn");
    // if (showNetworkBtn) {
    //     showNetworkBtn.addEventListener("click", async () => {
    //         try {
    //             await loadVisJs();
    //             chrome.storage.local.get("records", (data) => {
    //                 const records = data.records || [];
    //                 // Use integrated mode when clicking from floating window
    //                 showNetworkVisualization(records, floatingWindow.containerArea);
    //             });
    //         } catch (error) {
    //             console.error('Failed to load visualization:', error);
    //             alert('Failed to load network visualization.');
    //         }
    //     });
    // }
}

async function loadVisJs() {
    if (visJsLoaded) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.type = 'text/css';
        cssLink.href = chrome.runtime.getURL('lib/vis-network.css');
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('lib/vis-network.js');
        script.onload = () => {
            visJsLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 更新样式

const additionalNetworkStyle = document.createElement('style');
additionalNetworkStyle.textContent = `
    .floating-container-area {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 12px;
        padding: 4px;
    }

    #networkVisualizationContainer {
        min-height: 400px;
    }

    .records-container {
        flex: 1;
        min-width: 0; // Prevent flex item from overflowing
    }
`;
document.head.appendChild(additionalNetworkStyle);


const style = document.createElement('style');
style.textContent = `
    .floating-container {
        display: flex;
        flex-direction: column;
        float: left;
    }

    .container-content {
        display: flex;
        flex-direction: column;
    }

    .record-item {
        background: #fff;
        border-radius: 12px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        transition: all 0.2s ease;
        overflow: hidden;
    }

    .record-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.12);
    }

    .record-item-content {
        padding: 16px;
        width: 100%;
        box-sizing: border-box;
    }

    .record-item-content p {
        margin: 0;
        color: #2c3e50;
        line-height: 1.5;
        font-size: 14px;
        word-wrap: break-word;
        white-space: pre-wrap;
    }

    .record-item-content .comment {
        margin-top: 8px;
        padding: 8px;
        background-color: #f8f9fa;
        border-radius: 6px;
        color: #666;
        font-size: 13px;
        line-height: 1.4;
    }

    .record-item-meta {
        padding: 8px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f8f9fa;
        border-top: 1px solid #edf2f7;
        flex-wrap: wrap;
        gap: 8px;
    }

    .record-item-info {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: #718096;
        flex-wrap: wrap;
    }

    .record-type {
        background-color: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
    }

    .record-time {
        color: #a0aec0;
    }

    .delete-btn {
        background-color: transparent;
        color: #718096;
        border: none;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .delete-btn:hover {
        background-color: #fee2e2;
        color: #ef4444;
    }

    .image-preview {
        margin: 0;
        border-radius: 8px;
        overflow: hidden;
    }

    .image-preview img {
        display: block;
        max-width: 100%;
        height: auto;
        object-fit: contain;
        margin: 0 auto;
    }

    @media screen and (max-width: 768px) {
        .floating-container-area {
            width: 90vw;
            minWidth: 320px;
            overflow: hidden;
        }
    }
`;
document.head.appendChild(style);

// 添加新的全局样式
const additionalStyle = document.createElement('style');
additionalStyle.textContent = `
    .floating-container-area::-webkit-scrollbar {
        width: 6px;
    }

    .floating-container-area::-webkit-scrollbar-track {
        background: transparent;
    }

    .floating-container-area::-webkit-scrollbar-thumb {
        background-color: #CBD5E0;
        border-radius: 3px;
    }

    .floating-container-area::-webkit-scrollbar-thumb:hover {
        background-color: #A0AEC0;
    }

    .container-content::-webkit-scrollbar {
        width: 6px;
    }

    .container-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .container-content::-webkit-scrollbar-thumb {
        background-color: #CBD5E0;
        border-radius: 3px;
    }

    .container-content::-webkit-scrollbar-thumb:hover {
        background-color: #A0AEC0;
    }
`;
document.head.appendChild(additionalStyle);
