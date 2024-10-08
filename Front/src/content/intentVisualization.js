const backendDomain = "http://127.0.0.1:8000"
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
    let floatingRecordsContainer = document.getElementById("floatingRecordsContainer");
    if (!floatingRecordsContainer) {
        console.error("No floatingRecordsContainer found");
        return;
    }

    let intentContainer = document.createElement("div");
    intentContainer.id = "intentVisualizationContainer";
    intentContainer.style.position = "absolute";
    intentContainer.style.left = "-300px";
    intentContainer.style.top = "0";
    intentContainer.style.width = "280px";
    intentContainer.style.backgroundColor = "#2A2A2A";
    intentContainer.style.color = "#E0E0E0";
    intentContainer.style.border = "1px solid #ccc";
    intentContainer.style.borderRadius = "8px";
    intentContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    intentContainer.style.height = "70vh";
    intentContainer.style.overflowY = "auto";
    intentContainer.style.display = "flex";
    intentContainer.style.flexDirection = "column";

    const header = document.createElement("div");
    header.style.padding = "10px";
    header.style.borderBottom = "1px solid #ccc";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    header.innerHTML = `
        <h2 style="color: #FFFFFF; margin: 0;">User Intent</h2>
        <button id="refreshIntentBtn" style="background: none; border: none; cursor: pointer; color: #FFFFFF;">🔄</button>
    `;

    const content = document.createElement("div");
    content.style.flex = "1";
    content.style.overflowY = "auto";
    content.style.padding = "10px";

    intentContainer.appendChild(header);
    intentContainer.appendChild(content);

    const refreshBtn = header.querySelector("#refreshIntentBtn");
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

    const content = intentContainer.querySelector("div:last-child");
    content.innerHTML = "";

    intentData.forEach(intentItem => {
        createIntentTree(intentItem, content);
    });
}

function createIntentTree(intentData, container, level = 0, parentWidth = 100) {
    const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#97C8EB'];
    const minPriority = findMinPriority(intentData);

    // 验证 intentData
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
        const width = (minPriority / intentData.priority) * parentWidth;
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
        // format intentData.intent drop special character
        intentData.intent = intentData.intent.replace(/[`~!@#$%^&*()_\-+=\[\]{};:'"\\|<>\/?]/g, ' ');
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
                createIntentTree(childIntent, childContainer, level + 1, width);
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
                item.priority = index + 1;
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

function findMinPriority(item) {
    let min = item.priority || Infinity;
    if (item.child) {
        for (let child of item.child) {
            min = Math.min(min, findMinPriority(child));
        }
    }
    return min;
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
                    const formattedData = { data: records };
                    console.log("Data send to /embed_all:", JSON.stringify(formattedData));
                    return fetch(`${backendDomain}/embed_all`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formattedData),
                        mode: 'cors' // 添加这一行
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
                    // console.log("Received from /embed_all:", JSON.stringify(embeddedData));
                    const recordsList = embeddedData;
                    const distance_threshold = 0.5; // 设置适当的阈值
                    const level = 3;
                    const intent_num = 2;
                    // console.log("Data send to /cluster/:", JSON.stringify(recordsList));
                    return fetch(`${backendDomain}/cluster/?distance_threshold=${distance_threshold}&level=${level}&intent_num=${intent_num}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(recordsList)
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        console.warn('Cluster API request failed');
                        return response.json().then(errorData => {
                            console.error("Cluster Error detail:", errorData);
                            throw new Error("Cluster failed");
                        });
                    }
                    return response.json();
                })
                .then(intentData => {
                    console.log("Received from /cluster:", JSON.stringify(intentData));
                    return processClusterData(intentData);
                })
                .catch(error => {
                    console.warn('Failed to fetch intent data, using fallback test data', error);
                    return [getFallbackData()];
                })
                .then(resolve)
                .finally(() => {
                    isAnalysisIntent = false;
                });
        }, 0);
    });
}

function processClusterData(clusterData) {
    // 处理集群数据，将其转换为所需的格式
    function processNode(node) {
        let processedNode = {
            id: node.id,
            intent: node.intent,
            priority: 1, // 默认值为1
            child_num: node.child ? node.child.length : 0,
            child: []
        };

        if (node.child) {
            processedNode.child = node.child.map(childNode => {
                if (childNode.intent) {
                    // 这是一个中间节点
                    return processNode(childNode);
                } else {
                    // 这是一个叶子节点（原始记录）
                    return {
                        id: childNode.id,
                        comment: childNode.comment,
                        context: childNode.context
                    };
                }
            });
        }

        return processedNode;
    }

    return clusterData.map(processNode);
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
        chrome.storage.local.get("records", (data) => {
            const records = data.records || [];

            // 格式化记录以适应后端需求
            let formattedRecords = records.map((record) => {
                return {
                    id: record.id,
                    comment: record.comment || null, // 确保 comment 可以为 null
                    context: record.paragraph,
                    content: record.content
                }
            });

            resolve(formattedRecords);
        });
    });
}