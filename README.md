# grpc-etcd-resolver

Etcd resolver for [grpc-node](https://github.com/grpc/grpc-node).

```ls
npm install grpc-etcd-resolver
```

## Usage

[Demo](examples/demo)

### Server

```ts
const resolver = require('grpc-etcd-resolver')

const serviceName = 'test'

const main = async () => {
  const server = new grpc.Server()
  server.addService(HelloService, helloServer)

  const etcd = new Etcd3()

  server.bindAsync('0.0.0.0:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
    // register service addr to etcd
    resolver.registerServer(etcd, serviceName, `127.0.0.1:${port}`)
    server.start()
  })
}
```

### Client

```ts
const resolver = require('grpc-etcd-resolver')

const serviceName = 'test'

const main = async () => {
  const etcd = new Etcd3()
  // setup etcd resolver
  resolver.setupEtcdResolver(etcd)

  const result = new HelloClient(`etcd:///${serviceName}`, grpc.credentials.createInsecure())
}
```
