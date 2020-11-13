const redis = require('redis')
const { promisifyAll } = require('bluebird')

const options = {
  host: '127.0.0.1',
  port: 6379,
  detect_buffers: true,
  retry_strategy: function (options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with
      // a individual error
      return new Error('The server refused the connection')
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands
      // with a individual error
      return new Error('Retry time exhausted')
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      return undefined
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000)
  },
}

// 创建实例
// const client = redis.createClient(options)
const client = promisifyAll(redis.createClient(options))

client.on('error', (err) => {
  console.log('Redis Client Error:' + err)
})

// 创建
const setValue = (key, value, time) => {
  if (value == null || value === '') {
    return
  }
  if (typeof value === 'string') {
    // time 设置超时/过期时间
    if (typeof time !== 'undefined') {
      client.set(key, value, 'EX', time)
    } else {
      client.set(key, value)
    }
  } else if (typeof value === 'object') {
    Object.keys(value).forEach((item) => {
      client.hset(key, item, value[item], redis.print)
    })
  }
}

// 查询
// const { promisify } = require('util')
// const getAsync = promisify(client.get).bind(client)

const getValue = (key) => {
  return client.getAsync(key)
}

//
const getHvalue = (key) => {
  // return promisify(client.hgetall).bind(client)(key)
  return client.hgetallAsync(key)
}

const delValue = (key) => {
  client.del(key, (err, res) => {
    if (res === 1) {
      console.log('delete successfully')
    } else {
      console.log('delete redis key error:' + err)
    }
  })
}

// 检查给定 key 是否存在
const existKey = async function (key) {
  const result = await client.existsAsync(key)
  return result
}

// 删除指定的 key
const deleteKey = async function (key) {
  const result = await client.delAsync(key)
  return result
}

module.exports = {
  client,
  getValue,
  setValue,
  getHvalue,
  delValue,
  existKey,
  deleteKey,
}
