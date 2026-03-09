import { createPublicClient, http } from 'viem';
import { avalancheFuji, avalanche } from 'viem/chains';
import { VERIFIER_ABI } from './verification/submitter';

/**
 * Client-side verification using viem.
 * Calls the contract's verifyProof function (read-only, no gas cost for user).
 */

const contractAddress = process.env
    .NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS as `0x${string}`;

// Use Fuji for dev, mainnet for production
const chain =
    process.env.NEXT_PUBLIC_CHAIN_ID === '43114' ? avalanche : avalancheFuji;

const publicClient = createPublicClient({
    chain,
    transport: http(),
});

export interface VerificationResult {
    verified: boolean;
    txLink: string | null;
    batchId: number;
    error?: string;
}

/**
 * Verify a proposal summary's integrity on-chain.
 */
export async function verifyOnChain(
    batchId: number,
    proof: `0x${string}`[],
    leaf: `0x${string}`,
    txHash?: string
): Promise<VerificationResult> {
    try {
        if (!contractAddress) {
            return {
                verified: false,
                txLink: null,
                batchId,
                error: 'Contract address not configured',
            };
        }

        const result = await publicClient.readContract({
            address: contractAddress,
            abi: VERIFIER_ABI,
            functionName: 'verifyProof',
            args: [BigInt(batchId), proof, leaf],
        });

        const explorerBase =
            chain.id === 43114
                ? 'https://snowtrace.io/tx/'
                : 'https://testnet.snowtrace.io/tx/';

        return {
            verified: result as boolean,
            txLink: txHash ? `${explorerBase}${txHash}` : null,
            batchId,
        };
    } catch (error) {
        return {
            verified: false,
            txLink: null,
            batchId,
            error: `Verification failed: ${error}`,
        };
    }
}
