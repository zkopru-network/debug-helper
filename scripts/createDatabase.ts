import Docker from 'dockerode'
import { BigNumber } from 'ethers'
import { SingleBar } from 'cli-progress'
import { getContainers, removeContainer, createFullNode } from '../src/utils'
import { sleep } from '~zkopru/utils'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const containerName = process.env.CONTAINER_NAME ?? `zkopru-hardhat-debug`
const sourceNode = process.env.URL
const blockNumber = process.env.BLOCK_NUMBER
const zkopruAddress = process.env.ZKOPRU_ADDRESS

const containerConfig = {
  Image: `zkopru-debug/hardhat:latest`,
  name: containerName,
  AttachStdin: true,
  AttachStdout: true,
  AttachStderr: true,
  Tty: true,
  Env: [`URL=${sourceNode}`],
  HostConfig: {
    PortBindings: {
      "8545/tcp": [{ HostPort: "8545" }]
    }
  },
  ExposedPorts: { "8545/tcp": {} }
}

async function main() {
  // check configurations
  if (!zkopruAddress) throw Error(`Zkopru address not set`)
  if (blockNumber && blockNumber != 'latest') {
    containerConfig.Env.push(`BLOCK_NUMBER=${blockNumber}`)
  }
  
  // create hardhat container
  const currentContainerId = await getContainers(containerName)
  if (currentContainerId) {
    console.log(`Found running '${containerName}' container`) 
    console.log(`Stop and remove container: ${currentContainerId.slice(0, 8)}`)
    await removeContainer(currentContainerId)
  }
  const hardhatContainer = await docker.createContainer(containerConfig)
  await hardhatContainer.start()

  // wait container is running
  let containerInfo = await hardhatContainer.inspect()
  while (!containerInfo.State.Running) {
    await sleep(500)
    containerInfo = await hardhatContainer.inspect()
  }
  
  // start zkopru full node
  const fullNode = await createFullNode(`http://localhost:8545`, zkopruAddress, blockNumber)
  fullNode.start()
  
  let proposedBlocks: BigNumber = await fullNode.synchronizer.l1Contract.zkopru.proposedBlocks()
  await sleep(1000)

  // logging syncing progress
  let isSyncing = true
  const bar = new SingleBar({ format :  `Syncing | [{bar}] | {percentage}% | {value}/{total} blocks`})
  bar.start(proposedBlocks.toNumber(), 0)
  while (isSyncing) {
    proposedBlocks = await fullNode.synchronizer.l1Contract.zkopru.proposedBlocks()
    bar.update(fullNode.synchronizer.latestProcessed ?? 0)
    isSyncing = fullNode.synchronizer.isSynced() == false
    await sleep(1000)
  }

  bar.stop()
  await fullNode.stop()
  await removeContainer(hardhatContainer.id)
  console.log(`Sync and zkopru data download complete, close now`)
  process.exit(1)
}

main()
