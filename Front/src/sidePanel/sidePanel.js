let intentNetwork = null;
let networkGraph = null;
let networkManager = null;
let lastIntentTree = null; // 添加一个变量来保存最后的 intentTree 状态

document.addEventListener('DOMContentLoaded', () => {
    initializeTaskDescription();
    initializeRecordsArea();
    initializeScrollIndicators();
    initializeResizer();
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
    const highlightBtn = createButton("Highlight Text", "highlightTextBtn");
    const analyzeBtn = createButton("Analyze", "analyzeBtn");

    // 添加按钮到按钮区域
    buttonArea.appendChild(clearAllBtn);
    buttonArea.appendChild(highlightBtn);
    buttonArea.appendChild(analyzeBtn);

    // 设置按钮事件监听器
    clearAllBtn.addEventListener('click', () => {
        chrome.storage.local.set({ records: [] }, updateRecordsList);
        hideNetworkVisualization();
    });

    highlightBtn.addEventListener('click', async () => {
        // 获取当前活动标签
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // 获取当前高亮状态
        const currentHighlightBtn = document.getElementById('highlightTextBtn');
        const isCurrentlyHighlighted = currentHighlightBtn.textContent === 'Remove Highlight';

        // 如果当前没有高亮，且NetworkVisualization未显示
        if (!isCurrentlyHighlighted && !networkManager) {
            // 先触发analyzeBtn点击
            const analyzeBtn = document.getElementById('analyzeBtn');
            await analyzeBtn.click();
            
            // 等待NetworkVisualization加载完成
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 向content script发送消息来切换高亮
        chrome.tabs.sendMessage(tab.id, { action: 'toggleHighlight' });
    });

    analyzeBtn.addEventListener('click', async () => {
        // 如果网络可视化已经显示，则隐藏它
        if (networkManager) {
            hideNetworkVisualization();
            analyzeBtn.textContent = "Analyze";
            return;
        }

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
            console.log("networkManager status: ", networkManager);
            console.log("lastIntentTree: ", lastIntentTree);
            const constructResponse = await fetch('http://localhost:8000/construct/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scenario: taskDescription,
                    groupsOfNodes: {
                        item: groupsOfNodes.item || []
                    },
                    intentTree: networkManager ? networkManager.getIntentTreeWithStates() : lastIntentTree,
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
            
            // 显示网络视化容器
            showNetworkContainer();
            
            // 初始化或更新网络可视化
            if (!networkManager) {
                networkManager = await window.showNetworkVisualization(
                    intentTree, 
                    document.getElementById('networkVisualizationContainer'),
                    'sidepanel'
                );
            } else {
                networkManager.updateData(intentTree);
            }

            // 更新按钮文本
            analyzeBtn.textContent = "Hide Intent Tree";
            
        } catch (error) {
            console.error('Visualization error:', error);
            alert(`无法加载网络可视化：${error.message}\n\n请确保：\n1. 后端服务器正在运行(http://localhost:8000)\n2. 没有网络连接问题\n3. 浏览器控制台中查看详细错误信息`);
            hideNetworkVisualization();
            analyzeBtn.textContent = "Analyze";
        } finally {
            hideLoadingState();
        }
    });

    // 监听来自content script的高亮状态变化
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'highlightStateChanged') {
            const highlightBtn = document.getElementById('highlightTextBtn');
            if (request.isActive) {
                highlightBtn.textContent = 'Remove Highlight';
            } else {
                highlightBtn.textContent = 'Highlight Text';
            }
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
    
    // 获取当前活动标签的URL
    const currentTab = await new Promise(resolve => {
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            resolve(tabs[0]);
        });
    });
    
    // 使用 Promise.all 来并行处理所有记录
    await Promise.all(records.map(async (record, index) => {
        const item = document.createElement("div");
        item.className = "record-item";
        
        // 添加点击事件和样式
        item.style.cursor = "pointer";
        item.addEventListener('click', async (e) => {
            // 确保点击不是来自删除按钮或跳转按钮
            if (!e.target.closest('.delete-btn') && !e.target.closest('.goto-page-btn')) {
                const url = chrome.runtime.getURL(`records.html?index=${index}`);
                
                // 查找当前窗口中是否已经打开了 records.html
                const tabs = await chrome.tabs.query({});
                const recordsTab = tabs.find(tab => tab.url.includes('records.html'));
                
                if (recordsTab) {
                    // 如果已经打开，更新该标签页的URL并激活它
                    await chrome.tabs.update(recordsTab.id, { 
                        url: url,
                        active: true 
                    });
                    // 确保包含该标签页的窗口被激活
                    chrome.windows.update(recordsTab.windowId, { focused: true });
                } else {
                    // 如果没有打开，创建新标签页
                    chrome.tabs.create({ url: url });
                }
            }
        });
        
        // 设置data-url属性和检查是否需要高亮
        item.setAttribute('data-url', record.url || '');
        if (currentTab && currentTab.url === record.url) {
            item.classList.add('active');
        }
        
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
    }));

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
    const resizer = document.querySelector('.resizer');
    
    container.classList.add('visible');
    resizer.classList.add('visible');
    
    // 初始化高度分配
    const recordsArea = document.querySelector('.records-area');
    const scrollArea = document.getElementById('recordsScrollArea');
    const totalHeight = recordsArea.clientHeight - 6; // 减去分隔条高度
    
    scrollArea.style.height = `${totalHeight * 0.6}px`; // 60%
    container.style.height = `${totalHeight * 0.4}px`; // 40%
}

