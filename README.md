# MySQL学习工具

学习MySQL语法语法的工具。输入初始化数据库的SQL和查询SQL，会输出出结果和执行计划

是一个方便使用的简单封装，与主机上的数据库隔离，适合用来练习和做题。初始化SQL支持多条SQL，查询SQL只支持一条SQL

依赖：Docker。需要提前拉取mysql镜像

命令行参数：
- `--image`：指定使用的镜像名称，默认为`mysql:8.0`
- `--container`：指定创建和使用的容器名称，默认为`mysql-query-tool-container`
- `--port`：指定mysql的端口，默认为`3306`

## 编译

1. 下载CodeMirror5，放到lib文件夹中
2. 执行`npm run package`
