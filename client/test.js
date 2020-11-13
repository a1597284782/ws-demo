const WebSocket = require('ws')

const ws = new WebSocket('ws://127.0.0.1:3000')

ws.on('open', function () {
  console.log('打开了一个')

  ws.send('client hello')

  ws.on('message', function (msg) {
    console.log('msg', msg)
  })
})
