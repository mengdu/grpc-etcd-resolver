const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const Etcd3 = require('etcd3').Etcd3
const resolver = require('../..')

const packageDefinition = protoLoader.loadSync('./hello.proto', {
    // includeDirs: ['./third_party'],
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true
})

const define = grpc.loadPackageDefinition(packageDefinition)
const etcd = new Etcd3()
resolver.setupEtcdResolver(etcd)
// resolver.setupEtcdResolver(etcd, (k, v) => {
//     console.log(k, v)
//     const res = JSON.parse(v).http.match(/http:\/\/(.*):(\d+)/)
//     return {
//         host: res[1],
//         port: +res[2]
//     }
// })

// const addr = '127.0.0.1:58852'
const addr = 'etcd:///test'

const client = new define.helloworld.Greeter(addr, grpc.credentials.createInsecure())

setInterval(() => {
    client.SayHello({ name: 'ping ' + new Date().toISOString() }, function(err, res) {
        if (err) {
            console.log('error:', err)
            return
        }
        console.log('=>', res)
    })
}, 1000)
