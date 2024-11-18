let isHighlightActive = false;
const HIGHLIGHT_CLASS = 'mp-text-highlight';

// 移除这个事件监听器，因为按钮是动态创建的
// document.addEventListener('DOMContentLoaded', initializeTextHighlight);

// 导出 toggleHighlight 函数，使其可以从其他文件访问
window.toggleHighlight = function() {
    console.log("Toggle highlight called");
    isHighlightActive = !isHighlightActive;
    const highlightBtn = document.getElementById('highlightTextBtn');
    
    if (isHighlightActive) {
        highlightBtn.style.backgroundColor = getButtonColor('highlightTextBtn');
        highlightBtn.textContent = 'Remove Highlight';
        highlightMatchingText();
    } else {
        highlightBtn.style.backgroundColor = '#f5f5f5';
        highlightBtn.textContent = 'Highlight Text';
        removeHighlights();
    }
}

function highlightMatchingText() {
    // 获取所有文本节点
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // 排除脚本和样式标签中的文本
                if (node.parentElement.tagName === 'SCRIPT' || 
                    node.parentElement.tagName === 'STYLE' ||
                    node.parentElement.classList.contains(HIGHLIGHT_CLASS)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    // 处理每个文本节点
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        if (text.includes('iPhone')) {  // 测试规则
            const span = document.createElement('span');
            span.className = HIGHLIGHT_CLASS;
            span.textContent = text;
            textNode.parentNode.replaceChild(span, textNode);
        }
    });
}

function removeHighlights() {
    // 移除所有高亮
    const highlights = document.getElementsByClassName(HIGHLIGHT_CLASS);
    while (highlights.length > 0) {
        const highlight = highlights[0];
        const textNode = document.createTextNode(highlight.textContent);
        highlight.parentNode.replaceChild(textNode, highlight);
    }
} 