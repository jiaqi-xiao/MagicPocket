let selectedText = "";
let contextMenu = null;
let isIntentVisible = false;
let isNetworkVisible = false;

function initializeExtension() {
    console.log("Initializing extension");
    createFloatingWindow();
    addGlobalEventListeners();
}

function addGlobalEventListeners() {
    console.log("Adding global event listeners");
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleGlobalMouseDown);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScreenshot") {
        initScreenshot();
    }
});

// 添加用于向侧边栏发送数据的函数
function updateSidePanel(data, type) {
    chrome.runtime.sendMessage({
        action: type === 'intent' ? 'updateIntentGraph' : 'updateNetworkGraph',
        data: data,
        target: 'sidePanel'
    });
}

// 在现有的可视化更新函数中添加对侧边栏的更新
function updateVisualizations(intentData, networkData) {
    if (intentData) {
        // 更新浮动窗口的意图可视化
        if (window.updateIntentVisualization) {
            window.updateIntentVisualization(intentData);
        }
        
        // 更新侧边栏的意图可视化
        updateSidePanel(intentData, 'intent');
    }
    
    if (networkData) {
        // 更新浮动窗口的网络可视化
        if (window.updateNetworkVisualization) {
            window.updateNetworkVisualization(networkData);
        }
        
        // 更新侧边栏的网络可视化
        updateSidePanel(networkData, 'network');
    }
}

// 添加消息监听器，用于接收来自侧边栏的请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "requestCurrentData") {
        // 发送当前的可视化数据到侧边栏
        if (window.getCurrentIntentData) {
            updateSidePanel(window.getCurrentIntentData(), 'intent');
        }
        if (window.getCurrentNetworkData) {
            updateSidePanel(window.getCurrentNetworkData(), 'network');
        }
    }
});
