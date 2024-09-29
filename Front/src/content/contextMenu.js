function handleMouseUp(e) {
    e.stopPropagation();
    selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        console.log("Text selected:", selectedText);
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const x = rect.left + window.scrollX;
        const y = rect.top + window.scrollY - 50;

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