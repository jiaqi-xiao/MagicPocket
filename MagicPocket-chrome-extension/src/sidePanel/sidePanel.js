let intentNetwork = null;
let networkGraph = null;
let networkManager = null;
let lastIntentTree = null; // 添加一个变量来保存最后的 intentTree 状态
let lastAnalysisRecordsHash = null; // 记录上次分析时的数据哈希值

// 测试环境控制变量
const USE_MOCK_DATA = false;

// 合并确认状态：将 lastIntentTree 中的确认状态合并到新的 intentTree 中
function mergeConfirmationStates(newIntentTree, lastIntentTree) {
    if (!newIntentTree || !newIntentTree.item || !lastIntentTree || !lastIntentTree.child) {
        return;
    }

    console.log('Merging confirmation states from lastIntentTree to newIntentTree');
    
    // 创建一个映射来快速查找上次的确认状态
    const lastStateMap = new Map();
    
    // 递归收集 lastIntentTree 中的所有确认状态
    function collectLastStates(children) {
        children.forEach(child => {
            if (child.intent || child.description) {
                const intentName = child.intent || child.description;
                if (child.immutable || child.confirmed) {
                    lastStateMap.set(intentName, true);
                    console.log(`Found confirmed intent in lastIntentTree: ${intentName}`);
                }
                
                // 递归处理子节点
                if (child.child && Array.isArray(child.child)) {
                    collectLastStates(child.child);
                }
            }
        });
    }
    
    collectLastStates(lastIntentTree.child);
    
    // 将确认状态应用到新的意图树中
    Object.entries(newIntentTree.item).forEach(([intentName, intentData]) => {
        // 检查高级意图的确认状态
        if (lastStateMap.has(intentName)) {
            intentData.confirmed = true;
            console.log(`Applied confirmation to high-level intent: ${intentName}`);
        }
        
        // 检查低级意图的确认状态
        if (intentData.child && Array.isArray(intentData.child)) {
            intentData.child.forEach(childIntent => {
                if (childIntent.intent && lastStateMap.has(childIntent.intent)) {
                    childIntent.confirmed = true;
                    console.log(`Applied confirmation to low-level intent: ${childIntent.intent}`);
                }
            });
        }
    });
    
    console.log('Confirmation states merged successfully');
}

// Record change detection functions
function generateRecordsHash(records) {
    if (!records || !Array.isArray(records)) {
        return null;
    }
    
    // Create a simplified representation of records for hashing
    const recordsData = records.map(record => ({
        id: record.id,
        content: record.content,
        comment: record.comment,
        timestamp: record.timestamp,
        type: record.type,
        url: record.url
    }));
    
    // Simple hash function using JSON string
    const jsonString = JSON.stringify(recordsData);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
}

async function checkRecordsChanged() {
    const records = await getRecords();
    const currentHash = generateRecordsHash(records);
    
    // Get stored hash from previous analysis
    const result = await new Promise((resolve) => {
        chrome.storage.local.get(['lastAnalysisRecordsHash'], resolve);
    });
    
    const storedHash = result.lastAnalysisRecordsHash;
    const hasChanged = currentHash !== storedHash;
    
    console.log('Records change check:', {
        currentHash,
        storedHash,
        hasChanged,
        recordsCount: records.length
    });
    
    return hasChanged;
}

async function updateAnalysisRecordsHash() {
    const records = await getRecords();
    const currentHash = generateRecordsHash(records);
    
    await new Promise((resolve) => {
        chrome.storage.local.set({ lastAnalysisRecordsHash: currentHash }, resolve);
    });
    
    lastAnalysisRecordsHash = currentHash;
    console.log('Updated analysis records hash:', currentHash);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'closeSidePanel') {
        window.close();
        sendResponse({ success: true });
        return true; // 保持消息通道开放
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initializeTaskDescription();
    initializeRecordsArea();
    initializeScrollIndicators();
    initializeResizer();
    
    // Reset highlight button state to default
    const highlightBtn = document.getElementById('highlightTextBtn');
    if (highlightBtn) {
        highlightBtn.textContent = 'Highlight Text';
    }
});

async function resetHighlightState() {
    console.log("Resetting highlight state...");
    const highlightBtn = document.getElementById('highlightTextBtn');
    if (!highlightBtn) {
        console.log("Highlight button not found");
        return;
    }

    highlightBtn.textContent = 'Highlight Text';
    console.log("Set initial button text");
    
    try {
        console.log("Attempting to get current tab...");
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        console.log("Query result:", tab);
        
        if (tab) {
            console.log("Current tab URL:", tab.url);
            console.log("Getting pageHighlightStates from storage...");
            const { pageHighlightStates = {} } = await chrome.storage.local.get('pageHighlightStates');
            console.log("Before update pageHighlightStates:", pageHighlightStates);
            
            pageHighlightStates[tab.url] = false;
            console.log("Setting new state in storage...");
            
            try {
                await new Promise((resolve, reject) => {
                    chrome.storage.local.set({ pageHighlightStates }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Storage set error:", chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log("After update pageHighlightStates:", pageHighlightStates);
                            resolve();
                        }
                    });
                });
                
                console.log("Storage updated successfully");
                await updateHighlightButtonState(tab.url);
                console.log("Highlight button state updated");
            } catch (storageError) {
                console.error("Error updating storage:", storageError);
            }
        } else {
            console.log("No active tab found");
        }
    } catch (error) {
        console.error("Error in resetHighlightState:", error);
    }
}

