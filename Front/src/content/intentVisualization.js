const backendDomain = "https://your-backend-domain.com/"
let gIntentDataList = []
let isAnalysisIntent = false

function clickUserIntentBtn() {
    // if current intentContainer is not null, then delete it
    if (document.getElementById("intentVisualizationContainer")) {
        document.getElementById("intentVisualizationContainer").remove();
        showIntentBtn.textContent = "Show Intent";
        console.log("disappear intentContainer");
        return;
    }
    console.log("show intentContainer");

    isIntentVisible = true;
    showUserIntentVisualization();

    // 修改showIntentBtn文字内容为 Hide Intent
    showIntentBtn.textContent = "Hide Intent";
}

function showUserIntentVisualization() {
    let intentContainer = document.getElementById("intentVisualizationContainer");
    if (!intentContainer) {
        intentContainer = createIntentContainer();
    }
    
    intentContainer.style.display = "block";
    showLoadingAnimation();
    
    fetchIntentDataFromBackend()
        .then(intentData => {
            hideLoadingAnimation();
            gIntentDataList = intentData;
            renderIntentVisualization(gIntentDataList);
        })
        .catch(error => {
            hideLoadingAnimation();
            console.log("Fail in fetching intent data", error);
        });
}

function createIntentContainer() {
    // 获取 floatingRecordsContainer
    let floatingRecordsContainer = document.getElementById("floatingRecordsContainer");
    if (!floatingRecordsContainer) {
        console.error("No floatingRecordsContainer found");
        return;
    }
    let floatingRecordsContainerHeight = floatingRecordsContainer.offsetHeight;

    // 创建意图可视化容器
    let intentContainer = document.createElement("div");
    intentContainer.id = "intentVisualizationContainer";
    intentContainer.style.position = "absolute";
    intentContainer.style.left = "-300px";
    intentContainer.style.top = "0";
    intentContainer.style.width = "280px";
    intentContainer.style.backgroundColor = "#2A2A2A";
    intentContainer.style.color = "#E0E0E0";
    intentContainer.style.border = "1px solid #ccc";
    intentContainer.style.padding = "10px";
    intentContainer.style.borderRadius = "8px";
    intentContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    intentContainer.style.height = floatingRecordsContainerHeight + "px";
    intentContainer.style.overflowY = "auto";

    // 添加标题和刷新按钮
    intentContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #FFFFFF; margin: 0;">User Intent</h2>
            <button id="refreshIntentBtn" style="background: none; border: none; cursor: pointer; color: #FFFFFF;">🔄</button>
        </div>
    `;

    // 添加刷新按钮的点击事件
    const refreshBtn = intentContainer.querySelector("#refreshIntentBtn");
    refreshBtn.addEventListener("click", () => {
        console.log("刷新Intent可视化内容");
        showLoadingAnimation();
        fetchIntentDataFromBackend()
            .then(newIntentData => {
                hideLoadingAnimation();
                gIntentDataList = newIntentData;
                renderIntentVisualization(gIntentDataList);
            })
            .catch(error => {
                hideLoadingAnimation();
                console.warn('Fail in refreshing intent data', error);
            });
    });

    // 将意图容器添加到浮动列表容器中
    floatingRecordsContainer.appendChild(intentContainer);

    return intentContainer;
}

function showLoadingAnimation() {
    let intentContainer = document.getElementById("intentVisualizationContainer");
    if (intentContainer) {
        const loadingElement = document.createElement('div');
        loadingElement.id = 'intentLoadingAnimation';
        loadingElement.textContent = 'Intent Analysis...';
        loadingElement.style.position = 'absolute';
        loadingElement.style.top = '50%';
        loadingElement.style.left = '50%';
        loadingElement.style.transform = 'translate(-50%, -50%)';
        loadingElement.style.background = 'rgba(0, 0, 0, 0.7)';
        loadingElement.style.color = 'white';
        loadingElement.style.padding = '20px';
        loadingElement.style.borderRadius = '5px';
        loadingElement.style.zIndex = '9999';
        loadingElement.style.fontSize = '18px';
        intentContainer.appendChild(loadingElement);
    }
}

function hideLoadingAnimation() {
    const loadingElement = document.getElementById('intentLoadingAnimation');
    if (loadingElement) {
        loadingElement.remove();
    }
}

function renderIntentVisualization(intentData) {
    let intentContainer = document.getElementById("intentVisualizationContainer");
    if (!intentContainer) {
        console.log("创建新的 intentContainer");
        intentContainer = createIntentContainer();
    }

    // 清除现有的树结构
    const existingTree = document.getElementById('intentTreeContainer');
    if (existingTree) {
        existingTree.remove();
    }

    // 创建意图树
    const treeContainer = document.createElement('div');
    treeContainer.id = 'intentTreeContainer';
    intentContainer.appendChild(treeContainer);

    // 遍历intentData数组并为每个元素创建树
    intentData.forEach(intentItem => {
        createIntentTree(intentItem, treeContainer);
    });
}

function createIntentTree(intentData, container, level = 0) {
    const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#97C8EB'];
    const maxPriority = findMaxPriority(intentData);

    // validate intentData
    if (!(!intentData.id || !intentData.intent || !intentData.priority)) {
        const item = document.createElement('div');
        item.style.marginBottom = '15px';
        item.style.paddingLeft = `${level * 20}px`;

        const barWrapper = document.createElement('div');
        barWrapper.style.display = 'flex';
        barWrapper.style.alignItems = 'center';
        barWrapper.style.marginBottom = '5px';
        barWrapper.style.cursor = 'move';
        barWrapper.draggable = true;
        barWrapper.dataset.id = intentData.id;
        barWrapper.dataset.level = level;

        barWrapper.addEventListener('dragstart', handleDragStart);
        barWrapper.addEventListener('dragover', handleDragOver);
        barWrapper.addEventListener('drop', handleDrop);

        const bar = document.createElement('div');
        const width = (intentData.priority / maxPriority) * 100;
        bar.style.width = `${width}%`;
        bar.style.height = '30px';
        bar.style.backgroundColor = COLORS[level % COLORS.length];
        bar.style.display = 'flex';
        bar.style.alignItems = 'center';
        bar.style.paddingLeft = '10px';
        bar.style.paddingRight = '10px';
        bar.style.color = '#1A1A1A';
        bar.style.fontWeight = 'bold';
        bar.style.borderRadius = '4px';
        bar.style.transition = 'width 0.3s ease-in-out';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${intentData.intent} [${intentData.priority}]`;
        bar.appendChild(nameSpan);

        barWrapper.appendChild(bar);
        item.appendChild(barWrapper);

        container.appendChild(item);

        if (intentData.child && intentData.child.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.style.display = 'block'; // 默认展开所有意图
            item.appendChild(childContainer);

            intentData.child.forEach(childIntent => {
                createIntentTree(childIntent, childContainer, level + 1);
            });
        }
    }

    
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text');
    const targetId = e.target.closest('[draggable]').dataset.id;
    
    if (draggedId !== targetId) {
        updateIntentOrder(draggedId, targetId);
        renderIntentVisualization(gIntentDataList);
    }
}