function hideNetworkVisualization() {
    if (networkManager) {
        // 保存当前的 intentTree 状态
        lastIntentTree = networkManager.getIntentTreeWithStates();
        networkManager.cleanup();
        networkManager = null;
    }
    const container = document.getElementById('networkVisualizationContainer');
    const resizer = document.querySelector('.resizer');
    const scrollArea = document.getElementById('recordsScrollArea');
    
    container.classList.remove('visible');
    container.style.width = '';
    resizer.classList.remove('visible');
    scrollArea.style.height = '100%';
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

// 初始化滚动提示元素
function initializeScrollIndicators() {
    const recordsArea = document.querySelector('.records-area');
    
    // 创建向上提示
    const upIndicator = document.createElement('div');
    upIndicator.className = 'scroll-indicator up';
    upIndicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 15l-6-6-6 6"/>
        </svg>
        <span>More matches above</span>
    `;
    
    // 创建向下提示
    const downIndicator = document.createElement('div');
    downIndicator.className = 'scroll-indicator down';
    downIndicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
        </svg>
        <span>More matches below</span>
    `;
    
    recordsArea.appendChild(upIndicator);
    recordsArea.appendChild(downIndicator);

    // 添加点击事件
    upIndicator.addEventListener('click', () => {
        const activeItems = Array.from(document.querySelectorAll('.record-item.active'));
        if (activeItems.length > 0) {
            const scrollArea = document.getElementById("recordsScrollArea");
            const targetItem = findTargetItem(activeItems, scrollArea, 'up');
            
            if (targetItem) {
                scrollToItem(targetItem, scrollArea);
                upIndicator.classList.remove('visible');
                upIndicator.dataset.shown = 'true';
            }
        }
    });

    downIndicator.addEventListener('click', () => {
        const activeItems = Array.from(document.querySelectorAll('.record-item.active'));
        if (activeItems.length > 0) {
            const scrollArea = document.getElementById("recordsScrollArea");
            const targetItem = findTargetItem(activeItems, scrollArea, 'down');
            
            if (targetItem) {
                scrollToItem(targetItem, scrollArea);
                downIndicator.classList.remove('visible');
                downIndicator.dataset.shown = 'true';
            }
        }
    });
}

// 更新滚动提示
function updateScrollIndicators(activeItems, scrollArea) {
    const upIndicator = document.querySelector('.scroll-indicator.up');
    const downIndicator = document.querySelector('.scroll-indicator.down');
    const containerRect = scrollArea.getBoundingClientRect();
    
    // 更新指示器的位置
    if (upIndicator) {
        upIndicator.style.left = `${containerRect.left + containerRect.width / 2}px`;
        upIndicator.style.top = `${containerRect.top + 12}px`;  // 距离顶部12px
    }
    
    if (downIndicator) {
        downIndicator.style.left = `${containerRect.left + containerRect.width / 2}px`;
        downIndicator.style.bottom = `${window.innerHeight - containerRect.bottom + 12}px`;  // 距离底部12px
    }
    
    // 检查是否已经滚动到顶部或底部
    const isAtTop = scrollArea.scrollTop <= 0;
    const isAtBottom = scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 1;
    
    // 如果在顶部或底部，直接隐藏对应提示并返回
    if (isAtTop) {
        upIndicator.classList.remove('visible');
        upIndicator.dataset.shown = 'true';
    }
    if (isAtBottom) {
        downIndicator.classList.remove('visible');
        downIndicator.dataset.shown = 'true';
    }
    
    if (isAtTop && isAtBottom) return;

    let hasItemsAbove = false;
    let hasItemsBelow = false;

    activeItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        if (!isAtTop && rect.bottom < containerRect.top) {
            hasItemsAbove = true;
        }
        if (!isAtBottom && rect.top > containerRect.bottom) {
            hasItemsBelow = true;
        }
    });

    if (!isAtTop && hasItemsAbove && upIndicator.dataset.shown !== 'true') {
        upIndicator.classList.add('visible');
    } else {
        upIndicator.classList.remove('visible');
    }

    if (!isAtBottom && hasItemsBelow && downIndicator.dataset.shown !== 'true') {
        downIndicator.classList.add('visible');
    } else {
        downIndicator.classList.remove('visible');
    }
}

