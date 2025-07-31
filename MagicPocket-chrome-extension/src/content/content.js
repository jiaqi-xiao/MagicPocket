let selectedText = "";
let contextMenu = null;
let isIntentVisible = false;
let isNetworkVisible = false;

function initializeExtension() {
    console.log("Initializing extension");
    console.log("Current URL:", window.location.href);
    console.log("NetworkVisualizationV2 available:", typeof window.showNetworkVisualizationV2);
    createFloatingWindow();
    addGlobalEventListeners();
}

function addGlobalEventListeners() {
    console.log("Adding global event listeners");
    
    // 使用事件委托，只处理非视频播放器区域的事件
    document.addEventListener("mouseup", (e) => {
        // 检查是否在视频播放器区域
        if (!e.target.closest('.xgplayer') && 
            !e.target.closest('video') && 
            !e.target.closest('.xgplayer-controls')) {
            handleMouseUp(e);
        }
    });
    
    document.addEventListener("mousedown", (e) => {
        // 检查是否在视频播放器区域
        if (!e.target.closest('.xgplayer') && 
            !e.target.closest('video') && 
            !e.target.closest('.xgplayer-controls')) {
            handleGlobalMouseDown(e);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Content script received message:', request);
    
    if (request.action === "startScreenshot") {
        initScreenshot();
    } else if (request.action === "showNetworkVisualizationV2") {
        console.log('Received V2 visualization request');
        showDevMultiLevelVisualization();
        sendResponse({success: true});
        return true; // 保持消息通道开启
    } else if (request.action === "requestCurrentData") {
        // 发送当前的可视化数据到侧边栏
        if (window.getCurrentIntentData) {
            updateSidePanel(window.getCurrentIntentData(), 'intent');
        }
        if (window.getCurrentNetworkData) {
            updateSidePanel(window.getCurrentNetworkData(), 'network');
        }
        sendResponse({success: true});
        return true;
    }
    });
}

// 添加用于向侧边栏发送数据的函数
function updateSidePanel(data, type) {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
            action: type === 'intent' ? 'updateIntentGraph' : 'updateNetworkGraph',
            data: data,
            target: 'sidePanel'
        });
    }
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

// 这个监听器已经合并到上面的主监听器中了

// V2多层网络可视化函数
async function showDevMultiLevelVisualization() {
    try {
        console.log('=== V2 Visualization Debug Start ===');
        console.log('1. Function called');
        
        // 检查vis.js是否加载
        console.log('2. Vis.js available:', typeof vis !== 'undefined');
        if (typeof vis === 'undefined') {
            console.error('Vis.js not loaded!');
            alert('Vis.js library not loaded. Please reload the page.');
            return;
        }
        
        // 获取当前的意图树数据
        const result = await chrome.storage.local.get(['intentTree']);
        console.log('3. Storage result:', result);
        
        if (!result.intentTree || !result.intentTree.item) {
            console.log('4. No intent tree data found, using test data');
            // 使用测试数据进行演示
            result.intentTree = {
                scenario: "Demo Multi-Level Network",
                item: {
                    "l-Intent-1": {
                        group: [
                            {
                                id: 1,
                                content: "r-Record-1",
                                context: "context-1",
                                comment: "comment-1"
                            },
                            {
                                id: 2,
                                content: "r-Record-2",
                                context: "context-2",
                                comment: "comment-2"
                            }
                        ]
                    },
                    "l-Intent-2": {
                        group: [
                            {
                                id: 3,
                                content: "r-Record-3",
                                context: "context-3",
                                comment: "comment-3"
                            }
                        ]
                    },
                    "l-Intent-3": {
                        group: [
                            {
                                id: 4,
                                content: "r-Record-4",
                                context: "context-4",
                                comment: "comment-4"
                            }
                        ]
                    },
                    "l-Intent-4": {
                        group: [
                            {
                                id: 5,
                                content: "r-Record-5",
                                context: "context-5",
                                comment: "comment-5"
                            }
                        ]
                    },
                    "l-Intent-5": {
                        group: [
                            {
                                id: 6,
                                content: "r-Record-6",
                                context: "context-6",
                                comment: "comment-6"
                            }
                        ]
                    }
                }
            };
            console.log('Using test data for demo');
        }

        console.log('4. Intent tree data found:', result.intentTree);
        console.log('5. Intent tree items:', Object.keys(result.intentTree.item || {}));
        
        // 调用V2网络可视化函数
        if (typeof window.showNetworkVisualizationV2 === 'function') {
            await window.showNetworkVisualizationV2(
                result.intentTree, 
                null, 
                'standalone', 
                'force'  // 使用力导向布局支持自由拖拽
            );
        } else {
            console.error('showNetworkVisualizationV2 function not found');
            console.log('Available functions:', Object.keys(window).filter(key => key.includes('Network')));
            alert('V2 network visualization not available. Please check the console for errors.');
        }
        
    } catch (error) {
        console.error('Error showing V2 network visualization:', error);
        alert('Failed to show V2 network visualization. Please check the console for details.');
    }
}
