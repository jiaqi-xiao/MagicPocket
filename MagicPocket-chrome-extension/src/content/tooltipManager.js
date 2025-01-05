// 单例模式实现tooltip管理器
class TooltipManager {
    constructor() {
        if (TooltipManager.instance) {
            return TooltipManager.instance;
        }
        TooltipManager.instance = this;
        this.tooltip = null;
        this.hideTimeout = null;
        this.init();
    }

    init() {
        // 创建tooltip元素
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'mp-tooltip';
        document.body.appendChild(this.tooltip);
        
        // 添加基础样式
        const style = document.createElement('style');
        style.textContent = `
            .mp-tooltip {
                position: fixed;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                line-height: 1.4;
                max-width: 300px;
                pointer-events: none;
                opacity: 0;
                transform: translateY(8px);
                transition: all 0.2s ease;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                border: 1px solid rgba(226, 232, 240, 0.8);
                backdrop-filter: blur(8px);
                background: rgba(248, 250, 252, 0.85);
            }
            .mp-tooltip.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .mp-tooltip-intent {
                color: #1E293B;
                font-weight: 400;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .mp-tooltip-intent:last-child {
                margin-bottom: 0;
            }
            .mp-tooltip-intent b {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                letter-spacing: 0.5px;
                backdrop-filter: blur(4px);
            }
            .mp-tooltip-intent span {
                color: #334155;
                flex: 1;
            }
        `;
        document.head.appendChild(style);
    }

    show(intent, targetElement, backgroundColor) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        const rect = targetElement.getBoundingClientRect();
        
        // 格式化intent文本：替换下划线为空格
        const formattedIntent = intent.replace(/_/g, ' ');
        
        // 创建带格式的内容
        this.tooltip.innerHTML = `
            <div class="mp-tooltip-intent">
                <b>INTENT:</b>
                <span>${formattedIntent}</span>
            </div>
        `;

        // 设置背景颜色
        if (backgroundColor) {
            let r, g, b, a;
            
            // 处理rgba格式
            const rgbaMatch = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            
            // 处理十六进制格式（例如：#FFEB3B50 或 FFEB3B50）
            const hexMatch = backgroundColor.match(/^#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})?$/i);
            
            if (rgbaMatch) {
                // 使用数组解构，忽略完整匹配项
                [, r, g, b] = rgbaMatch;
                r = parseInt(r);
                g = parseInt(g);
                b = parseInt(b);
                a = 0.95; // 固定不透明度
            } else if (hexMatch) {
                // 使用数组解构，忽略完整匹配项
                [, r, g, b, a = 'FF'] = hexMatch;
                r = parseInt(r, 16);
                g = parseInt(g, 16);
                b = parseInt(b, 16);
                a = parseInt(a, 16) / 255 * 0.95; // 保持原有透明度但略微调整
            }

            // console log original color and modified color
            console.log(`Original color: ${backgroundColor}`);
            console.log(`Modified color: rgba(${r}, ${g}, ${b}, ${a})`);

            if (r !== undefined && g !== undefined && b !== undefined) {
                this.tooltip.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
                
                // 根据背景色的亮度调整文本颜色
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                const textColor = brightness > 128 ? '#1E293B' : '#F8FAFC';
                const boldTextColor = brightness > 128 ? '#0F172A' : '#FFFFFF';
                
                this.tooltip.style.color = textColor;
                const intentElement = this.tooltip.querySelector('.mp-tooltip-intent');
                if (intentElement) {
                    intentElement.style.color = textColor;
                    const boldElement = intentElement.querySelector('b');
                    if (boldElement) {
                        boldElement.style.color = boldTextColor;
                    }
                }
            }
        }
        
        this.tooltip.classList.add('visible');
        
        // 计算位置
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width - tooltipRect.width) / 2;
        
        // 确保tooltip不会超出视窗
        if (top < 8) {
            top = rect.bottom + 8; // 显示在元素下方
        }
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }

    showMultiple(intents, targetElement) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        const rect = targetElement.getBoundingClientRect();
        
        // 创建带格式的内容
        const content = intents.map(({intent, color}) => {
            // 格式化intent文本：替换下划线为空格
            const formattedIntent = intent.replace(/_/g, ' ');
            
            // 解析颜色
            let backgroundColor = color;
            let r, g, b, a;
            
            // 处理rgba格式
            const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            // 处理十六进制格式
            const hexMatch = color.match(/^#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})?$/i);
            
            if (rgbaMatch) {
                [, r, g, b] = rgbaMatch;
                r = parseInt(r);
                g = parseInt(g);
                b = parseInt(b);
                a = 0.95;
            } else if (hexMatch) {
                [, r, g, b, a = 'FF'] = hexMatch;
                r = parseInt(r, 16);
                g = parseInt(g, 16);
                b = parseInt(b, 16);
                a = parseInt(a, 16) / 255 * 0.95;
            }

            if (r !== undefined && g !== undefined && b !== undefined) {
                backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
            }

            // 计算文本颜色
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            // const textColor = brightness > 128 ? '#1E293B' : '#F8FAFC';
            const textColor = '#1E293B';

            return `
                <div class="mp-tooltip-intent">
                    <b style="background-color: ${backgroundColor};">${'INTENT:'}</b>
                    <span>${formattedIntent}</span>
                </div>
            `;
        }).join('');

        this.tooltip.innerHTML = content;
        this.tooltip.classList.add('visible');
        
        // 计算位置
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width - tooltipRect.width) / 2;
        
        // 确保tooltip不会超出视窗
        if (top < 8) {
            top = rect.bottom + 8; // 显示在元素下方
        }
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }

    hide() {
        this.hideTimeout = setTimeout(() => {
            this.tooltip.classList.remove('visible');
        }, 100); // 添加小延迟，使过渡更平滑
    }
}

// 导出单例实例
window.tooltipManager = new TooltipManager();