// 添加窗口大小改变事件监听
window.addEventListener('resize', () => {
    const scrollArea = document.getElementById("recordsScrollArea");
    const activeItems = Array.from(document.querySelectorAll('.record-item.active'));
    if (activeItems.length > 0) {
        updateScrollIndicators(activeItems, scrollArea);
    }
});

// 添加滚动事件监听
document.addEventListener('DOMContentLoaded', () => {
    const scrollArea = document.getElementById("recordsScrollArea");
    if (scrollArea) {
        scrollArea.addEventListener('scroll', () => {
            const activeItems = Array.from(document.querySelectorAll('.record-item.active'));
            if (activeItems.length > 0) {
                updateScrollIndicators(activeItems, scrollArea);
            }
        });
    }
});

// 重置提示状态（在URL变化时调用）
function resetScrollIndicators() {
    const upIndicator = document.querySelector('.scroll-indicator.up');
    const downIndicator = document.querySelector('.scroll-indicator.down');
    if (upIndicator) upIndicator.dataset.shown = 'false';
    if (downIndicator) downIndicator.dataset.shown = 'false';
}

// 更新监听标签页变化的代码
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    resetScrollIndicators(); // 重置提示状态
    await updateHighlightButtonState(tab.url);
    updateActiveRecordHighlight(tab.url);
});

// 监听URL变化
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab.id === tabId) {
            await updateHighlightButtonState(changeInfo.url);
            updateActiveRecordHighlight(changeInfo.url);
        }
    }
});

// 更新高亮按钮状态
async function updateHighlightButtonState(url) {
    const { pageHighlightStates = {} } = await chrome.storage.local.get('pageHighlightStates');
    const highlightBtn = document.getElementById('highlightTextBtn');
    
    // 根据当前页面的存储状态更新按钮文本
    if (pageHighlightStates[url]) {
        highlightBtn.textContent = 'Remove Highlight';
    } else {
        highlightBtn.textContent = 'Highlight Text';
    }
}

