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
