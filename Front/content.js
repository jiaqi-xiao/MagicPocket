let selectedText = "";
let contextMenu = null;
let floatingWindow = null;

function initializeExtension() {
  console.log("Initializing extension");
  createFloatingWindow();
  addGlobalEventListeners();
}

function createFloatingWindow() {
  console.log("Creating floating window");
  floatingWindow = document.createElement("div");
  floatingWindow.className = "floating-window";
  floatingWindow.textContent = "📌";
  document.body.appendChild(floatingWindow);

  floatingWindow.addEventListener("mouseover", showRecordedItems);
  floatingWindow.addEventListener("click", toggleLists);
}

function addGlobalEventListeners() {
  console.log("Adding global event listeners");
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mousedown", handleGlobalMouseDown);
}

function handleMouseUp(e) {
  e.stopPropagation(); // 阻止事件冒泡
  selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    console.log("Text selected:", selectedText);
    // setTimeout(() => showContextMenu(e.pageX, e.pageY), 0);
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY - 50; // 30px above the selection
    
    setTimeout(() => showContextMenu(x, y), 0);
  } else {
    removeContextMenu();
  }
}

function showContextMenu(x, y) {
  console.log("Showing context menu");
  removeContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "wcr-context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.position = "absolute";
  contextMenu.style.zIndex = "9999";

  const saveButton = document.createElement("button");
  saveButton.className = "wcr-save-button";
  saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';
  saveButton.title = "Save Selection";

  const commentButton = document.createElement("button");
  commentButton.className = "wcr-comment-button";
  commentButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  commentButton.title = "Add Comment to Selection";

  contextMenu.appendChild(saveButton);
  contextMenu.appendChild(commentButton);
  document.body.appendChild(contextMenu);

  console.log("Context menu created and added to DOM");

  commentButton.addEventListener("click", () => {
    const comment = prompt("Enter your comment:");
    if (comment !== null) {
      saveSelectionWithComment(comment);
    }
  });
}

function saveSelectionWithComment(comment) {
  console.log("Saving selection with comment:", selectedText, comment);
  const paragraph = window.getSelection().anchorNode.parentElement;
  const data = {
    type: "text",
    content: selectedText,
    comment: comment,
    paragraph: paragraph.textContent,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
  console.log("Data to save:", data);

  chrome.runtime.sendMessage({ action: "saveData", data: data }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError);
    } else {
      console.log("Save response:", response);
      removeContextMenu();
      // 清除选中状态
      window.getSelection().removeAllRanges();
    }
  });
}

function handleGlobalMouseDown(e) {
  console.log("Global mousedown detected", e.target);
  if (contextMenu) {
    if (contextMenu.contains(e.target)) {
      console.log("Mousedown inside context menu");
      if (e.target.closest('.wcr-save-button')) {
        console.log("Save button clicked");
        saveSelection();
      }
    } else {
      console.log("Mousedown outside context menu");
      removeContextMenu();
    }
  }
}


function saveSelection() {
  console.log("Saving selection:", selectedText);
  const paragraph = window.getSelection().anchorNode.parentElement;
  const data = {
    type: "text",
    content: selectedText,
    paragraph: paragraph.textContent,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
  console.log("Data to save:", data);

  chrome.runtime.sendMessage({ action: "saveData", data: data }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError);
    } else {
      console.log("Save response:", response);
      removeContextMenu();
      // 清除选中状态
      window.getSelection().removeAllRanges();
    }
  });
  
}

