# 持久化边界（M2）

`database.ts` 使用 Dexie 的 projects、assets 和 settings 表，以事务保存完整工程及资源，记录上次工程。工程状态仍以 project store 为唯一编辑来源。

`session.ts` 在界面挂载前恢复工程，订阅已提交工程变化；预览拖动和 UI 变化不触发保存。`SaveQueue` 在入队时捕获快照并串行写入，数据库拒绝低于已有修订号的写入，保存状态只由最新请求更新。失败不阻塞后续保存，可重试和下载备份。

`files.ts` 为迁移及导入校验入口。当前 schemaVersion 为 1，兼容缺省 bodyTurn=0；未知版本拒绝。工程包为 ZIP 内 project.json 和 assets/。姿势 JSON 带 format、schemaVersion、rig、asset，要求骨架完整定义一致。导入先完成全部校验，才替换工程，打开备份分配新的本机工程 ID 并清空撤销历史。

导入上限：工程压缩文件与声明解压大小均为 50 MB，单姿势 JSON 为 1 MB。当前面向单个编辑页面，不提供多标签协同编辑或冲突合并。本机保存绑定浏览器及网站地址；跨浏览器、迁移机器或清理站点数据前请下载工程备份。
