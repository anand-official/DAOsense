import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji, avalanche } from 'viem/chains';
import { insertBatch, updateSummaryBatchId } from '../db';
import type { BatchData } from './batchBuilder';

// ABI for ProposalVerifier contract (only the functions we need)
export const VERIFIER_ABI = [
    {
        name: 'submitBatch',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_root', type: 'bytes32' },
            { name: '_leafCount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'verifyProof',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: '_batchId', type: 'uint256' },
            { name: '_proof', type: 'bytes32[]' },
            { name: '_leaf', type: 'bytes32' },
        ],
        outputs: [{ type: 'bool' }],
    },
    {
        name: 'batchCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'getBatch',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_batchId', type: 'uint256' }],
        outputs: [
            { name: 'merkleRoot', type: 'bytes32' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'leafCount', type: 'uint256' },
        ],
    },
    {
        name: 'BatchSubmitted',
        type: 'event',
        inputs: [
            { name: 'batchId', type: 'uint256', indexed: true },
            { name: 'merkleRoot', type: 'bytes32' },
            { name: 'leafCount', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
        ],
    },
] as const;

const contractAddress = process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS as `0x${string}`;

// Determine chain based on env
const chain = process.env.NODE_ENV === 'production' ? avalanche : avalancheFuji;
const rpcUrl =
    process.env.NODE_ENV === 'production'
        ? process.env.MAINNET_RPC_URL
        : process.env.FUJI_RPC_URL;

/**
 * Submit a Merkle batch to the ProposalVerifier contract.
 * Returns the transaction hash.
 */
export async function submitBatchOnChain(batchData: BatchData): Promise<string> {
    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error('DEPLOYER_PRIVATE_KEY not set');
    }
    if (!contractAddress) {
        throw new Error('NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS not set');
    }

    const account = privateKeyToAccount(
        process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`
    );

    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
    });

    console.log(`[Submitter] Submitting batch to ${chain.name}...`);
    console.log(`[Submitter] Root: ${batchData.root}, Leaves: ${batchData.leafCount}`);

    const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: VERIFIER_ABI,
        functionName: 'submitBatch',
        args: [batchData.root as `0x${string}`, BigInt(batchData.leafCount)],
    });

    console.log(`[Submitter] Transaction submitted: ${txHash}`);

    // Wait for confirmation
    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(
        `[Submitter] Confirmed in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed}`
    );

    // Save batch to DB
    const dbBatch = await insertBatch({
        merkle_root: batchData.root,
        tx_hash: txHash,
        chain_id: chain.id,
        leaf_count: batchData.leafCount,
    });

    // Update all summaries with batch_id
    await updateSummaryBatchId(batchData.summaryIds, dbBatch.id);

    return txHash;
}

/**
 * Verify a proof on-chain (read-only, no gas).
 */
export async function verifyProofOnChain(
    batchId: number,
    proof: string[],
    leaf: string
): Promise<boolean> {
    if (!contractAddress) return false;

    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    });

    const result = await publicClient.readContract({
        address: contractAddress,
        abi: VERIFIER_ABI,
        functionName: 'verifyProof',
        args: [
            BigInt(batchId),
            proof as `0x${string}`[],
            leaf as `0x${string}`,
        ],
    });

    return result as boolean;
}
