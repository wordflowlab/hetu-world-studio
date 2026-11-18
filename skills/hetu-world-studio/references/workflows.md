# 专业流程

读取固定正文与设定→建立明确历法与制度假设→核对日期和依赖→在固定情景计算资源→解释不足及影响→交给规划或宿主候选→按新依据继续。

## 建立与核对世界

从固定正文、作品设定和已有工程读取明确事实，使用save_project或put_calendar／put_marker维护虚构历法与纪年。月份从1开始；纪元年首日为纪日0。闰年规则是非零绝对年份为leap_every倍数，在leap_month增加leap_days；不能直接套用公历或文本年份排序。

用convert_date核对纪日与星期，compare_dates只比较同一历法；跨历法需要先由作者明确换算依据。本包不推断缺失的时间单位。

## 规则与推演

put_rule记录制度、明确前提与hypothesis／author_declared；check_rules报告环和假设，不自动判断制度是否合理。put_resource固定整数值、单位和最低要求；put_scenario固定明确收支，simulate_resources返回逐步余额及不足。负余额是推演结果，不能藏成默认零。

修改规则前用preview_impact核对显式依赖和受影响情景；未登记的语义影响需要补读。结果通过get_project回读，固定专业依据交给规划或宿主候选。正式正典另行决定。

## 版本与恢复

固定来源、专业依据、CAS和原键；删除当前记录不删除旧修订。列表完整分页回读，部分阅读如实声明。通用查找、比较、导出与交接见[操作地图](operations.md)，参数仍以当前安装版Schema为准。
