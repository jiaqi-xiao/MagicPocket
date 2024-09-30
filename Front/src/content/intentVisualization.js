function clickUserIntentBtn() {
    // if current intentContainer is not null, then delete it
    if (document.getElementById("intentVisualizationContainer")) {
        document.getElementById("intentVisualizationContainer").remove();
        showIntentBtn.textContent = "Show Intent";
        console.log("disappear intentContainer");
        return;
    }
    console.log("show intentContainer");

    showUserIntentVisualization();

    // 修改showIntentBtn文字内容为 Hide Intent
    showIntentBtn.textContent = "Hide Intent";
    isIntentVisible = true;
}

function showUserIntentVisualization() {
    let intentContainer = document.getElementById("intentVisualizationContainer");
    if (intentContainer) {
        intentContainer.style.display = "block";
    } else {
        createUserIntentVisualization();
    }
}

function createUserIntentVisualization() {
    const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#97C8EB'];

    // 模拟的新用户意图数据结构
    let intentData = {
        id: 1,
        intent: "根意图",
        priority: 8,
        child_num: 3,
        child: [
            {
                id: 2,
                intent: "子意图1",
                priority: 7,
                child_num: 2,
                child: [
                    {
                        id: 4,
                        intent: "孙意图1",
                        priority: 6,
                        child_num: 0,
                        child: []
                    },
                    {
                        id: 5,
                        intent: "孙意图2",
                        priority: 5,
                        child_num: 0,
                        child: []
                    }
                ]
            },
            {
                id: 3,
                intent: "子意图2",
                priority: 6,
                child_num: 1,
                child: [
                    {
                        id: 6,
                        comment: "评论内容",
                        context: "上下文内容",
                        vector: [[0.1, 0.2, 0.3]]
                    }
                ]
            }
        ]
    };

    // 获取 floatingRecordsContainer
    let floatingRecordsContainer = document.getElementById("floatingRecordsContainer");
    if (!floatingRecordsContainer) {
        console.log("浮动列表窗口不存在");
        return;
    }
    let floatingRecordsContainerHeight = floatingRecordsContainer.offsetHeight;

    // 创建或获取意图可视化容器
    let intentContainer = floatingWindow.querySelector("#intentVisualizationContainer");
    if (!intentContainer) {
        intentContainer = document.createElement("div");
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
        floatingRecordsContainer.appendChild(intentContainer);
    }

    // 清空容器内容并添加标题和刷新按钮
    intentContainer.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #FFFFFF; margin: 0;">Intent Visualization</h2>
            <button id="manualRefreshIntentBtn" style="margin-left: 10px; background: none; border: none; cursor: pointer; color: #FFFFFF;">🔄</button>
        </div>
    `;

    // 添加刷新按钮的点击事件
    const manualRefreshIntentBtn = intentContainer.querySelector("#manualRefreshIntentBtn");
    manualRefreshIntentBtn.addEventListener("click", () => {
        console.log("刷新Intent可视化内容");
        renderIntentBars();
    });

    function createIntentBar(item, color, maxPriority, level = 0) {
        const barContainer = document.createElement("div");
        barContainer.style.marginBottom = "15px";
        barContainer.style.paddingLeft = `${level * 20}px`;

        const barWrapper = document.createElement("div");
        barWrapper.style.display = "flex";
        barWrapper.style.alignItems = "center";
        barWrapper.style.marginBottom = "5px";
        barWrapper.style.cursor = "move";
        barWrapper.draggable = true;
        barWrapper.dataset.id = item.id;
        barWrapper.dataset.level = level;

        barWrapper.addEventListener("dragstart", handleDragStart);
        barWrapper.addEventListener("dragover", handleDragOver);
        barWrapper.addEventListener("drop", handleDrop);

        const bar = document.createElement("div");
        const width = (item.priority / maxPriority) * 100;
        bar.style.width = `${width}%`;
        bar.style.height = "30px";
        bar.style.backgroundColor = color;
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.paddingLeft = "10px";
        bar.style.paddingRight = "10px";
        bar.style.color = "#1A1A1A";
        bar.style.fontWeight = "bold";
        bar.style.borderRadius = "4px";
        bar.style.transition = "width 0.3s ease-in-out";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${item.intent} [${item.child_num}]`;
        bar.appendChild(nameSpan);

        barWrapper.appendChild(bar);
        barContainer.appendChild(barWrapper);

        if (item.child && item.child.length > 0) {
            item.child.forEach((child, index) => {
                if (child.intent) {
                    barContainer.appendChild(createIntentBar(child, COLORS[(level + 1) % COLORS.length], maxPriority, level + 1));
                }
            });
        }

        return barContainer;
    }

    function handleDragStart(e) {
        e.dataTransfer.setData("text/plain", e.target.dataset.id);
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleDrop(e) {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text");
        const targetId = e.target.closest("[draggable]").dataset.id;
        
        if (draggedId !== targetId) {
            updateIntentOrder(draggedId, targetId);
            renderIntentBars();
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
        
        updateOrder([intentData]);
    }

    function renderIntentBars() {
        const findMaxPriority = (item) => {
            let max = item.priority || 0;
            if (item.child) {
                for (let child of item.child) {
                    max = Math.max(max, findMaxPriority(child));
                }
            }
            return max;
        };
        const maxPriority = findMaxPriority(intentData);

        // 保留标题和刷新按钮，只清除意图条
        const titleAndButton = intentContainer.querySelector("div");
        intentContainer.innerHTML = "";
        intentContainer.appendChild(titleAndButton);

        // 递归更新所有意图的优先级
        function updatePriorities(items, basePriority) {
            items.forEach((item, index) => {
                item.priority = basePriority - index;
                if (item.child && item.child.length > 0) {
                    updatePriorities(item.child, item.priority - 1);
                }
            });
        }

        updatePriorities([intentData], findMaxPriority(intentData));

        intentContainer.appendChild(createIntentBar(intentData, COLORS[0], findMaxPriority(intentData)));
    }

    renderIntentBars();

    // 显示意图容器
    intentContainer.style.display = "block";
}
