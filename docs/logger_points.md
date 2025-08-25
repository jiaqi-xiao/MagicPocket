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

| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `popup_new_task_btn_clicked` | UI | 用户点击新建任务按钮时触发 | |
| `popup_new_task_confirmed` | UI | 用户确认创建新任务时触发 | |
| `popup_new_task_cancelled` | UI | 用户取消创建新任务时触发 | |
| `popup_side_panel_btn_clicked` | UI | 用户点击侧边栏按钮时触发 | |
| `popup_side_panel_open_failed` | UI | 侧边栏打开失败时触发 | error |
| `popup_export_logs_btn_clicked` | UI | 用户点击导出日志按钮时触发 | |
| `popup_logs_exported` | UI | 日志导出成功时触发 | |
| `popup_logs_export_failed` | UI | 日志导出失败时触发 | error |
| `popup_clear_logs_confirmed` | UI | 用户确认清除日志时触发（替代原clear_logs_btn_clicked） | |
| `popup_clear_logs_cancelled` | UI | 用户取消清除日志时触发 | |
| `popup_mode_toggle_changed` | UI | 模式切换时触发 | new_mode, is_ablation |

### 侧边栏（sidePanel.js）

#### UI 交互日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `side_panel_task_edit_btn_clicked` | UI | 点击任务编辑按钮时触发 | |
| `side_panel_task_description_updated` | UI | 任务描述更新时触发 | new_description |
| `side_panel_clear_all_btn_clicked` | UI | 点击清除所有按钮时触发 | |
| `side_panel_records_cleared` | UI | 记录清除完成时触发 | |
| `side_panel_highlight_text_btn_clicked` | UI | 点击高亮文本按钮时触发 | |
| `side_panel_analyze_btn_clicked` | UI | 点击分析按钮时触发 | |
| `side_panel_analyze_cancelled` | UI | 取消分析（隐藏意图树）时触发 | |
| `side_panel_analyze_started` | UI | 开始分析时触发 | |
| `side_panel_analyze_completed` | UI | 分析完成时触发（正常模式） | |
| `side_panel_analyze_completed_ablation` | UI | 分析完成时触发（消融模式） | |
| `side_panel_analyze_failed` | UI | 分析失败时触发 | error |
| `side_panel_recommend_failed` | UI | 推荐失败时触发 | error |
| `side_panel_record_item_clicked` | UI | 点击记录项时触发 | record_id |
| `side_panel_record_item_delete_btn_clicked` | UI | 点击记录删除按钮时触发 | record_id |
| `side_panel_record_item_deleted` | UI | 记录删除完成时触发 | record_id |
| `side_panel_network_visualization_shown` | UI | 网络可视化显示时触发 | |
| `side_panel_network_visualization_hidden` | UI | 网络可视化隐藏时触发 | |
| `side_panel_scroll_indicator_clicked` | UI | 点击滚动指示器时触发 | |
| `side_panel_group_api_cancelled` | UI | 分组API调用被取消时触发 | |

#### 系统日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `side_panel_groups_generated` | SYSTEM | 节点分组生成完成时触发 | raw_response |
| `side_panel_intent_tree_generated` | SYSTEM | 意图树生成完成时触发 | raw_response |
| `side_panel_recommend_tree_generated` | SYSTEM | recommend API 调用完成后记录意图树 | raw_response |

#### 网络日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `side_panel_group_api_called` | NETWORK | 调用分组API时触发 | duration_ms, records_count |
| `side_panel_extract_api_called` | NETWORK | 调用 extract API 时触发 | duration_ms, groups_count |
| `side_panel_recommend_api_called` | NETWORK | 调用 recommend API 时触发 | duration_ms, scenario |

#### 错误日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `side_panel_group_api_422_error` | ERROR | 分组API返回422错误时触发 | error, records_count |
| `side_panel_group_api_error` | ERROR | 分组API调用失败时触发 | error |

### 网络可视化（networkVisualization.js）

#### UI 交互日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `network_visualization_initialized` | UI | 网络可视化初始化完成时触发 | |
| `network_node_clicked` | UI | 点击节点时触发 | node_id, node_type |
| `network_node_menu_opened` | UI | 节点菜单打开时触发 | node_id, node_type |
| `network_node_menu_item_clicked` | UI | 点击节点菜单项时触发 | node_id, action |
| `network_node_added` | UI | 添加新节点时触发 | node_id, node_label |
| `network_node_deleted` | UI | 删除节点时触发 | node_id |
| `network_node_state_toggled` | UI | 节点状态切换时触发 | node_id, new_state |
| `network_direction_changed` | UI | 层级布局方向改变时触发 | new_direction |
| `manual_intent_created` | UI | 手动创建意图时触发 | intent_text |
| `network_vertical_layout_applied` | UI | 应用垂直布局时触发 | |
| `network_horizontal_layout_applied` | UI | 应用水平布局时触发 | |
| `node_merge_completed` | UI | 节点合并完成时触发 | source_node_id, target_node_id |

#### 系统日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `network_node_edited` | SYSTEM | 编辑节点时触发 | node_id, new_label, old_label |

### 文本高亮（textHighlight.js）

#### UI 交互日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `text_highlight_updated` | UI | 文本高亮更新时触发 | highlight_count |

#### 系统日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `highlight_range_failed` | SYSTEM | 高亮范围创建失败时触发 | error, highlightInfo, url |

### 页面导航（background.js）

#### 导航日志
| 埋点名称 | 类别 | 描述 | 数据字段 |
|---------|------|------|----------|
| `navigation_page_opened` | NAVIGATION | 新标签页打开或页面加载完成时触发 | url, title, timestamp, tab_id |
| `navigation_page_content_analyzed` | NAVIGATION | 页面内容分析完成时触发 | url, word_count, chs_count, language, tab_id |
| `navigation_tab_activated` | NAVIGATION | 标签页激活时触发 | url, title, tab_id, timestamp |
