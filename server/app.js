const WebSocket = require('ws')
const http = require('http')
// const jwt = require('jsonwebtoken')

const server = http.createServer()
const wss = new WebSocket.Server({ noServer: true })
// 统计在线人数等数据
let group = {}
// 隔多长时间发一次心跳检测
const timeInterval = 30000

// 链接时
wss.on('connection', function connection(ws) {
  // 初始的心跳链接状态
  ws.isAlive = true

  // 监听收到消息
  ws.on('message', async function (msg) {
    const msgObj = JSON.parse(msg)

    // 判断第一次进入
    if (msgObj.event === 'enter') {
      // 绑定名字和房间号
      ws.name = msgObj.message
      ws.roomid = msgObj.roomid
      // 统计
      if (typeof group[ws.roomid] === 'undefined') {
        group[ws.roomid] = 1
      } else {
        group[ws.roomid]++
      }
      console.log('connection -> msgObj.message', msgObj.message)
    }

    // 鉴权
    // if (msgObj.event === 'auth') {
    //   jwt.verify(msgObj.message, 'secret', (err, decode) => {
    //     if (err) {
    //       // 鉴权不通过返回给前台
    //       console.log('鉴权不通过')
    //       ws.send(JSON.stringify({
    //         event:'noauth',
    //         message: '鉴权失败'
    //       }))
    //       return
    //     } else {
    //       // 通过
    //       console.log(decode)
    //       ws.isAuth = true
    //       return
    //     }
    //   })
    //   return
    // }

    // 拦截鉴权不通过的
    // if (!ws.isAuth) {
    //   return
    // }

    // 心跳检测
    if (msgObj.event === 'heartbeat' && msgObj.message === 'pong') {
      ws.isAlive = true
      return
    }

    // 广播
    wss.clients.forEach((client) => {
      // 判断是否在统一房间中
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        msgObj.name = ws.name
        msgObj.num = group[ws.roomid]
        client.send(JSON.stringify(msgObj))
      }
    })
  })

  // 监听退出
  ws.on('close', function () {
    if (ws.name) {
      group[ws.roomid]--
    }
    let msgObj = {}
    // 广播
    wss.clients.forEach((client) => {
      // 判断是否在统一房间中
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        msgObj.name = ws.name
        msgObj.num = group[ws.roomid]
        msgObj.event = 'out'
        client.send(JSON.stringify(msgObj))
      }
    })
  })
})

// http 升级
server.on('upgrade', function upgrade(request, socket, head) {
  // console.log('upgrade -> request', request)
  // This function is not defined on purpose. Implement it with your own logic.
  // authenticate(request, (err, client) => {
  //   if (err || !client) {
  //     socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
  //     socket.destroy()
  //     return
  //   }

  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit('connection', ws, request)
  })
  // })
})

server.listen(3000)

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive && ws.roomid) {
      group[ws.roomid]--
      delete ws['roomid']
      // 终止链接
      return ws.terminate()
    }
    // 主动发送心跳监测
    // 当客户端返回消息后，主动设置 flag 为在线
    ws.isAlive = false
    ws.send(
      JSON.stringify({
        event: 'heartbeat',
        message: 'ping',
        num: group[ws.roomid],
      })
    )
  })
}, timeInterval)

/**
 * 推荐依赖 npm reconnecting-websocket
 * 自带心跳和断线重连
 */