function initializeTaskDescription() {
    const taskDescription = document.getElementById("currentTaskDescription");
    const taskEditButton = document.getElementById("taskEditButton");
    
    // 初始化任务描述显示
    chrome.storage.local.get("currentTask", (data) => {
        if (data.currentTask && data.currentTask.description) {
            taskDescription.textContent = `📋 ${data.currentTask.description}`;
            taskEditButton.style.display = "block";
        } else {
            taskDescription.textContent = "📋 No active task";
            taskDescription.style.color = "#a0aec0";
            taskDescription.style.fontStyle = "italic";
            taskEditButton.style.display = "none";
        }
    });

    // 设置编辑按钮事件监听器
    taskEditButton.addEventListener('click', handleTaskEdit);

    // 监听任务更新
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.currentTask) {
            const newTask = changes.currentTask.newValue;
            if (newTask && newTask.description) {
                taskDescription.textContent = `📋 ${newTask.description}`;
                taskDescription.style.color = "#4a5568";
                taskDescription.style.fontStyle = "normal";
                taskEditButton.style.display = "block";
            } else {
                taskDescription.textContent = "📋 No active task";
                taskDescription.style.color = "#a0aec0";
                taskDescription.style.fontStyle = "italic";
                taskEditButton.style.display = "none";
            }
        }
    });
}

// 处理任务编辑按钮点击
function handleTaskEdit() {
    window.Logger.log(window.LogCategory.UI, 'side_panel_task_edit_btn_clicked', {});
    
    chrome.storage.local.get("currentTask", (data) => {
        const currentDescription = data.currentTask?.description || "";
        showTaskEditDialog(currentDescription);
    });
}