function removeContextMenu() {
  if (contextMenu) {
    console.log("Removing context menu");
    contextMenu.remove();
    contextMenu = null;
  }
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
    recordsContainer.style.padding = "10px";
    recordsContainer.style.borderRadius = "4px";
    recordsContainer.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
    recordsContainer.style.zIndex = "1000";
    document.body.appendChild(recordsContainer);

    let floatingWindow = document.getElementById("floatingWindow");

    // 添加鼠标移开事件监听器
    recordsContainer.addEventListener("mouseleave", () => {
      recordsContainer.style.display = "none";
    });
  }

  // 显示记录容器和浮动窗口
  recordsContainer.style.display = "block";
  floatingWindow.style.display = "block";

  // 清空容器内容
  recordsContainer.innerHTML = "";

  // 获取记录并显示
  chrome.storage.sync.get("records", (data) => {
    const records = data.records || [];

    if (records.length === 0) {
      recordsContainer.innerHTML = "<p>No items saved yet.</p>";
    } else {
      records.forEach((record, index) => {
        const item = document.createElement("div");
        item.className = "record-item";
        item.innerHTML = `
          <strong>${record.type === "text" ? "Text" : "Image"}</strong>
          <p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>
          ${record.comment ? `<p class="comment" style="font-size: 0.9em; color: #666;">Comment: ${record.comment}</p>` : ''}
          <small>${new Date(record.timestamp).toLocaleString()}</small>
          <button class="delete-btn" data-index="${index}">删除</button>
        `;
        item.addEventListener("click", (e) => {
          if (!e.target.classList.contains("delete-btn")) {
            const url = chrome.runtime.getURL(`records.html?index=${index}`);
            // window.location.href = url;
            window.open(url, "_blank");
          }
        });
        recordsContainer.appendChild(item);
      });

      // clearAllBtn
      const clearAllBtn = document.createElement("button");
      clearAllBtn.id = "clearAllBtn";
      clearAllBtn.textContent = "Clear All";
      recordsContainer.appendChild(clearAllBtn);

      // startGenerateBtn
      const startGenerateBtn = document.createElement("button");
      startGenerateBtn.id = "startGenerateBtn";
      startGenerateBtn.textContent = "Start Generation";
      recordsContainer.appendChild(startGenerateBtn);

      startGenerateBtn.addEventListener("click", () => {
          const url = chrome.runtime.getURL(`start_generation.html`);
          window.open(url, "_blank");
      });

      // showIntentBtn
      const showIntentBtn = document.createElement("button");
      showIntentBtn.id = "showIntentBtn";
      showIntentBtn.textContent = "Show Intent";
      recordsContainer.appendChild(showIntentBtn);

      showIntentBtn.addEventListener("click", () => {
        showUserIntent();
      });



      clearAllBtn.addEventListener("click", () => {
        chrome.storage.sync.set({ records: [] }, () => {
          showRecordedItems();
        });
      });

      recordsContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn")) {
          const index = parseInt(e.target.getAttribute("data-index"));
          deleteRecord(index);
        }
      });
    }
  });

  // 添加鼠标移开事件监听器
  let hideTimeout;
  const hideContainers = () => {
    hideTimeout = setTimeout(() => {
      recordsContainer.style.display = "none";
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

function deleteRecord(index) {
  chrome.storage.sync.get("records", (data) => {
    const records = data.records || [];
    records.splice(index, 1);
    chrome.storage.sync.set({ records: records }, () => {
      showRecordedItems();
    });
  });
}

function toggleLists() {
  console.log("Toggling lists");
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

function showUserIntent() {
  console.log("显示用户意图");
  
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#97C8EB'];

  // 模拟的用户意图数据
  let intentData = [
    {
      id: 1,
      name: '文化体验',
      score: 9,
      children: [
        { id: 11, name: '打卡景点', score: 9 },
        { id: 12, name: '建筑欣赏', score: 9 },
        { id: 13, name: '历史探秘', score: 7 },
        { id: 14, name: '艺术鉴赏', score: 7 }
      ]
    },
    {
      id: 2,
      name: '自然探索',
      score: 8,
      children: [
        { id: 21, name: '观赏日落', score: 8 },
        { id: 22, name: '海滩日光浴', score: 6 }
      ]
    },
    {
      id: 3,
      name: '浪漫时光',
      score: 9,
      children: [
        { id: 31, name: '参加婚礼', score: 10 },
        { id: 32, name: '城市漫步', score: 8 }
      ]
    },
    {
      id: 4,
      name: '美食品尝',
      score: 7,
      children: [
        { id: 41, name: '品尝美酒', score: 6 }
      ]
    },
    {
      id: 5,
      name: '放松身心',
      score: 8,
      children: [
        { id: 51, name: '拍照留念', score: 9 },
        { id: 52, name: '悠闲午后', score: 6 }
      ]
    }
  ];

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
    intentContainer.style.padding = "15px";
    intentContainer.style.borderRadius = "8px";
    intentContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    intentContainer.style.maxHeight = floatingRecordsContainerHeight+"px";
    intentContainer.style.overflowY = "auto";
    floatingRecordsContainer.appendChild(intentContainer);
  }

  // 清空容器内容
  intentContainer.innerHTML = "<h2 style='text-align: center; color: #FFFFFF; margin-bottom: 20px;'>旅行意图可视化</h2>";

  function createIntentBar(item, color, maxScore, level = 0) {
    const barContainer = document.createElement("div");
    barContainer.style.marginBottom = "15px";
    barContainer.style.paddingLeft = `${level * 20}px`;

    const barWrapper = document.createElement("div");
    barWrapper.style.display = "flex";
    barWrapper.style.alignItems = "center";
    barWrapper.style.marginBottom = "5px";

    const bar = document.createElement("div");
    const width = (item.score / maxScore) * 100;
    bar.style.width = `${width}%`;
    bar.style.height = "30px";
    bar.style.backgroundColor = color;
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "space-between";
    bar.style.paddingLeft = "10px";
    bar.style.paddingRight = "10px";
    bar.style.color = "#1A1A1A";
    bar.style.fontWeight = "bold";
    bar.style.borderRadius = "4px";
    bar.style.transition = "width 0.3s ease-in-out";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${item.name} (${item.score})`;
    bar.appendChild(nameSpan);

    const controlsDiv = document.createElement("div");
    controlsDiv.style.display = "flex";
    controlsDiv.style.alignItems = "center";

    const increaseButton = document.createElement("button");
    increaseButton.innerHTML = "▲";
    increaseButton.style.marginLeft = "5px";
    increaseButton.style.background = "none";
    increaseButton.style.border = "none";
    increaseButton.style.cursor = "pointer";
    increaseButton.style.color = "#1A1A1A";
    increaseButton.onclick = () => updateScore(item.id, item.score + 1);

    const decreaseButton = document.createElement("button");
    decreaseButton.innerHTML = "▼";
    decreaseButton.style.background = "none";
    decreaseButton.style.border = "none";
    decreaseButton.style.cursor = "pointer";
    decreaseButton.style.color = "#1A1A1A";
    decreaseButton.onclick = () => updateScore(item.id, Math.max(0, item.score - 1));

    controlsDiv.appendChild(increaseButton);
    controlsDiv.appendChild(decreaseButton);
    bar.appendChild(controlsDiv);

    barWrapper.appendChild(bar);
    barContainer.appendChild(barWrapper);

    if (item.children) {
      item.children.forEach(child => {
        barContainer.appendChild(createIntentBar(child, "#4A4A4A", maxScore, level + 1));
      });
    }

    return barContainer;
  }

  function updateScore(id, newScore) {
    const updateItem = (items) => {
      return items.map(item => {
        if (item.id === id) {
          return { ...item, score: newScore };
        }
        if (item.children) {
          return { ...item, children: updateItem(item.children) };
        }
        return item;
      });
    };
    intentData = updateItem(intentData);
    renderIntentBars();
  }

  function renderIntentBars() {
    const maxScore = Math.max(
      ...intentData.map(item => item.score),
      ...intentData.flatMap(item => item.children.map(child => child.score))
    );

    intentContainer.innerHTML = "<h2 style='text-align: center; color: #FFFFFF; margin-bottom: 20px;'>旅行意图可视化</h2>";
    intentData.forEach((item, index) => {
      intentContainer.appendChild(createIntentBar(item, COLORS[index], maxScore));
    });
  }

  renderIntentBars();

  // 添加关闭按钮
  const closeButton = document.createElement("button");
  closeButton.textContent = "关闭";
  closeButton.style.marginTop = "10px";
  closeButton.style.padding = "5px 10px";
  closeButton.style.backgroundColor = "#4A4A4A";
  closeButton.style.color = "#FFFFFF";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "4px";
  closeButton.style.cursor = "pointer";
  closeButton.addEventListener("click", () => {
    intentContainer.style.display = "none";
  });
  intentContainer.appendChild(closeButton);

  // 显示意图容器
  intentContainer.style.display = "block";
}