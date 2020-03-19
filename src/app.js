

const express = require('express')
const app     = express()
const server  = require('http').createServer(app)
const io      = require('socket.io').listen(server)
const request = require('request')

const Redis = require('./utils/redis')
const ManipulateString = require('./helpers/manipulate-string')
const dateTime = require('./helpers/date-time')
const WaitlistService = require('./services/waitlist-service')

const PORT    = process.env.PORT || 9000

const Waitlist = new WaitlistService({
  cache : Redis,
  helpers : {
    string : ManipulateString,
    time  : dateTime
  }
})

const connections = []

io.sockets.on(`connection`,socket => {
  connections.push(socket)
  console.log(`socket connected : ${connections.length}`)
  socket.on('disconnect',(data) => {
    connections.splice(connections.indexOf(socket),1)
    console.log(`socket disconnect ${connections.length}`)
  })  
  
  socket.on('deleteGrantAccess', async data => {
    await Waitlist.deleteGranted(data)
    // await Waitlist.checkGrantAccessIsExpired(data)
    let manipulateKeys = ManipulateString.changeText({text: data.redisKey,to : 'waitinglist:queue'});
    let newGranted = await Waitlist.addToGrantAccess(data)
    socket.emit('onDeleteGrantAccess',{ ...data }) 
    // socket.emit('checkPosition',{redisKey: manipulateKeys})
    // socket.broadcast.emit('checkPosition',{redisKey: manipulateKeys})
    socket.broadcast.emit('onDeleteGrantAccess',{ redisKey : manipulateKeys, granted : newGranted})
    // console.log({manipulateKeys, newGranted,redisKey : data.redisKey});
    
  })
  socket.on('checkPosition', async data => {
    let list = await Waitlist.checkPosition(data)
    
    socket.emit('onCheckPosition',list)
    socket.broadcast.emit('onCheckPosition',list)
  })
  socket.on('checkGrantedExpire', async data => {
    let list = await Redis.findAll(data.redisKey)
    let timeExp = list !== undefined ? Object.values(list) : []
    let keys = list !== undefined ? Object.keys(list) : []
    let timeNow = new Date(data.timeNow).getTime()
    let result
    if(keys !== null) {
      for (let i = 0; i < timeExp.length; i++) {
        let time = new Date(timeExp[i]).getTime()
        if(timeNow >= time) {
          result = await Redis.destroy({redisKey: data.redisKey, key: keys[i]})
        }
      }
    }
    return result;
  })

  // const listData = async (redisKey) => {
  //   let data = await Redis.findAll(redisKey)
  //   let key = Object.keys(data)
  //   for (let i = 0; i < dirQueue.length; i++) {
  //     const element = dirQueue[i];
  //     const find = key.find(el => el !== element)
  //     dataKey.push(find)
  //   }
  //   return false
  // }
  
  // const resetUser = async () => {
  //   let result
  //   for (let i = 0; i < dataKey.length; i++) {
  //     const element = dataKey[i];
  //     result = await Redis.destroy({redisKey: keys, key: element})
  //   }
  //   return result
  // }
  
  // let interval = setInterval(resetUser, 10000);
  // socket.on('checkUser', async data => {
  //   dirQueue.push(data.key)
  //   keys = data.redisKey
  //   let datas = await Redis.findAll(data.redisKey)
  //   let key = Object.keys(datas)
  //   for (let i = 0; i < dirQueue.length; i++) {
  //     const element = dirQueue[i];
  //     const find = key.find(el => el !== element)
  //     dataKey.push(find)
  //   }
  //   // await listData(data.redisKey)
  //   if(data !== undefined) {
  //     clearInterval(interval)
  //     interval = setInterval(resetUser, 10000)
  //   }
  // })
})


server.listen(PORT , async () => {
    console.log(`Server running port ${PORT}`)
})