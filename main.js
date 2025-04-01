const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const mysql = require('mysql2/promise')
const Docker = require('dockerode')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const args = yargs(hideBin(process.argv))
  .option('container', {
    type: 'string',
    description: '容器名称',
    default: 'mysql-query-tool-container'
  })
  .option('image', {
    type:'string',
    description: '镜像名称',
    default: 'mysql:8.0'
  })
  .option('port', {
    type:'number',
    description: '端口',
    default: 3307
  })
  .argv

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true
  })

  mainWindow.loadFile('index.html')
}

const docker = new Docker()
let container = null

async function startContainer() {
  const containers = await docker.listContainers({ all: true })
  const existingContainer = containers.find(c => c.Names.includes('/' + args.container))
  if (existingContainer) {
    container = docker.getContainer(existingContainer.Id)
    if (existingContainer.State !== 'running') {
      await container.start()
    }
  } else {
    container = await docker.createContainer({
      name: args.container,
      Image: args.image,
      Env: [
        'MYSQL_ROOT_PASSWORD=root',
        'MYSQL_DATABASE=temp_db'
      ],
      HostConfig: {
        PortBindings: {
          '3306/tcp': [{ HostPort: args.port.toString() }]
        },
        Binds: [
          `${__dirname}/mysql-data:/var/lib/mysql`
        ]
      }
    })
    await container.start()
  }
}

async function stopContainer() {
  if (container) {
    await container.stop()
  }
}

async function executeSql(initSqls, querySql) {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: parseInt(args.port),
    user: 'root',
    password: 'root'
  })

  const dbName = `temp_db_${Math.random().toString(36).substring(7)}`
  await connection.query(`CREATE DATABASE ${dbName}`)
  await connection.changeUser({ database: dbName })

  if (initSqls) {
    for (const initSql of initSqls) {
      await connection.query(initSql)
    }
  }

  const [queryResult] = await connection.query(querySql)
  const [executionPlan] = await connection.query(`EXPLAIN ${querySql}`)
  const [explainAnalyzeResult] = await connection.query(`EXPLAIN ANALYZE ${querySql}`)

  await connection.query(`DROP DATABASE ${dbName}`)
  await connection.end()

  return {
    queryResult,
    executionPlan,
    explainAnalyzeResult
  }
}

app.whenReady().then(async () => {await startContainer()
  try {
    await startContainer()
  } catch (error) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Error',
      message: 'Failed to start Docker container. Please check if Docker is running and the image is available.'
    })
    app.quit()
  }

  ipcMain.handle('executeSql', (_, initSqls, querySql) => executeSql(initSqls, querySql))

  createWindow()

  app.on('activate', async function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      await startContainer()
      createWindow()
    }
  })
})

app.on('window-all-closed', async function () {
  await stopContainer()
  if (process.platform !== 'darwin') app.quit()
})