// 添加消息监听器来处理高亮状态变化
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'highlightStateChanged') {
        updateHighlightButtonState(request.url);
    }
});

// 更新高亮状态函数
function updateActiveRecordHighlight(currentUrl) {
    const scrollArea = document.getElementById("recordsScrollArea");
    let activeItems = [];
    
    // 更新高亮状态并收集所有匹配的items
    document.querySelectorAll('.record-item').forEach(item => {
        const recordUrl = item.getAttribute('data-url');
        if (recordUrl === currentUrl) {
            item.classList.add('active');
            activeItems.push(item);
        } else {
            item.classList.remove('active');
        }
    });

    // 如果找到匹配的items
    if (activeItems.length > 0) {
        // 找到第一个不完全可见的高亮item
        const firstVisibleActive = activeItems.find(item => {
            const rect = item.getBoundingClientRect();
            const containerRect = scrollArea.getBoundingClientRect();
            return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
        });

        // 如果没有完全可见的高亮item，滚动到第一个高亮item
        if (!firstVisibleActive && activeItems.length > 0) {
            const targetItem = activeItems[0];
            scrollToItem(targetItem, scrollArea);
        }

        // 更新滚动提示
        updateScrollIndicators(activeItems, scrollArea);
    }
}

// 滚动到指定item，确保完整显示
function scrollToItem(item, scrollArea) {
    const scrollAreaHeight = scrollArea.clientHeight;
    const itemHeight = item.offsetHeight;
    const itemOffsetTop = item.offsetTop;
    const scrollAreaScrollHeight = scrollArea.scrollHeight;

    // 添加一些边距，确保内容不会贴边
    const MARGIN = 10;
    
    let targetScrollTop;
    
    // 计算如果将item放在顶部，底部是否有足够空间
    const remainingItemsHeight = scrollAreaScrollHeight - (itemOffsetTop + itemHeight);
    
    if (remainingItemsHeight < scrollAreaHeight - itemHeight) {
        // 如果底部空间不足，将item放在可视区域的底部
        targetScrollTop = Math.max(
            0,
            Math.min(
                scrollAreaScrollHeight - scrollAreaHeight,
                itemOffsetTop - (scrollAreaHeight - itemHeight) + MARGIN
            )
        );
    } else {
        // 如果底部空间充足，将item放在顶部
        targetScrollTop = Math.max(0, itemOffsetTop - MARGIN);
    }

    // 确保不会滚动过头
    targetScrollTop = Math.min(
        targetScrollTop,
        scrollAreaScrollHeight - scrollAreaHeight
    );

    // 使用平滑滚动
    scrollArea.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
    });

    // 添加滚动完成后的检查
    setTimeout(() => {
        const itemRect = item.getBoundingClientRect();
        const containerRect = scrollArea.getBoundingClientRect();
        
        // 检查item是否完全在可视区域内
        if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
            // 如果不在，进行微调
            const adjustment = itemRect.top < containerRect.top ? 
                itemRect.top - containerRect.top - MARGIN : 
                itemRect.bottom - containerRect.bottom + MARGIN;
            
            scrollArea.scrollBy({
                top: adjustment,
                behavior: 'smooth'
            });
        }
    }, 300); // 等待初始滚动完成
}

// 更新查找目标item的逻辑
function findTargetItem(activeItems, scrollArea, direction) {
    const containerRect = scrollArea.getBoundingClientRect();
    
    if (direction === 'up') {
        // 找到视野外最上方的完整item
        return activeItems
            .filter(item => {
                const rect = item.getBoundingClientRect();
                // 检查item是否完全在视野上方或部分在视野上方
                return rect.bottom < containerRect.top || 
                       (rect.top < containerRect.top && rect.bottom > containerRect.top);
            })
            .sort((a, b) => a.offsetTop - b.offsetTop)[0];
    } else {
        // 找到视野外最下方的完整item
        return activeItems
            .filter(item => {
                const rect = item.getBoundingClientRect();
                // 检查item是否完全在视野下方或部分在视野下方
                return rect.top > containerRect.bottom || 
                       (rect.bottom > containerRect.bottom && rect.top < containerRect.bottom);
            })
            .sort((a, b) => b.offsetTop - a.offsetTop)[0];
    }
}

