import { ChannelOptions, Metadata } from '@grpc/grpc-js'
import {
  registerResolver,
  Resolver,
  ResolverConstructor,
  ResolverListener
} from '@grpc/grpc-js/build/src/resolver'
import { SubchannelAddress } from '@grpc/grpc-js/build/src/subchannel-address'
import {
  GrpcUri,
  splitHostPort,
  uriToString
} from '@grpc/grpc-js/build/src/uri-parser'
import { LogVerbosity, Status } from '@grpc/grpc-js/build/src/constants'
import * as logging from '@grpc/grpc-js/build/src/logging'
import { Etcd3, Watcher } from 'etcd3'

const TRACE_NAME = 'etcd-resolver'
const ETCD_SCHEME = 'etcd'

function trace (text: string) {
  logging.trace(LogVerbosity.DEBUG, TRACE_NAME, text)
}

export const registerServer = async (client: Etcd3, serviceName: string, address: string, value?: string, ttl: number = 2) => {
  const lease = client.lease(ttl, { autoKeepAlive: true })
  return lease.put(`/${serviceName}/${address}`).value(value || address)
}

export const setupEtcdResolver = (client: Etcd3, parseAddress = defaultParseAddress) => {
  registerResolver(ETCD_SCHEME, createEtcdResolver(client, parseAddress))
}

export const defaultParseAddress: (key: string, value: string) => { host: string, port: number } = (k, v) => {
  const addrs = v.split(':')
  return {
    host: addrs[0],
    port: Number(addrs[1])
  }
}

export const createEtcdResolver = (etcd: Etcd3, parseAddress = defaultParseAddress): ResolverConstructor => {
  return class EtcdResover implements Resolver {
    private watcher?: Watcher
    private addresses = new Map<string, string>()
    private processing: boolean = false

    constructor (private target: GrpcUri, private listener: ResolverListener, channelOptions: ChannelOptions) {
      this.listener.onSuccessfulResolution
      this.watch()
    }

    updateResolution(): void {
      trace('Resolution update requested for target ' + uriToString(this.target))
      process.nextTick(() => this._loadAddress())
    }
  
    destroy(): void {
      trace('Resolver destroy target ' + uriToString(this.target))
      if (this.watcher) this.watcher.cancel()
    }

    private async watch () {
      this.watcher = await etcd.watch().prefix('/' + this.target.path + '/').create()
      this.watcher.on('put', (req) => {
        const key = req.key.toString('utf8')
        const address = parseAddress(key, req.value.toString('utf8'))
        trace(`Resolver add new address, target ${uriToString(this.target)}, address: ${address}`)
        this.addresses.set(key, `${address.host}:${address.port}`)
        this.updateResolutionFromAddress()
      })

      this.watcher.on('delete', (req) => {
        trace(`Resolver remove address, target ${uriToString(this.target)}`)
        this.addresses.delete(req.key.toString('utf8'))
        this.updateResolutionFromAddress()
      })
    }

    private updateResolutionFromAddress() {
      if (this.addresses.size === 0) {
        return
      }

      trace(`Resolver update listener, target ${uriToString(this.target)}, address: ${[...this.addresses]}`)

      const list: SubchannelAddress[] = []
      this.addresses.forEach(e => {
        const o = splitHostPort(e)
        if (o === null) {
          this.listener.onError({
            code: Status.UNAVAILABLE,
            details: `Failed to parse ${this.target.scheme} address ${e}`,
            metadata: new Metadata(),
          })
        } else {
          list.push({
            host: o!.host,
            port: o!.port!
          })
        }
      })

      this.listener.onSuccessfulResolution(
        list,
        null,
        null,
        null,
        {}
      )
    }

    private async _loadAddress() {
      if (this.processing) return
      this.processing = true
      try {
        const keys = await etcd.getAll().prefix('/' + this.target.path + '/').keys()
        for (const i in keys) {
          const value = await etcd.get(keys[i])
          if (value) {
            const address = parseAddress(keys[i], value)
            this.addresses.set(keys[i], `${address.host}:${address.port}`)
          }
        }
      } catch (err) {
        trace('Resolver constructed for target ' + uriToString(this.target))

        this.listener.onError({
          code: Status.UNAVAILABLE,
          details: `Name resolution failed for target ${uriToString(this.target)}`,
          metadata: new Metadata(),
        })
      }

      this.updateResolutionFromAddress()
      this.processing = false
    }
  
    static getDefaultAuthority(target: GrpcUri): string {
      return target.path
    }
  }
}
