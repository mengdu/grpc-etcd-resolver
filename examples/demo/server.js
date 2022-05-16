const grpc = require('@grpc/grpc-js')
const Etcd3 = require('etcd3').Etcd3
const protoLoader = require('@grpc/proto-loader')
const resolver = require('../..')

const packageDefinition = protoLoader.loadSync('./hello.proto', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
})

const hello = grpc.loadPackageDefinition(packageDefinition).helloworld;

const server = new grpc.Server()

server.addService(hello.Greeter.service, {
    sayHello: (call, cb) => {
        console.log("=>", call.request.name)
        const now = Date.now()
        cb(null, {
            message: 'Hello ' + address,
            at: { seconds: now / 1000, nanos: now * 1000000 }
        })
    }
})

const etcd = new Etcd3()
let address = ''

server.bindAsync('0.0.0.0:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        throw err
    }
    address = `0.0.0.0:${port}`
    console.log('Lisenning on:', address)
    resolver.registerServer(etcd, 'test', address, undefined, 4)
    // resolver.registerServer(etcd, 'test', address, JSON.stringify({ http: 'http://' + address }))
    server.start()
})