// 显示任务编辑对话框
function showTaskEditDialog(currentDescription) {
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.id = 'mp-task-edit-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10002;
        min-width: 320px;
        max-width: 500px;
    `;

    // 创建标题
    const title = document.createElement('h3');
    title.textContent = 'Edit Task Description';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #2d3436;
        font-size: 16px;
        font-weight: 600;
    `;

    // 创建输入框
    const input = document.createElement('textarea');
    input.value = currentDescription;
    input.placeholder = 'Enter task description';
    input.style.cssText = `
        width: 100%;
        min-height: 80px;
        padding: 8px;
        margin-bottom: 15px;
        border: 1px solid #dfe6e9;
        border-radius: 4px;
        box-sizing: border-box;
        font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
        resize: vertical;
    `;

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    `;

    // 创建取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
        padding: 8px 16px;
        background: #95a5a6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    // 创建确认按钮
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Save';
    confirmButton.style.cssText = `
        padding: 8px 16px;
        background: #27ae60;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    // 添加事件监听器
    cancelButton.onclick = () => {
        document.body.removeChild(dialog);
    };

    confirmButton.onclick = async () => {
        const newDescription = input.value.trim();
        if (!newDescription) {
            alert('Please enter a task description');
            return;
        }

        try {
            // 获取当前任务数据
            const { currentTask } = await chrome.storage.local.get('currentTask');
            const updatedTask = {
                ...currentTask,
                description: newDescription
            };

            // 保存更新后的任务
            await chrome.storage.local.set({ currentTask: updatedTask });
            
            window.Logger.log(window.LogCategory.UI, 'side_panel_task_description_updated', {
                old_description: currentTask?.description || '',
                new_description: newDescription
            });

            document.body.removeChild(dialog);
        } catch (error) {
            console.error('Error updating task description:', error);
            alert('Failed to update task description. Please try again.');
        }
    };

    // 组装对话框
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    dialog.appendChild(title);
    dialog.appendChild(input);
    dialog.appendChild(buttonContainer);
    document.body.appendChild(dialog);

    // 聚焦输入框并选中文本
    input.focus();
    input.select();

    // 添加键盘快捷键
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            confirmButton.click();
        } else if (event.key === 'Escape') {
            cancelButton.click();
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
        window.Logger.log(window.LogCategory.UI, 'side_panel_clear_all_btn_clicked', {});
        chrome.storage.local.set({ records: [] }, () => {
            updateRecordsList();
            window.Logger.log(window.LogCategory.UI, 'side_panel_records_cleared', {});
        });
        hideNetworkVisualization();
    });

    highlightBtn.addEventListener('click', async () => {
        window.Logger.log(window.LogCategory.UI, 'side_panel_highlight_text_btn_clicked', {});
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
        window.Logger.log(window.LogCategory.UI, 'side_panel_analyze_btn_clicked', {});
        
        // Get current analysis mode
        const modeResult = await new Promise((resolve) => {
            chrome.storage.local.get(['analysisMode'], resolve);
        });
        const analysisMode = modeResult.analysisMode || 'normal';
        const isAblationMode = analysisMode === 'ablation';
        
        console.log('Analysis mode:', analysisMode);
        
        // Handle different behaviors based on mode and current state
        if (isAblationMode) {
            // Ablation mode: check if disabled (Analysis Done state)
            if (analyzeBtn.classList.contains('mp-analyze-btn-disabled')) {
                console.log('Analyze button is disabled in ablation mode');
                return;
            }
            // If it's "Reanalyze", ensure button is in normal state before proceeding
            if (analyzeBtn.textContent === 'Reanalyze') {
                resetAnalyzeButtonToNormal(analyzeBtn);
                console.log('Reanalyze button clicked, reset to normal state');
            }
        } else {
            // Normal mode: if network is shown, hide it
            if (networkManager) {
                hideNetworkVisualization();
                analyzeBtn.textContent = "Analyze";
                window.Logger.log(window.LogCategory.UI, 'side_panel_analyze_cancelled', {});
                return;
            }
        }

        try {
            window.Logger.log(window.LogCategory.UI, 'side_panel_analyze_started', {});
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
            showAnalyzeLoadingState(analyzeBtn);

            // 调用后端 group_nodes API
            const startTime = performance.now();
            const { selectedHost } = await chrome.storage.sync.get(['selectedHost']);
            const host = selectedHost || 'http://localhost:8000/';
            
            async function makeGroupRequest() {
                if (USE_MOCK_DATA) {
                    // 返回模拟响应
                    return {
                        ok: true,
                        status: 200,
                        json: async () => (mockGroupData)
                    };
                }

                return await fetch(`${host}group/?scenario=${encodeURIComponent(taskDescription)}`, {
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
            }

            async function showRetryDialog() {
                return new Promise((resolve, reject) => {
                    const dialog = document.createElement('div');
                    dialog.className = 'mp-custom-dialog';
                    dialog.innerHTML = `
                        <div class="mp-dialog-content">
                            <p>Server is not responding properly. Please try again.</p>
                            <div class="mp-dialog-buttons">
                                <button class="mp-cancel-btn">Cancel</button>
                                <button class="mp-retry-btn">Retry</button>
                            </div>
                        </div>
                    `;
                    
                    document.body.appendChild(dialog);
                    
                    dialog.querySelector('.mp-cancel-btn').addEventListener('click', () => {
                        dialog.remove();
                        reject(new Error('Operation cancelled by user'));
                    });
                    
                    dialog.querySelector('.mp-retry-btn').addEventListener('click', () => {
                        dialog.remove();
                        resolve();
                    });
                });
            }

            let groupResponse;
            while (true) {
                try {
                    groupResponse = await makeGroupRequest();
                    if (groupResponse.status === 422) {
                        window.Logger.log(window.LogCategory.ERROR, 'side_panel_group_api_422_error', {
                            error: 'Server returned 422 error',
                            records_count: records.length
                        });
                        
                        // Show dialog and wait for user action
                        await showRetryDialog();
                        // If user clicks retry, the loop continues
                        continue;
                    }
                    // If response is not 422, break the loop
                    break;
                } catch (error) {
                    if (error.message === 'Operation cancelled by user') {
                        window.Logger.log(window.LogCategory.UI, 'side_panel_group_api_cancelled', {
                            error: error.message
                        });
                        throw error;
                    }
                    window.Logger.log(window.LogCategory.ERROR, 'side_panel_group_api_error', {
                        error: error.message,
                        records_count: records.length
                    });
                    throw error;
                }
            }

            const groupApiTime = performance.now() - startTime;
            window.Logger.log(window.LogCategory.NETWORK, 'side_panel_group_api_called', {
                duration_ms: Math.round(groupApiTime),
                records_count: records.length,
                status: groupResponse.status
            });

            if (!groupResponse.ok) {
                const errorData = await groupResponse.json();
                throw new Error(`Group API error (${groupResponse.status}): ${JSON.stringify(errorData.detail)}`);
            }
            
            const groupsOfNodes = await groupResponse.json();
            window.Logger.log(window.LogCategory.SYSTEM, 'side_panel_groups_generated', {
                raw_response: JSON.stringify(groupsOfNodes)
            });

            // 调用后端 construct API
            const constructStartTime = performance.now();
            console.log("networkManager status: ", networkManager);
            console.log("lastIntentTree: ", lastIntentTree);
            
            // 优先使用 networkManager 的状态数据，如果不存在则使用 lastIntentTree
            // 但确保 lastIntentTree 格式正确且保留已确认状态
            let intentTreeData = null;
            if (networkManager) {
                intentTreeData = networkManager.getIntentTreeWithStates();
            } else if (lastIntentTree) {
                // 使用 lastIntentTree，它已经包含了之前的确认状态
                intentTreeData = lastIntentTree;
            }
            
            // 验证数据格式
            if (intentTreeData && intentTreeData.child) {
                intentTreeData.child = intentTreeData.child.map(item => ({
                    ...item,
                    description: item.description || item.intent,
                    child_num: Array.isArray(item.child) ? item.child.length : 0,
                    child: Array.isArray(item.child) ? item.child : []
                }));
            }

            let constructResponse;
            if (USE_MOCK_DATA) {
                // 返回模拟响应
                constructResponse = {
                    ok: true,
                    status: 200,
                    json: async () => (mockExtractData)
                };
            } else {
                // 获取当前的intentTree（包含用户确认状态）
                let currentIntentTree = null;
                if (networkManager) {
                    currentIntentTree = networkManager.getIntentTreeWithStates();
                } else if (lastIntentTree) {
                    currentIntentTree = lastIntentTree;
                }

                constructResponse = await fetch(`${host}extract/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        scenario: taskDescription,
                        groupsOfNodes: groupsOfNodes.groupsOfNodes,
                        familiarity: groupsOfNodes.granularity.familiarity,
                        specificity: groupsOfNodes.granularity.specificity,
                        intentTree: currentIntentTree
                    })
                });
            }
            
            const constructApiTime = performance.now() - constructStartTime;
            window.Logger.log(window.LogCategory.NETWORK, 'side_panel_construct_api_called', {
                duration_ms: Math.round(constructApiTime),
                groups_count: groupsOfNodes.groupsOfNodes.length
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
            
            // 合并之前保存的确认状态到新的意图树中
            if (lastIntentTree && lastIntentTree.child) {
                console.log('About to merge confirmation states');
                console.log('lastIntentTree child count:', lastIntentTree.child.length);
                mergeConfirmationStates(intentTree, lastIntentTree);
            } else {
                console.log('No lastIntentTree to merge states from');
            }
            
            window.Logger.log(window.LogCategory.SYSTEM, 'side_panel_intent_tree_generated', {
                raw_response: JSON.stringify(intentTree)
            });

            if (isAblationMode) {
                // Ablation mode: don't show network, set button to Analysis Done
                console.log('Ablation mode: Analysis completed, network hidden');
                
                // Update records hash after successful analysis
                await updateAnalysisRecordsHash();
                
                // In ablation mode, analysis is complete - set to "Analysis Done" and disable
                analyzeBtn.textContent = "Analysis Done";
                analyzeBtn.classList.add('mp-analyze-btn-disabled');
                
                // Clear the original text so hideAnalyzeLoadingState won't override our setting
                delete analyzeBtn.dataset.originalText;
                
                window.Logger.log(window.LogCategory.UI, 'side_panel_analyze_completed_ablation', {});
            } else {
                // Update records hash after successful analysis
                await updateAnalysisRecordsHash();
                // Normal mode: show network visualization
                showNetworkContainer();
                window.Logger.log(window.LogCategory.UI, 'side_panel_network_visualization_shown', {});
                
                // 初始化或更新网络可视化
                if (!networkManager) {
                    networkManager = await window.showNetworkVisualization(
                        intentTree, 
                        document.getElementById('networkVisualizationContainer'),
                        'sidepanel',
                        'hierarchical'
                    );
                } else {
                    networkManager.updateData(intentTree);
                }

                // 更新按钮文本
                analyzeBtn.textContent = "Hide Intent Tree";
                window.Logger.log(window.LogCategory.UI, 'side_panel_analyze_completed', {});
            }
            
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis: ' + error.message);
            hideAnalyzeLoadingState(analyzeBtn);
            window.Logger.log(window.LogCategory.UI, 'side_panel_analyze_failed', {
                error: error.message
            });
        } finally {
            hideAnalyzeLoadingState(analyzeBtn);
        }
    });

    // 监听来自content script的高亮状态变化
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'highlightStateChanged') {
            console.log("highlightStateChanged received from content script: ", request);
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
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
        if (namespace === 'local' && changes.records) {
            updateRecordsList();
            
            // Update analyze button state in ablation mode when records change
            const modeResult = await new Promise((resolve) => {
                chrome.storage.local.get(['analysisMode'], resolve);
            });
            const analysisMode = modeResult.analysisMode || 'normal';
            
            if (analysisMode === 'ablation') {
                const analyzeBtn = document.getElementById('analyzeBtn');
                if (analyzeBtn && analyzeBtn.textContent === 'Analysis Done') {
                    // Records changed, enable reanalyze with full reset
                    analyzeBtn.textContent = 'Reanalyze';
                    resetAnalyzeButtonToNormal(analyzeBtn);
                    console.log('Records changed in ablation mode, button updated to Reanalyze');
                }
            }
        }
    });
}

async function updateRecordsList() {
    const scrollArea = document.getElementById("recordsScrollArea");
    
    try {
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
            item.setAttribute('data-record-id', record.id || index);
            item.setAttribute('data-index', index);
            
            // 添加点击事件和样式
            item.style.cursor = "pointer";
            item.addEventListener('click', async (e) => {
                window.Logger.log(window.LogCategory.UI, 'side_panel_record_item_clicked', {
                    record_id: record.id || index
                });
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
                    <button class="delete-btn" data-index="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `;

            scrollArea.appendChild(item);

            // 添加删除按钮事件监听器
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async (e) => {
                const recordIndex = parseInt(e.currentTarget.dataset.index);
                window.Logger.log(window.LogCategory.UI, 'side_panel_record_item_delete_btn_clicked', {
                    record_index: recordIndex
                });
                
                try {
                    const records = await getRecords();
                    
                    records.splice(recordIndex, 1);
                    
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ records: records }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('[SidePanel] Storage update error:', chrome.runtime.lastError);
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve();
                            }
                        });
                    });
                    
                    // 直接从 DOM 中移除元素，而不是重新渲染整个列表
                    const recordItems = scrollArea.querySelectorAll('.record-item');
                    recordItems.forEach((item, i) => {
                        if (i >= recordIndex) {
                            const newIndex = i === recordIndex ? null : i - 1;
                            if (newIndex !== null) {
                                item.setAttribute('data-index', newIndex);
                                const deleteBtn = item.querySelector('.delete-btn');
                                if (deleteBtn) {
                                    deleteBtn.setAttribute('data-index', newIndex);
                                }
                            } else {
                                item.remove();
                            }
                        }
                    });
                    
                    window.Logger.log(window.LogCategory.UI, 'side_panel_record_item_deleted', {
                        record_index: recordIndex
                    });
                } catch (error) {
                    console.error('[SidePanel] Error during record deletion:', error);
                }
            });

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

        // 添加滚动事件监听
        scrollArea.addEventListener('scroll', () => {
            const activeItems = Array.from(document.querySelectorAll('.record-item.active'));
            if (activeItems.length > 0) {
                updateScrollIndicators(activeItems, scrollArea);
            }
        });
    } catch (error) {
        console.error('[SidePanel] Error during updateRecordsList:', error);
    }
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
        window.Logger.log(window.LogCategory.UI, 'side_panel_network_visualization_hidden', {});
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