// 添加：初始化分隔条
function initializeResizer() {
    const recordsArea = document.querySelector('.records-area');
    const scrollArea = document.getElementById('recordsScrollArea');
    const networkContainer = document.getElementById('networkVisualizationContainer');
    
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    
    // 添加拖动手柄图标
    resizer.innerHTML = `
        <div class="resizer-handle">
            <svg width="20" height="4" viewBox="0 0 20 4">
                <line x1="0" y1="2" x2="20" y2="2" stroke="#CBD5E0" stroke-width="2"/>
            </svg>
        </div>
    `;
    
    scrollArea.after(resizer);
    
    let startY;
    let startHeights;
    let resizerRect;
    
    function startResize(e) {
        // 阻止默认行为和冒泡
        e.preventDefault();
        e.stopPropagation();
        
        // 添加拖动状态类
        document.body.classList.add('resizing');
        resizer.classList.add('dragging');
        
        // 记录初始位置和高度
        startY = e.clientY;
        resizerRect = resizer.getBoundingClientRect();
        startHeights = {
            scrollArea: scrollArea.offsetHeight,
            networkContainer: networkContainer.offsetHeight
        };
        
        // 添加事件监听
        document.addEventListener('mousemove', resize, { passive: true });
        document.addEventListener('mouseup', stopResize);
        
        // 创建遮罩层防止iframe干扰
        const overlay = document.createElement('div');
        overlay.id = 'resize-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            cursor: row-resize;
        `;
        document.body.appendChild(overlay);
    }
    
    function resize(e) {
        if (!networkContainer.classList.contains('visible')) return;
        
        // 使用 requestAnimationFrame 优化性能
        requestAnimationFrame(() => {
            const delta = e.clientY - startY;
            const totalHeight = recordsArea.clientHeight - 6;
            
            // 计算新的高度
            let newScrollAreaHeight = startHeights.scrollArea + delta;
            let newNetworkHeight = startHeights.networkContainer - delta;
            
            // 设置最小高度限制
            const minHeight = 100;
            if (newScrollAreaHeight < minHeight) {
                newScrollAreaHeight = minHeight;
                newNetworkHeight = totalHeight - minHeight;
            } else if (newNetworkHeight < minHeight) {
                newNetworkHeight = minHeight;
                newScrollAreaHeight = totalHeight - minHeight;
            }
            
            // 应用新的高度
            scrollArea.style.height = `${newScrollAreaHeight}px`;
            networkContainer.style.height = `${newNetworkHeight}px`;
            
            // 更新网络可视化
            if (networkManager) {
                networkManager.updateSize();
            }
        });
    }
    
    function stopResize() {
        // 移除状态类和事件监听
        document.body.classList.remove('resizing');
        resizer.classList.remove('dragging');
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        
        // 移除遮罩层
        const overlay = document.getElementById('resize-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    // 使用 mousedown 而不是 pointerdown，避免触摸设备的问题
    resizer.addEventListener('mousedown', startResize);
    
    // 添加双击自动调整功能
    resizer.addEventListener('dblclick', () => {
        if (!networkContainer.classList.contains('visible')) return;
        
        const totalHeight = recordsArea.clientHeight - 6;
        const equalHeight = totalHeight / 2;
        
        scrollArea.style.height = `${equalHeight}px`;
        networkContainer.style.height = `${equalHeight}px`;
        
        if (networkManager) {
            networkManager.updateSize();
        }
    });
}
