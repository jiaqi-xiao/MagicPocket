let selectedText = "";
let contextMenu = null;
let floatingWindow = null;
let isIntentVisible = false;

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