// New loading state functions for analyze button
function showAnalyzeLoadingState(button) {
    // Store original text
    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }
    
    // Add loading ring and text
    button.innerHTML = '<span class="mp-loading-ring"></span>Generating...';
    button.disabled = true;
    button.style.opacity = '0.8';
}

function hideAnalyzeLoadingState(button) {
    // Restore original state if not overridden by special state
    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
    
    // Only reset button state if it doesn't have the special disabled class
    if (!button.classList.contains('mp-analyze-btn-disabled')) {
        button.disabled = false;
        button.style.opacity = '1';
    } else {
        // Keep the button disabled but reset opacity for visual consistency
        button.disabled = true;
        button.style.opacity = '0.6';
    }
}

// Reset button to normal enabled state
function resetAnalyzeButtonToNormal(button) {
    button.disabled = false;
    button.style.opacity = '1';
    button.classList.remove('mp-analyze-btn-disabled');
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab.id === tabId) {
        if (changeInfo.status === 'loading' && !changeInfo.url) {
            // 页面刷新的情况
            const highlightBtn = document.getElementById('highlightTextBtn');
            if (highlightBtn) {
                highlightBtn.textContent = 'Highlight Text';
                const { pageHighlightStates = {} } = await chrome.storage.local.get('pageHighlightStates');
                pageHighlightStates[tab.url] = false;
                await chrome.storage.local.set({ pageHighlightStates });
            }
        }
    }
});

