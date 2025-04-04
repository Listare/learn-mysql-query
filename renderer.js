class ExplainAnalyzeTree {
  constructor(value, cost = null, rows = null, actualTime1 = null, actualTime2 = null, actualRows = null, loops = null) {
    this.value = value
    this.children = []
    this.cost = cost
    this.rows = rows
    this.actualTime1 = actualTime1
    this.actualTime2 = actualTime2
    this.actualRows = actualRows
    this.loops = loops
  }
}

function parseExplainAnalyze(result) {
  const lines = result[0]['EXPLAIN'].split('\n')
  const root = new ExplainAnalyzeTree('Query Plan')
  const stack = []

  lines.forEach(line => {
    if (line.trim() === '') return // Skip empty lines
    const indent = line.search(/\S/)
    var trimmed = line.trim()
    var parts = trimmed.match(/-> (.*?)  \(cost=(.*?) rows=(.*?)\) \(actual time=(.*?)\.\.(.*?) rows=(.*?) loops=(.*?)\)/)
    var node = null
    if (parts) {
      node = new ExplainAnalyzeTree(
        parts[1],
        parseFloat(parts[2]),
        parseFloat(parts[3]),
        parseFloat(parts[4]),
        parseFloat(parts[5]),
        parseFloat(parts[6]),
        parseFloat(parts[7])
      )
    } else {
      parts = trimmed.match(/-> (.*?)  \(actual time=(.*?)\.\.(.*?) rows=(.*?) loops=(.*?)\)/)
      if (parts) {
        node = new ExplainAnalyzeTree(
          parts[1],
          null,
          null,
          parseFloat(parts[2]),
          parseFloat(parts[3]),
          parseFloat(parts[4]),
          parseFloat(parts[5])
        )
      } else {
        parts = trimmed.match(/-> ([^(]*)/)
        if (parts) {
          node = new ExplainAnalyzeTree(parts[1])
        } else {
          return
        }
      }
    }
    
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(node)
    } else {
      root.children.push(node)
    }

    stack.push({ node: node, indent: indent })
  })

  return root
}

async function executeSQL(initSqls, querySql) {
  try {
    const {queryResult, executionPlan, explainAnalyzeResult} = await window.electronAPI.executeSQL(initSqls, querySql)

    const explainTree = parseExplainAnalyze(explainAnalyzeResult)

    return {
      queryResult,
      executionPlan,
      explainTree
    }
  } catch (error) {
    console.error('Error executing SQL:', error)
    throw error
  }
}

function jsonToTable(data) {
  if (!Array.isArray(data)) {
    data = [data]
  }
  let html = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">'
  if (data.length > 0) {
    html += '<thead><tr>'
    Object.keys(data[0]).forEach(key => {
      html += `<th style="background: #f4f4f4; text-align: left;">${key}</th>`
    })
    html += '</tr></thead>'
  }
  html += '<tbody>'
  data.forEach(row => {
    html += '<tr>'
    Object.values(row).forEach(value => {
      html += `<td>${JSON.stringify(value)}</td>`
    })
    html += '</tr>'
  })
  html += '</tbody></table>'
  return html
}

const executeBtn = document.getElementById('executeBtn')
const clearBtn = document.getElementById('clearBtn')
const executionPlanPre = document.getElementById('executionPlan')
const executionPlanMetrics = document.getElementById('executionPlanMetrics')
const queryResultPre = document.getElementById('queryResult')

function clearResult() {
  executionPlanPre.innerHTML = ''
  queryResultPre.innerHTML = ''
  executionPlanMetrics.innerHTML = '<tr><th></th><th>预估成本</th><th>预估行数</th><th>实际执行时间(ms)</th><th>获取所有行的时间(ms)</th><th>实际返回行数</th><th>循环数</th></tr>'
}

clearBtn.addEventListener('click', clearResult)

function renderTree(node, indent) {
  const line = document.createElement('tr')
  const textTd = document.createElement('td')
  const text = document.createElement('span')
  text.textContent = node.value
  text.style.paddingLeft = indent * 20 + 'px' // Adjust indentation based on node depth
  textTd.appendChild(text)
  line.appendChild(textTd)

  const costTd = document.createElement('td')
  costTd.textContent = node.cost
  const rowsTd = document.createElement('td')
  rowsTd.textContent = node.rows
  const actualTime1Td = document.createElement('td')
  actualTime1Td.textContent = node.actualTime1
  const actualTime2Td = document.createElement('td')
  actualTime2Td.textContent = node.actualTime2
  const actualRowsTd = document.createElement('td')
  actualRowsTd.textContent = node.actualRows
  const loopsTd = document.createElement('td')
  loopsTd.textContent = node.loops
  line.appendChild(costTd)
  line.appendChild(rowsTd)
  line.appendChild(actualTime1Td)
  line.appendChild(actualTime2Td)
  line.appendChild(actualRowsTd)
  line.appendChild(loopsTd)
  executionPlanMetrics.appendChild(line)

  for (var child of node.children) {
    renderTree(child, indent + 1)
  }
}

function splitSqls(sql) {
  // 根据括号来判断SQL语句的结束，如果括号完全匹配且一行结束，则认为是一条SQL语句
  const sqls = []
  var currentSql = []
  var bracketCount = 0
  for (const line of sql.split('\n')) {
    var trimmed = line.trim()
    if (trimmed === '') {
      continue;
    }
    currentSql.push(trimmed)
    for (const char of trimmed) {
      if (char === '(') {
        bracketCount++
      } else if (char === ')') {
        bracketCount--
      }
    }
    if (bracketCount === 0 || trimmed.endsWith(';')) {
      // 如果当前行结束了SQL语句，或者括号完全匹配，则认为是一条SQL语句
      sqls.push(currentSql.join('\n'))
      currentSql = []
      bracketCount = 0
    }
  }
  if (currentSql.length > 0) {
    sqls.push(currentSql.join('\n'))
  }
  return sqls
}

executeBtn.addEventListener('click', async () => {
  const initSql = initSqlEditor.getValue()
  // initSql每一行视作一条SQL语句
  const querySql = querySqlEditor.getValue()

  document.getElementById('loadingIndicator').style.display = 'inline-block';
  try {
    clearResult()

    const result = await executeSQL(splitSqls(initSql), querySql)

    executionPlanPre.innerHTML = jsonToTable(result.executionPlan)
    queryResultPre.innerHTML = jsonToTable(result.queryResult)
    console.log(result.explainTree)
    for (const child of result.explainTree.children) {
      renderTree(child, 0)
    }
  } catch (error) {
    console.error(error)
    executionPlanPre.textContent = 'Error: ' + error.message
    queryResultPre.textContent = 'Error: ' + error.message
  } finally {
    document.getElementById('loadingIndicator').style.display = 'none';
  }
})