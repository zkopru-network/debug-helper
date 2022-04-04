import { FullNode } from '~zkopru/core'
import { DB, schema } from '~zkopru/database'
import { ConnectionInfo } from '@ethersproject/web'
import { JsonRpcProvider } from '@ethersproject/providers'
import Docker, { Container } from 'dockerode'
import { SQLiteConnector } from '~zkopru/database/dist/node'

const ImageName = process.env.DOCKER_IMAGE_NAME ?? 'zkopru-debug/hardhat'
const ImageTag = process.env.DOCKER_IMAGE_TAG ?? 'latest'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const targetImage = `${ImageName}:${ImageTag}`
const targetContainer = process.env.NAME ?? 'zkopru-debug-hardhat'

export async function checkHardhatImage(): Promise<boolean> {
  // For checking zkopru-debug/hardhat image exist
  const imageList = await docker.listImages()
  const flattenImageList = imageList.map(img => img.RepoTags).flat()

  if (flattenImageList.find(img => img?.startsWith(targetImage))) {
    return true
  } else {
    return false
  }
}

export async function getContainers(targetName: string) {
  const containerlist = await docker.listContainers({ all: true })
  for (const container of containerlist) {
    if (container.Names.includes("/" + targetName)) {
      return container.Id
    }
  }
  return
}

export async function removeContainer(Id: string) {
  const container = docker.getContainer(Id)
  const containerStatus = await container.inspect()
  if (containerStatus.State.Status != 'exited') {
    await container.kill()
  }
  await container.remove()
}

export async function runForkedChain(url?: string, blockNumber?: number, chainId?: number): Promise<Container> {
  const Env: string[] = []

  Env.push(`URL=${url}`)
  if (blockNumber) {
    Env.push(`BLOCK_NUMBER=${blockNumber}`)
  }
  if (chainId) {
    Env.push(`CHAINID=${chainId}`)
  }

  const hardhatContainer = await docker.createContainer({
    Image: targetImage,
    name: targetContainer,
    Env,
    HostConfig: {
      PortBindings: {
        "8545/tcp": [{ HostPort: "8545" }]
      }
    },
    ExposedPorts: { "8545/tcp": {}}
  })

  return hardhatContainer
}

export async function createFullNode(nodeUrl: string, zkopruAddress: string, outputFile?: string) {
  const connectionInfo: ConnectionInfo = {
    url: nodeUrl,
    timeout: 300000
  }
  const provider = new JsonRpcProvider(connectionInfo)

  async function waitConnection() {
    return new Promise<void>(async res => {
      if (await provider.ready) res()
      provider.on('connect', res)
    })
  }

  await waitConnection()

  const db: DB = await SQLiteConnector.create(schema, `${outputFile ?? ":memory:"}`)
  return FullNode.new({
    address: zkopruAddress,
    provider,
    db
  })
}