// 监听标签页激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await updateHighlightButtonState(tab.url);
    updateActiveRecordHighlight(tab.url);
    resetScrollIndicators();
});

// 更新高亮按钮状态
async function updateHighlightButtonState(url) {
    try {
        const { pageHighlightStates = {} } = await chrome.storage.local.get('pageHighlightStates');
        const highlightBtn = document.getElementById('highlightTextBtn');
        
        if (highlightBtn) {
            highlightBtn.textContent = pageHighlightStates[url] ? 'Remove Highlight' : 'Highlight Text';
        }
    } catch (error) {
        console.error("Error updating highlight button state:", error);
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
        window.Logger.log(window.LogCategory.UI, 'side_panel_scroll_indicator_clicked', {});
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
        window.Logger.log(window.LogCategory.UI, 'side_panel_scroll_indicator_clicked', {});
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

// 重置提示状态（在URL变化时调用）
function resetScrollIndicators() {
    const upIndicator = document.querySelector('.scroll-indicator.up');
    const downIndicator = document.querySelector('.scroll-indicator.down');
    if (upIndicator) upIndicator.dataset.shown = 'false';
    if (downIndicator) downIndicator.dataset.shown = 'false';
}

// 初始化分隔条
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
            
            // // 更新网络可视化
            // if (networkManager) {
            //     networkManager.updateSize();
            // }
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
        
        // if (networkManager) {
        //     networkManager.updateSize();
        // }
    });
}

