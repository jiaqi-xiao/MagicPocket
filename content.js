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
    setTimeout(() => showContextMenu(e.pageX, e.pageY), 0);
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
  saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>';
  saveButton.title = "Save Selection";

  contextMenu.appendChild(saveButton);
  document.body.appendChild(contextMenu);

  console.log("Context menu created and added to DOM");
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
    }
  });
  removeContextMenu();
}

function removeContextMenu() {
  if (contextMenu) {
    console.log("Removing context menu");
    contextMenu.remove();
    contextMenu = null;
  }
}

function showRecordedItems() {
  console.log("Showing recorded items");
  chrome.storage.sync.get("mp_mark_records", (data) => {
    const records = data.records || [];
    console.log("Recorded items:", records);
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