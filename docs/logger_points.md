# 日志埋点记录文档

## 埋点命名规范

1. 按钮点击事件：
   - 格式：`{component_name}_{btn_name}_btn_clicked`
   - 示例：`context_menu_save_btn_clicked`

2. 用户行为事件：
   - 格式：`{component_name}_{action}`
   - 示例：`text_selected`, `context_menu_add_comment`

3. 取消操作事件：
   - 格式：`{component_name}_{action}_cancelled`
   - 示例：`context_menu_add_comment_cancelled`

## 日志记录最佳实践

1. 使用全局对象：
   - 使用 `window.Logger` 而不是直接使用 `Logger`
   - 使用 `window.LogCategory` 而不是直接使用 `LogCategory`

2. 记录用户意图：
   - 在用户点击按钮时立即记录点击事件
   - 在操作完成时记录操作结果

3. 命名空间：
   - 使用组件名作为前缀（如 `context_menu_`）以区分不同组件的事件
   - 使用动词描述用户行为（如 `clicked`, `selected`, `added`)

## 埋点列表

### 标记上下文菜单（contextMenu.js）

| 埋点名称 | 描述 |
|---------|------|
| `text_selected` | 用户选择文本时触发 |
| `show_context_menu` | 显示上下文菜单时触发 |
| `context_menu_save_btn_clicked` | 用户点击保存按钮时触发 |
| `context_menu_comment_btn_clicked` | 用户点击评论按钮时触发 |
| `context_menu_add_comment` | 用户成功添加评论时触发 |
| `context_menu_add_comment_cancelled` | 用户取消添加评论时触发 |

### 浮动窗口（floatingWindow.js）

| 埋点名称 | 描述 |
|---------|------|
| `floating_window_btn_clicked` | 用户点击浮动窗口按钮时触发 |
| `record_item_clicked` | 用户点击记录列表项时触发 |
| `record_item_delete_btn_clicked` | 用户点击记录删除按钮时触发 |
| `floating_window_recordslist_shown` | 记录列表显示时触发 |

### 选项页面（options.js）

| 埋点名称 | 描述 |
|---------|------|
| `options_add_host_btn_clicked` | 用户点击添加域名按钮时触发 |
| `options_add_host_cancelled` | 用户取消添加域名时触发（空输入） |
| `options_host_added` | 新域名添加成功时触发 |
| `options_add_host_failed` | 添加域名失败时触发（域名已存在） |
| `options_host_selection_changed` | 用户更改域名选择时触发 |
| `options_save_settings_btn_clicked` | 用户点击保存设置按钮时触发 |
| `options_settings_saved` | 设置保存成功时触发 |

### 新建任务（new_task.js）

| 埋点名称 | 描述 |
|---------|------|
| `new_task_description_create_btn_clicked` | 用户输入新任务并点击创建任务按钮时触发 |

### 弹出窗口（popup.js）

| 埋点名称 | 描述 |
|---------|------|
| `popup_new_task_btn_clicked` | 用户点击新建任务按钮时触发 |
| `popup_new_task_confirmed` | 用户确认创建新任务时触发 |
| `popup_new_task_cancelled` | 用户取消创建新任务时触发 |
| `popup_screenshot_btn_clicked` | 用户点击截图按钮时触发 |
| `popup_side_panel_btn_clicked` | 用户点击侧边栏按钮时触发 |
| `popup_side_panel_open_failed` | 侧边栏打开失败时触发 |
| `popup_export_logs_btn_clicked` | 用户点击导出日志按钮时触发 |
| `popup_logs_exported` | 日志导出成功时触发 |
| `popup_logs_export_failed` | 日志导出失败时触发 |
| `popup_clear_logs_btn_clicked` | 用户点击清除日志按钮时触发 |
| `popup_logs_cleared` | 日志清除成功时触发 |
| `popup_logs_clear_failed` | 日志清除失败时触发 |
| `popup_clear_logs_cancelled` | 用户取消清除日志时触发 |

### 侧边栏（sidePanel.js）

#### UI 交互日志
| 埋点名称 | 描述 |
|---------|------|
| `side_panel_clear_all_btn_clicked` | 点击清除所有按钮时触发 |
| `side_panel_records_cleared` | 记录清除完成时触发 |
| `side_panel_highlight_text_btn_clicked` | 点击高亮文本按钮时触发 |
| `side_panel_analyze_btn_clicked` | 点击分析按钮时触发 |
| `side_panel_analyze_cancelled` | 取消分析（隐藏意图树）时触发 |
| `side_panel_analyze_started` | 开始分析时触发 |
| `side_panel_analyze_completed` | 分析完成时触发 |
| `side_panel_analyze_failed` | 分析失败时触发，记录错误信息（error） |
| `side_panel_record_item_clicked` | 点击记录项时触发，记录记录ID（record_id） |
| `side_panel_record_item_delete_btn_clicked` | 点击记录删除按钮时触发，记录记录ID（record_id） |
| `side_panel_record_item_deleted` | 记录删除完成时触发，记录记录ID（record_id） |
| `side_panel_network_visualization_shown` | 网络可视化显示时触发 |
| `side_panel_network_visualization_hidden` | 网络可视化隐藏时触发 |
| `side_panel_scroll_indicator_clicked` | 点击滚动指示器时触发 |

#### 系统日志
| 埋点名称 | 描述 |
|---------|------|
| `side_panel_text_highlighted` | 文本高亮状态改变时触发，记录高亮文本和URL |
| `side_panel_groups_generated` | 节点分组生成完成时触发，记录原始响应数据（raw_response） |
| `side_panel_intent_tree_generated` | 意图树生成完成时触发，记录原始响应数据（raw_response） |

#### 网络日志
| 埋点名称 | 描述 |
|---------|------|
| `side_panel_group_api_called` | 调用分组API时触发，记录请求耗时（duration_ms）和记录数量（records_count） |
| `side_panel_construct_api_called` | 调用构建API时触发，记录请求耗时（duration_ms）和分组数量（groups_count） |