// 计算节点总数的辅助函数
function countNodes(node) {
    if (!node) return 0;
    let count = 1; // 计算当前节点
    if (node.child && Array.isArray(node.child)) {
        count += node.child.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
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


// Mock extract data
const mockExtractData = {
    "scenario": "Today's Tech News",
    "item": {
        "Highlighting Tech Announcements": {
            "id": 1,
            "intent": "Highlighting Tech Announcements",
            "description": "Summarizing recent technological advancements and updates introduced by major companies, focusing on new features, accessibility, and user experience improvements.",
            "priority": 5,
            "child_num": 1,
            "group": [],
            "level": "1",
            "parent": null,
            "immutable": false,
            "child": [
                {
                    "id": 4,
                    "intent": "Discussing Software and Browsing Innovations",
                    "description": "Focusing on innovations in software development and web browsing, highlighting the introduction of new modes and tools that enhance productivity and user engagement.",
                    "priority": 5,
                    "child_num": 0,
                    "group": [
                        {
                            "id": 1753934889130,
                            "comment": "",
                            "content": "7 月 28 日，微软为 Edge 浏览器引入 Copilot 模式，模式在 Copilot 上线的所有地区可用。开启该模式后，新建标签页会被替换为全新设计的对话框界面。Copilot 可以在对话中基于打开的所有标签页回答问题，支持语音页面导航，可以提供页面快速总结，还可以在开始浏览时提示你继续完成上次浏览的话题。",
                            "context": "7 月 28 日，微软为 Edge 浏览器引入 Copilot 模式，模式在 Copilot 上线的所有地区可用。开启该模式后，新建标签页会被替换为全新设计的对话框界面。Copilot 可以在对话中基于打开的所有标签页回答问题，支持语音页面导航，可以提供页面快速总结，还可以在开始浏览时提示你继续完成上次浏览的话题。用户可以在官方页面打开该设置。来源",
                            "isLeafNode": true
                        },
                        {
                            "id": 1753939879306,
                            "comment": "",
                            "content": "阿里云于 7 月 26 日宣布通义灵码上线 Qwen3-Coder，即日起用户可在通义灵码 AIIDE、VSCode 和 Jetbrains 插件端免费使用。使用上没有限制，不限量服务也无需邀请码",
                            "context": "阿里云于 7 月 26 日宣布通义灵码上线 Qwen3-Coder，即日起用户可在通义灵码 AIIDE、VSCode 和 Jetbrains 插件端免费使用。使用上没有限制，不限量服务也无需邀请码。此前阿里云通义开源了 Qwen3-Coder 模型，该模型在编程能力上超越了诸多闭源模型，能力上比肩全球最强的编程模型 Claude 4。来源",
                            "isLeafNode": true
                        }
                    ],
                    "level": "2",
                    "parent": 1,
                    "immutable": false,
                    "child": []
                }
            ]
        },
        "Introducing New Electric Vehicles": {
            "id": 2,
            "intent": "Introducing New Electric Vehicles",
            "description": "Providing details about the launch of new electric vehicles, including specifications, design features, and advanced technologies that enhance driving experience and safety.",
            "priority": 5,
            "child_num": 1,
            "group": [],
            "level": "1",
            "parent": null,
            "immutable": false,
            "child": [
                {
                    "id": 5,
                    "intent": "Detailing Electric Vehicle Features",
                    "description": "Describing the technical specifications and innovative features of new electric vehicles, emphasizing energy efficiency, design, and safety enhancements.",
                    "priority": 5,
                    "child_num": 0,
                    "group": [
                        {
                            "id": 1753939828523,
                            "comment": "",
                            "content": "7 月 29 日，理想汽车在北京首都国际会议中心发布家庭六座纯电 SUV 理想 i8，定价 32.18-36.98 万元，8 月 20 日开启交付",
                            "context": "7 月 29 日，理想汽车在北京首都国际会议中心发布家庭六座纯电 SUV 理想 i8，定价 32.18-36.98 万元，8 月 20 日开启交付。",
                            "isLeafNode": true
                        },
                        {
                            "id": 1753939838226,
                            "comment": "",
                            "content": "理想 i8 采用风阻流线造型，配备立体式星环灯，风阻系数仅 0.218；全车采用大量隔声优化设计，前风挡、侧窗、天幕均采用双层声学夹胶玻璃，此外第一排搭载四个智能静音电动出风口",
                            "context": "理想 i8 采用风阻流线造型，配备立体式星环灯，风阻系数仅 0.218；全车采用大量隔声优化设计，前风挡、侧窗、天幕均采用双层声学夹胶玻璃，此外第一排搭载四个智能静音电动出风口；搭载「5C 纯电平台」，全系标配三元锂 5C 超充电池，提供 90.1kWh 和 97.8kWh 两种电池版本，CLTC 续航分别达到 670 公里和 720 公里，在 0-80% 的电量区间内可持续提供 300kW 以上的充电功率；采用具备空间理解能力、思维能力、记忆和沟通能力的 VLA 司机大模型，全系标配激光雷达，在原有 AEB、AES 的基础上增加了慢车加塞、恶意别车、美式截停等，更多场景、更高难度的主动安全能力。来源",
                            "isLeafNode": true
                        }
                    ],
                    "level": "2",
                    "parent": 2,
                    "immutable": false,
                    "child": []
                }
            ]
        },
        "Explaining AI Feature Enhancements": {
            "id": 3,
            "intent": "Explaining AI Feature Enhancements",
            "description": "Detailing the introduction of new artificial intelligence features aimed at improving user interaction and fostering critical thinking skills through interactive modes.",
            "priority": 5,
            "child_num": 0,
            "group": [
                {
                    "id": 1753939843428,
                    "comment": "",
                    "content": "7 月 29 日，OpenAI 宣布向 ChatGPT 的免费和付费用户推出「研究与学习」模式，该模式旨在帮助使用者建立批判思维能力，启用后 ChatGPT 不仅会主动提问来确认用户的信息理解情况，偶尔也会拒绝直接提供答案",
                    "context": "7 月 29 日，OpenAI 宣布向 ChatGPT 的免费和付费用户推出「研究与学习」模式，该模式旨在帮助使用者建立批判思维能力，启用后 ChatGPT 不仅会主动提问来确认用户的信息理解情况，偶尔也会拒绝直接提供答案。",
                    "isLeafNode": true
                }
            ],
            "level": "1",
            "parent": null,
            "immutable": false,
            "child": []
        }
    }
}

// Mock group data
const mockGroupData = {
    "groupsOfNodes": [
        {
            "records": [
                {
                    "id": 1753934889130,
                    "comment": "",
                    "content": "7 月 28 日，微软为 Edge 浏览器引入 Copilot 模式，模式在 Copilot 上线的所有地区可用。开启该模式后，新建标签页会被替换为全新设计的对话框界面。Copilot 可以在对话中基于打开的所有标签页回答问题，支持语音页面导航，可以提供页面快速总结，还可以在开始浏览时提示你继续完成上次浏览的话题。",
                    "context": "7 月 28 日，微软为 Edge 浏览器引入 Copilot 模式，模式在 Copilot 上线的所有地区可用。开启该模式后，新建标签页会被替换为全新设计的对话框界面。Copilot 可以在对话中基于打开的所有标签页回答问题，支持语音页面导航，可以提供页面快速总结，还可以在开始浏览时提示你继续完成上次浏览的话题。用户可以在官方页面打开该设置。来源",
                    "isLeafNode": true
                },
                {
                    "id": 1753939843428,
                    "comment": "",
                    "content": "7 月 29 日，OpenAI 宣布向 ChatGPT 的免费和付费用户推出「研究与学习」模式，该模式旨在帮助使用者建立批判思维能力，启用后 ChatGPT 不仅会主动提问来确认用户的信息理解情况，偶尔也会拒绝直接提供答案",
                    "context": "7 月 29 日，OpenAI 宣布向 ChatGPT 的免费和付费用户推出「研究与学习」模式，该模式旨在帮助使用者建立批判思维能力，启用后 ChatGPT 不仅会主动提问来确认用户的信息理解情况，偶尔也会拒绝直接提供答案。",
                    "isLeafNode": true
                }
            ],
            "intent_id": 1,
            "intent_name": "____",
            "intent_description": "____",
            "level": "1",
            "parent": null
        },
        {
            "records": [
                {
                    "id": 1753939828523,
                    "comment": "",
                    "content": "7 月 29 日，理想汽车在北京首都国际会议中心发布家庭六座纯电 SUV 理想 i8，定价 32.18-36.98 万元，8 月 20 日开启交付",
                    "context": "7 月 29 日，理想汽车在北京首都国际会议中心发布家庭六座纯电 SUV 理想 i8，定价 32.18-36.98 万元，8 月 20 日开启交付。",
                    "isLeafNode": true
                },
                {
                    "id": 1753939838226,
                    "comment": "",
                    "content": "理想 i8 采用风阻流线造型，配备立体式星环灯，风阻系数仅 0.218；全车采用大量隔声优化设计，前风挡、侧窗、天幕均采用双层声学夹胶玻璃，此外第一排搭载四个智能静音电动出风口",
                    "context": "理想 i8 采用风阻流线造型，配备立体式星环灯，风阻系数仅 0.218；全车采用大量隔声优化设计，前风挡、侧窗、天幕均采用双层声学夹胶玻璃，此外第一排搭载四个智能静音电动出风口；搭载「5C 纯电平台」，全系标配三元锂 5C 超充电池，提供 90.1kWh 和 97.8kWh 两种电池版本，CLTC 续航分别达到 670 公里和 720 公里，在 0-80% 的电量区间内可持续提供 300kW 以上的充电功率；采用具备空间理解能力、思维能力、记忆和沟通能力的 VLA 司机大模型，全系标配激光雷达，在原有 AEB、AES 的基础上增加了慢车加塞、恶意别车、美式截停等，更多场景、更高难度的主动安全能力。来源",
                    "isLeafNode": true
                }
            ],
            "intent_id": 2,
            "intent_name": "____",
            "intent_description": "____",
            "level": "1",
            "parent": null
        },
        {
            "records": [
                {
                    "id": 1753939879306,
                    "comment": "",
                    "content": "阿里云于 7 月 26 日宣布通义灵码上线 Qwen3-Coder，即日起用户可在通义灵码 AIIDE、VSCode 和 Jetbrains 插件端免费使用。使用上没有限制，不限量服务也无需邀请码",
                    "context": "阿里云于 7 月 26 日宣布通义灵码上线 Qwen3-Coder，即日起用户可在通义灵码 AIIDE、VSCode 和 Jetbrains 插件端免费使用。使用上没有限制，不限量服务也无需邀请码。此前阿里云通义开源了 Qwen3-Coder 模型，该模型在编程能力上超越了诸多闭源模型，能力上比肩全球最强的编程模型 Claude 4。来源",
                    "isLeafNode": true
                }
            ],
            "intent_id": 3,
            "intent_name": "____",
            "intent_description": "____",
            "level": "1",
            "parent": null
        },
        {
            "records": [
                [
                    {
                        "id": 1753934889130,
                        "comment": "",
                        "content": "7 月 28 日，微软为 Edge 浏览器引入 Copilot 模式，模式在 Copilot 上线的所有地区可用。开启该模式后，新建标签页会被替换为全新设计的对话框界面。Copilot 可以在对话中基于打开的所有标签页回答问题，支持语音页面导航，可以提供页面快速总结，还可以在开始浏览时提示你继续完成上次浏览的话题。",
                        "context": "7 月 28 日，微软为 Edge 浏览器引入 Copilot 模式，模式在 Copilot 上线的所有地区可用。开启该模式后，新建标签页会被替换为全新设计的对话框界面。Copilot 可以在对话中基于打开的所有标签页回答问题，支持语音页面导航，可以提供页面快速总结，还可以在开始浏览时提示你继续完成上次浏览的话题。用户可以在官方页面打开该设置。来源",
                        "isLeafNode": true
                    }
                ],
                [
                    {
                        "id": 1753939843428,
                        "comment": "",
                        "content": "7 月 29 日，OpenAI 宣布向 ChatGPT 的免费和付费用户推出「研究与学习」模式，该模式旨在帮助使用者建立批判思维能力，启用后 ChatGPT 不仅会主动提问来确认用户的信息理解情况，偶尔也会拒绝直接提供答案",
                        "context": "7 月 29 日，OpenAI 宣布向 ChatGPT 的免费和付费用户推出「研究与学习」模式，该模式旨在帮助使用者建立批判思维能力，启用后 ChatGPT 不仅会主动提问来确认用户的信息理解情况，偶尔也会拒绝直接提供答案。",
                        "isLeafNode": true
                    }
                ]
            ],
            "intent_id": 4,
            "intent_name": "____",
            "intent_description": "____",
            "level": "2",
            "parent": 1
        },
        {
            "records": [
                [
                    {
                        "id": 1753939828523,
                        "comment": "",
                        "content": "7 月 29 日，理想汽车在北京首都国际会议中心发布家庭六座纯电 SUV 理想 i8，定价 32.18-36.98 万元，8 月 20 日开启交付",
                        "context": "7 月 29 日，理想汽车在北京首都国际会议中心发布家庭六座纯电 SUV 理想 i8，定价 32.18-36.98 万元，8 月 20 日开启交付。",
                        "isLeafNode": true
                    },
                    {
                        "id": 1753939838226,
                        "comment": "",
                        "content": "理想 i8 采用风阻流线造型，配备立体式星环灯，风阻系数仅 0.218；全车采用大量隔声优化设计，前风挡、侧窗、天幕均采用双层声学夹胶玻璃，此外第一排搭载四个智能静音电动出风口",
                        "context": "理想 i8 采用风阻流线造型，配备立体式星环灯，风阻系数仅 0.218；全车采用大量隔声优化设计，前风挡、侧窗、天幕均采用双层声学夹胶玻璃，此外第一排搭载四个智能静音电动出风口；搭载「5C 纯电平台」，全系标配三元锂 5C 超充电池，提供 90.1kWh 和 97.8kWh 两种电池版本，CLTC 续航分别达到 670 公里和 720 公里，在 0-80% 的电量区间内可持续提供 300kW 以上的充电功率；采用具备空间理解能力、思维能力、记忆和沟通能力的 VLA 司机大模型，全系标配激光雷达，在原有 AEB、AES 的基础上增加了慢车加塞、恶意别车、美式截停等，更多场景、更高难度的主动安全能力。来源",
                        "isLeafNode": true
                    }
                ]
            ],
            "intent_id": 5,
            "intent_name": "____",
            "intent_description": "____",
            "level": "2",
            "parent": 2
        }
    ],
    "granularity": {
        "familiarity": "neutral",
        "specificity": "moderate"
    }
}