function updateIntentOrder(draggedId, targetId) {
    // 递归查找并更新意图顺序
    function updateOrder(items) {
        const draggedIndex = items.findIndex(item => item.id.toString() === draggedId);
        const targetIndex = items.findIndex(item => item.id.toString() === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [draggedItem] = items.splice(draggedIndex, 1);
            items.splice(targetIndex, 0, draggedItem);
            
            // 更新优先级
            items.forEach((item, index) => {
                item.priority = items.length - index;
            });
            
            return true;
        }
        
        for (let item of items) {
            if (item.child && updateOrder(item.child)) {
                return true;
            }
        }
        
        return false;
    }
    
    updateOrder(gIntentDataList);
}

function findMaxPriority(item) {
    let max = item.priority || 0;
    if (item.child) {
        for (let child of item.child) {
            max = Math.max(max, findMaxPriority(child));
        }
    }
    return max;
}

function fetchIntentDataFromBackend() {
    if (isAnalysisIntent) {
        return;
    }
    
    isAnalysisIntent = true;
    console.log("fetchIntentDataFromBackend isAnalysisIntent", isAnalysisIntent);

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            getAllRecords()
                .then(records => {
                    // Execute embed_all API
                    return fetch(`${backendDomain}/embed_all`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ records: records })
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        console.warn('Embed_all API request failed');
                        return response.json();
                    }
                    return response.json();
                })
                .then(embeddedData => {
                    // Execute cluster API
                    return fetch(`${backendDomain}/cluster`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(embeddedData)
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        console.warn('Cluster API request failed');
                        return response.json();
                    }
                    return response.json();
                })
                .then(intentData => {
                    if (!intentData || !intentData.intent_tree) {
                        console.warn('Invalid intent data format');
                        return [getFallbackData()];
                    }
                    return [intentData.intent_tree];
                })
                .catch(error => {
                    console.warn('Failed to fetch intent data, using fallback test data', error);
                    return [getFallbackData()];
                })
                .then(resolve)
                .finally(() => {
                    isAnalysisIntent = false;
                });
        }, 3000); // 3 seconds delay
    });
}

function getFallbackData() {
    return {
        id: 1,
        intent: "Root Intent",
        priority: 8,
        child_num: 3,
        child: [
            {
                id: 2,
                intent: "Child Intent 1",
                priority: 7,
                child_num: 2,
                child: [
                    {
                        id: 4,
                        intent: "Grandchild Intent 1",
                        priority: 6,
                        child_num: 0,
                        child: []
                    },
                    {
                        id: 5,
                        intent: "Grandchild Intent 2",
                        priority: 5,
                        child_num: 0,
                        child: []
                    }
                ]
            },
            {
                id: 3,
                intent: "Child Intent 2",
                priority: 6,
                child_num: 1,
                child: [
                    {
                        id: 6,
                        comment: "Comment content",
                        context: "Context content",
                        vector: [[0.1, 0.2, 0.3]]
                    }
                ]
            }
        ]
    };
}

function getAllRecords() {
    return new Promise((resolve) => {
        chrome.storage.sync.get("records", (data) => {
            const records = data.records || [];

            // 格式化记录以适应后端需求
            let formattedRecords = records.map((record) => {
                return {
                    id: record.id,
                    comment: record.comment,
                    context: record.context,
                }
            });

            resolve(formattedRecords);
        });
    });
}