import { Block as BlockCore } from '../zkopru/packages/core'
// import { Block as OriginBlock } from '../zkopru/packages/client/src/types'
import { FullNode } from '../zkopru/packages/core'


// Prefix e means Extend
// TODO: consider using this TreeNode
// interface TreeNode extends OriginTreeNode {
//   utxoType: number // Deposit, Tx, Withdrawal
// }

// interface Block extends OriginBlock {
//   slash?: Slash
// }

interface L2blockHashes {
  [CanonicalBlockNumber: number]: string[] // Block Hash
}

class ZkopruData {
  fullNode: FullNode

  L2blockHashes: L2blockHashes // Fast

  lastUpdatedBlockCount: number

  constructor(fullNode: FullNode) {
      this.fullNode = fullNode
      this.L2blockHashes = {}
      this.lastUpdatedBlockCount = -1
  }

  // Update state this data class every event recieved on full node
  async updateL2BlockHashes() {
      const { db } = this.fullNode
      const totalProposalCount = await db.count('Proposal', {
          include: { block: true }
      })

      // update 'L2blocks' double size of updateWindow
      const updateBlockNum = totalProposalCount - this.lastUpdatedBlockCount
      const updateWindow = Math.max(this.lastUpdatedBlockCount - updateBlockNum, 0)

      if (updateWindow > 0) {
          // const targetProposals: {proposalNum: number}[] = []
          // for (const num of [...Array(updateWindow).keys()]) {
          //     targetProposals.push({proposalNum: startBlockNum + num})   
          // }
          const updatingProposals = await db.findMany('Proposal', {
              where: {},
              orderBy: { proposalNum: 'desc' },
              limit: updateWindow
          })

          // update L2blocks data
          for (const proposal of updatingProposals) {
              const l2block = this.L2blockHashes[proposal.canonicalNum]
              if (!l2block) {
                  this.L2blockHashes[proposal.canonicalNum] = [proposal.hash]
                  this.lastUpdatedBlockCount++
                  continue
              }
              if (!l2block.includes(proposal.hash)) {
                  l2block.push(proposal.hash)
                  this.lastUpdatedBlockCount++
              }
          }
      }
  }

  private getBlockHashesByNumber(CanonicalBlockNumber: number) {
      if (this.L2blockHashes[CanonicalBlockNumber]) return undefined
      return this.L2blockHashes[CanonicalBlockNumber]
  }

  // TODO: full data export
  // type from api-client 
  async getBlockData(CanonicalBlockNumber: number) {
      const { db } = this.fullNode
      const targetHashes = this.getBlockHashesByNumber(CanonicalBlockNumber)

      let blocks: any[] = []
      if (targetHashes && targetHashes.length > 0) {
          for (const blockHash of targetHashes) {
              // get data from database
              // TODO: get Include related
              const [ proposal, header, slash ] = await Promise.all([
                  db.findOne('Proposal', { where: { hash: blockHash } }),
                  db.findOne('Header', { where: { hash: blockHash } }),
                  db.findOne('Slash',  { where: { hash: blockHash } })
              ])
            //   db.findOne(`Block`, { where: { hash: blockhash }, include: { block: true, })

              // body parsing 
              const { proposalData, ...remains } = proposal
              const blockData = BlockCore.from(proposalData)
              blocks.push({ ...remains, header, blockData, slash})
          }
      }

      return JSON.stringify(blocks)
  }
}

export default ZkopruData
