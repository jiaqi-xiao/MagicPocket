let isCapturing = false;
let startX, startY;
let screenshotCanvas = null;
let ctx = null;
let overlayDiv = null;
let annotationLayer = null;
let isDrawing = false;
let drawingMode = 'rectangle'; // 'rectangle' 或 'line'
// 添加选区信息的全局变量
let selectionBounds = null;
// 添加新的变量来存储选区矩形
let selectionRect = null;
// 添加新的状态变量
let mode = 'select'; // 'select' 或 'annotate'
let annotations = []; // 存储所有标注
let currentAnnotation = null; // 当前正在绘制的标注
// 在全局变量区域添加
let originalOverflow = null;
// 添加新的全局变量
let wheelHandler = null;
let touchHandler = null;

function initScreenshot() {
    // 重置所有状态变量
    isCapturing = false;
    startX = startY = null;
    screenshotCanvas = null;
    ctx = null;
    overlayDiv = null;
    annotationLayer = null;
    isDrawing = false;
    drawingMode = 'rectangle';
    selectionBounds = null;
    selectionRect = null;
    mode = 'select';
    annotations = [];  // 清空标注数组
    currentAnnotation = null;

    // 禁用页面滚动
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // 禁用滚轮和触控板滚动
    wheelHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    touchHandler = (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    // 添加事件监听器
    document.addEventListener('wheel', wheelHandler, { passive: false });
    document.addEventListener('touchmove', touchHandler, { passive: false });
    
    // 创建截图遮罩层
    overlayDiv = document.createElement('div');
    overlayDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        cursor: crosshair;
    `;

    // 创建标注层
    annotationLayer = document.createElement('canvas');
    annotationLayer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 1000000;
    `;

    document.body.appendChild(overlayDiv);
    document.body.appendChild(annotationLayer);

    // 设置画布尺寸e
    annotationLayer.width = window.innerWidth;
    annotationLayer.height = window.innerHeight;
    ctx = annotationLayer.getContext('2d');

    // 添加工具栏
    addToolbar();
    
    // 添加事件监听
    overlayDiv.addEventListener('mousedown', startCapture);
    overlayDiv.addEventListener('mousemove', updateCapture);
    overlayDiv.addEventListener('mouseup', endCapture);
}

function addToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'screenshot-toolbar';
    toolbar.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: white;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        z-index: 1000001;
        display: flex;
        gap: 10px;
    `;

    const toolButtons = [
        { 
            text: 'Rectangle',
            onClick: () => {
                mode = 'annotate';
                drawingMode = 'rectangle';
                updateToolbarState();
            }
        },
        { 
            text: 'Line', 
            onClick: () => {
                mode = 'annotate';
                drawingMode = 'line';
                updateToolbarState();
            }
        },
        { 
            text: 'Redraw', 
            onClick: () => {
                mode = 'select';
                selectionBounds = null;
                annotations = [];
                updateToolbarState();
                redrawCanvas();
            }
        },
        { text: 'Finish', onClick: completeScreenshot },
        { text: 'Cancel', onClick: cancelScreenshot }
    ];

    toolButtons.forEach(({ text, onClick, icon }) => {
        const button = document.createElement('button');
        button.className = 'screenshot-tool-button';
        button.innerHTML = `${text}`;
        button.style.cssText = `
            background-color: #f5f5f5;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 14px;
            color: #333;
            transition: all 0.2s ease;
        `;
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#e0e0e0';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#f5f5f5';
        });
        button.addEventListener('click', onClick);
        toolbar.appendChild(button);
    });

    document.body.appendChild(toolbar);
}

function createToolButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.marginRight = '10px';
    button.addEventListener('click', onClick);
    return button;
}

function startCapture(e) {
    startX = e.clientX;
    startY = e.clientY;
    
    if (mode === 'select') {
        isCapturing = true;
        selectionBounds = null;
    } else if (mode === 'annotate' && selectionBounds) {
        isDrawing = true;
        currentAnnotation = {
            type: drawingMode,
            startX: e.clientX,
            startY: e.clientY,
            endX: e.clientX,
            endY: e.clientY,
            color: 'red'  // 确保新建标注使用红色
        };
    }
}

function updateCapture(e) {
    ctx.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
    
    if (mode === 'select' && isCapturing) {
        // 更新选区
        const dpr = window.devicePixelRatio;
        selectionBounds = {
            x: Math.min(startX, e.clientX),
            y: Math.min(startY, e.clientY),
            width: Math.abs(e.clientX - startX),
            height: Math.abs(e.clientY - startY),
            dpr: dpr
        };
        drawSelectionRect(selectionBounds);
    } else if (mode === 'annotate' && isDrawing) {
        // 更新当前标注
        currentAnnotation.endX = e.clientX;
        currentAnnotation.endY = e.clientY;
    }
    
    // 重绘所有内容
    redrawCanvas();
}

function endCapture(e) {
    if (mode === 'select' && isCapturing) {
        isCapturing = false;
        if (selectionBounds) {
            mode = 'annotate'; // 自动切换到标注模式
            updateToolbarState();
        }
    } else if (mode === 'annotate' && isDrawing) {
        isDrawing = false;
        if (currentAnnotation) {
            annotations.push(currentAnnotation);
            currentAnnotation = null;
        }
    }
    redrawCanvas();
}

function drawRectangle(x, y, width, height) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    // 保持选区的显示
    if (selectionBounds) {
        drawSelectionRect(selectionBounds);
    }
    ctx.strokeRect(x, y, width, height);
}

function drawLine(startX, startY, endX, endY) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    // 保持选区的显示
    if (selectionBounds) {
        drawSelectionRect(selectionBounds);
    }
    ctx.stroke();
}

function completeScreenshot() {
    let bounds = calculateBounds();
    if (!bounds) {
        console.error('未找到有效的截图区域');
        return;
    }

    const elementsToHide = [
        overlayDiv,
        annotationLayer,
        document.querySelector('.screenshot-toolbar')
    ];
    elementsToHide.forEach(el => {
        if (el) el.style.display = 'none';
    });

    // 创建高分辨率的 canvas
    screenshotCanvas = document.createElement('canvas');
    screenshotCanvas.width = bounds.width;
    screenshotCanvas.height = bounds.height;
    const context = screenshotCanvas.getContext('2d');

    html2canvas(document.body, {
        x: bounds.x / window.devicePixelRatio,  // 转换回实际坐标
        y: bounds.y / window.devicePixelRatio,
        width: bounds.width / window.devicePixelRatio,
        height: bounds.height / window.devicePixelRatio,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        scale: window.devicePixelRatio, // 设置正确的缩放比例
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        useCORS: true,
        allowTaint: true
    }).then(canvas => {
        // 绘制页面截图
        context.drawImage(canvas, 0, 0);
        
        // 重新显示UI元素
        elementsToHide.forEach(el => {
            if (el) el.style.display = '';
        });
        
        // 绘制标注
        const annotationCanvas = document.createElement('canvas');
        annotationCanvas.width = bounds.width;
        annotationCanvas.height = bounds.height;
        const annotationCtx = annotationCanvas.getContext('2d');
        
        // 绘制所有标注到新的 canvas 上
        annotations.forEach(annotation => {
            // 转换标注坐标为相对坐标
            const relativeAnnotation = {
                ...annotation,
                startX: (annotation.startX - selectionBounds.x) * window.devicePixelRatio,
                startY: (annotation.startY - selectionBounds.y) * window.devicePixelRatio,
                endX: (annotation.endX - selectionBounds.x) * window.devicePixelRatio,
                endY: (annotation.endY - selectionBounds.y) * window.devicePixelRatio
            };
            
            if (annotation.type === 'rectangle') {
                drawAnnotationRectangle(annotationCtx, relativeAnnotation);
            } else if (annotation.type === 'line') {
                drawAnnotationLine(annotationCtx, relativeAnnotation);
            }
        });
        
        // 将标注合并到最终画布
        context.drawImage(annotationCanvas, 0, 0);

        const imageData = screenshotCanvas.toDataURL('image/png');
        saveScreenshot(imageData);
        cleanup();
    }).catch(error => {
        console.error('Screenshot failed:', error);
        // 确保即使出错也重新显示UI元素
        elementsToHide.forEach(el => {
            if (el) el.style.display = '';
        });
        cleanup();
    });
}

async function saveScreenshot(imageData) {
    try {
        const imageId = await imageStorage.saveImage(imageData);
        
        // 转换标注坐标为相对坐标
        const relativeAnnotations = annotations.map(annotation => ({
            ...annotation,
            startX: annotation.startX - selectionBounds.x,
            startY: annotation.startY - selectionBounds.y,
            endX: annotation.endX - selectionBounds.x,
            endY: annotation.endY - selectionBounds.y
        }));

        const data = {
            type: 'image',
            content: imageId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            annotations: relativeAnnotations,
            bounds: {
                width: selectionBounds.width,
                height: selectionBounds.height
            }
        };
        chrome.runtime.sendMessage({ action: "saveData", data: data });
    } catch (error) {
        console.error('Error saving screenshot:', error);
    }
}

function cancelScreenshot() {
    cleanup();
}

function cleanup() {
    // 恢复页面滚动
    document.body.style.overflow = originalOverflow;
    
    // 移除滚动事件监听器
    if (wheelHandler) {
        document.removeEventListener('wheel', wheelHandler);
        wheelHandler = null;
    }
    if (touchHandler) {
        document.removeEventListener('touchmove', touchHandler);
        touchHandler = null;
    }
    
    if (overlayDiv) overlayDiv.remove();
    if (annotationLayer) annotationLayer.remove();
    document.querySelector('.screenshot-toolbar')?.remove();
}

// 添加新的辅助函数来计算截图边界
function calculateBounds() {
    if (!selectionBounds) return null;

    const dpr = selectionBounds.dpr;
    
    // 计算实际的像素位置和尺寸
    const bounds = {
        x: Math.max(0, selectionBounds.x * dpr),
        y: Math.max(0, selectionBounds.y * dpr),
        width: Math.min(selectionBounds.width * dpr, window.innerWidth * dpr - selectionBounds.x * dpr),
        height: Math.min(selectionBounds.height * dpr, window.innerHeight * dpr - selectionBounds.y * dpr)
    };

    // 确保尺寸至少为 1 像素
    if (bounds.width < 1 || bounds.height < 1) return null;

    console.log('screenshot bounds:', bounds);
    return bounds;
}

// 添加绘制选区矩形的函数
function drawSelectionRect(bounds) {
    ctx.strokeStyle = '#1E90FF';  // 使用醒目的蓝色
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);  // 虚线效果
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);  // 重置虚线设置
}

// 添加重绘画布的函数
function redrawCanvas() {
    ctx.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
    
    // 1. 绘制选区
    if (selectionBounds) {
        drawSelectionRect(selectionBounds);
    }
    
    // 2. 绘制已保存的标注
    annotations.forEach(annotation => {
        if (annotation.type === 'rectangle') {
            drawSavedRectangle(annotation);
        } else if (annotation.type === 'line') {
            drawSavedLine(annotation);
        }
    });
    
    // 3. 绘制当前正在创建的注
    if (currentAnnotation) {
        if (currentAnnotation.type === 'rectangle') {
            drawPreviewRectangle(currentAnnotation);
        } else if (currentAnnotation.type === 'line') {
            drawPreviewLine(currentAnnotation);
        }
    }
}

// 绘制已保存的矩形
function drawSavedRectangle(annotation) {
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = 2;
    const width = annotation.endX - annotation.startX;
    const height = annotation.endY - annotation.startY;
    ctx.strokeRect(annotation.startX, annotation.startY, width, height);
}

// 绘制预览矩形
function drawPreviewRectangle(annotation) {
    ctx.strokeStyle = 'red'; // 改为红色
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // 保留虚线效果以区分预览状态
    const width = annotation.endX - annotation.startX;
    const height = annotation.endY - annotation.startY;
    ctx.strokeRect(annotation.startX, annotation.startY, width, height);
    ctx.setLineDash([]);
}

// 添加 drawPreviewLine 函数，使用红色
function drawPreviewLine(annotation) {
    ctx.beginPath();
    ctx.moveTo(annotation.startX, annotation.startY);
    ctx.lineTo(annotation.endX, annotation.endY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // 保留虚线效果以区分预览状态
    ctx.stroke();
    ctx.setLineDash([]);
}

// 添加 drawSavedLine 函数，使用红色
function drawSavedLine(annotation) {
    ctx.beginPath();
    ctx.moveTo(annotation.startX, annotation.startY);
    ctx.lineTo(annotation.endX, annotation.endY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// 更新工具栏状态
function updateToolbarState() {
    const buttons = document.querySelectorAll('.screenshot-tool-button');
    buttons.forEach(button => {
        // 根据当前模式更新按钮状态
        if (mode === 'select' && ['矩形', '直线'].includes(button.textContent)) {
            button.disabled = true;
            button.style.opacity = '0.5';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
        }
    });
}

// 添加用于在最终画布上绘制标注的函数
function drawAnnotationRectangle(ctx, annotation) {
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = 2;
    const width = annotation.endX - annotation.startX;
    const height = annotation.endY - annotation.startY;
    ctx.strokeRect(annotation.startX, annotation.startY, width, height);
}

function drawAnnotationLine(ctx, annotation) {
    ctx.beginPath();
    ctx.moveTo(annotation.startX, annotation.startY);
    ctx.lineTo(annotation.endX, annotation.endY);
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = 2;
    ctx.stroke();
}
