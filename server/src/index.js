const WebSocket = require('ws')
// const http = require('http')
// const jwt = require('jsonwebtoken')
const { getValue, setValue, existKey } = require('./config/RedisConfig')

// const server = http.createServer()
const wss = new WebSocket.Server({ port: 3000 })
// 统计在线人数等数据
let group = {}
// 隔多长时间发一次心跳检测
const timeInterval = 30000

// 前缀
const prefix = 'imooc-'

// const run = async () => {
//   setValue('imooc', 'hello')
//   const result = await getValue('imooc')
//   console.log('run -> result', result)
// }
// run()

// 链接时
wss.on('connection', function connection(ws) {
  // 初始的心跳链接状态
  ws.isAlive = true

  // 监听收到消息
  ws.on('message', async function (msg) {
    const msgObj = JSON.parse(msg)
    const roomid = prefix + (msgObj.roomid ? msgObj.roomid : ws.roomid)

    // 判断第一次进入
    if (msgObj.event === 'enter') {
      // 当用户进入后，判断用户的房间是否存在。不存在则在 redis 中创建，用户保存用户信息
      // 主要用于统计房间的人数、消息的遍历发送
      // 绑定名字和房间号
      ws.name = msgObj.message
      ws.roomid = msgObj.roomid
      ws.uid = msgObj.uid
      console.log('connection -> ws.uid', ws.uid)

      // 判断 redis 中是否有对应的 roomid 键值
      const result = await existKey(roomid)
      if (result === 0) {
        // 初始化一个房间
        setValue(roomid, ws.uid)
      } else {
        // 已经存在该房间的缓存数据
        const arrStr = await getValue(roomid)
        let arr = arrStr.split(',')
        if (arr.indexOf(ws.uid) === -1) {
          setValue(roomid, arrStr + ',' + ws.uid)
        }
      }

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
    // 获取房间里所有的用户信息
    const arrStr = await getValue(roomid)
    let users = arrStr.split(',')

    wss.clients.forEach(async (client) => {
      // 判断是否在统一房间中
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        msgObj.name = ws.name
        msgObj.num = group[ws.roomid]
        client.send(JSON.stringify(msgObj))
        // 缓存不在线的
        // 排除已经发送消息的客户端 =》 在线的
        if (users.indexOf(client.uid) !== -1) {
          users.splice(users.indexOf(client.uid), 1)
        }
        // 取 redis 中的 uid 数据的消息缓存
        let result = await existKey(ws.uid)
        if (result !== 0) {
          // 存在未发送的离线数据数组
          let tmpArr = await getValue(ws.uid)
          let tmpObj = JSON.parse(tmpArr)
          let uid = ws.uid
          if (tmpObj.length > 0) {
            let i = []
            // 遍历该用户的离线缓存数据
            // 判断用户的房间id是否与当前一致
            tmpObj.forEach((item) => {
              if (item.roomid === client.roomid && uid === client.uid) {
                client.send(JSON.stringify(item))
                i.push(item)
              }
            })
            // 删除已经发送的缓存数据
            if (i.length > 0) {
              i.forEach((item) => {
                tmpObj.splice(item, 1)
              })
            }
            setValue(ws.uid, JSON.stringify(tmpObj))
          }
        }
      }
    })

    // 断开链接的用户id，且其他用户发送了消息 =》 缓存离线消息
    if (users.length > 0 && msgObj.event === 'message') {
      users.forEach(async (item) => {
        const result = await existKey(item)
        if (result !== 0) {
          // 说明已经存在其他房间的离线数据
          let userData = await getValue(item)
          let msgs = JSON.parse(userData)
          msgs.push({
            roomid: ws.roomid,
            ...msgObj
          })
          setValue(item, JSON.stringify(msgs))
        } else {
          // 说明这个用户一直在线，且无离线消息
          setValue(
            item,
            JSON.stringify([{
              roomid: ws.roomid,
              ...msgObj
            }])
          )
        }
      })
    }
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
// server.on('upgrade', function upgrade(request, socket, head) {
//   // console.log('upgrade -> request', request)
//   // This function is not defined on purpose. Implement it with your own logic.
//   // authenticate(request, (err, client) => {
//   //   if (err || !client) {
//   //     socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
//   //     socket.destroy()
//   //     return
//   //   }

//   wss.handleUpgrade(request, socket, head, function done(ws) {
//     wss.emit('connection', ws, request)
//   })
//   // })
// })

// server.listen(3000)

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
