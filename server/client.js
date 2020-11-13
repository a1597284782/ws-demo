const WebSocket = require('ws')

const wss = new WebSocket('ws://127.0.0.1:3000', {
  headers: {
    token: '123'
  }
})