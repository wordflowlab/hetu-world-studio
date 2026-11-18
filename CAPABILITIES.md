# 世界构建功能清单

本包拥有专业能力；宿主拥有正文、来源与作者决定。

| 动作 | 用途 | 必填参数 | 效果 |
| --- | --- | --- | --- |
| list_projects | 查找专业工程 |  | read |
| get_project | 读取固定专业工程 | object_id | read |
| save_project | 保存专业工程 | expected_revision, expected_sha256, operation_key, content | managed_write |
| put_calendar | 维护历法 | object_id, expected_revision, expected_sha256, operation_key, calendar | managed_write |
| remove_calendar | 移除历法 | object_id, expected_revision, expected_sha256, operation_key, calendar_id | managed_write |
| put_marker | 维护纪年事件 | object_id, expected_revision, expected_sha256, operation_key, marker | managed_write |
| remove_marker | 移除纪年事件 | object_id, expected_revision, expected_sha256, operation_key, marker_id | managed_write |
| put_rule | 维护制度规则 | object_id, expected_revision, expected_sha256, operation_key, rule | managed_write |
| remove_rule | 移除制度规则 | object_id, expected_revision, expected_sha256, operation_key, rule_id | managed_write |
| put_resource | 维护资源 | object_id, expected_revision, expected_sha256, operation_key, resource | managed_write |
| remove_resource | 移除资源 | object_id, expected_revision, expected_sha256, operation_key, resource_id | managed_write |
| put_scenario | 维护推演情景 | object_id, expected_revision, expected_sha256, operation_key, scenario | managed_write |
| remove_scenario | 移除推演情景 | object_id, expected_revision, expected_sha256, operation_key, scenario_id | managed_write |
| convert_date | 换算虚构日期 | object_id, calendar_id, date | read |
| compare_dates | 比较同一历法日期 | object_id, from_marker_id, to_marker_id | read |
| check_rules | 检查规则依赖与假设 | object_id | read |
| simulate_resources | 推演资源收支 | object_id, scenario_id | read |
| preview_impact | 预览规则修改影响 | object_id, rule_id | read |
| get_source | 读取固定来源 | object_id, source_index | read |
| get_basis | 读取固定专业依据 | object_id, basis_index | read |
| compare_versions | 比较固定修订 | object_id, from_revision, to_revision | read |
| export_project | 导出固定专业报告 | object_id, format | read |
| build_context | 准备有界创作上下文 | object_id, goal, max_chars | read |
| create_handoff | 准备精确AI交接 | object_id, goal | read |
| get_operation | 回读原操作 | operation_key | read |

默认流程、边界及验收见 [docs](docs/README.md)。
