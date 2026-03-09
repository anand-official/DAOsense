import { expect } from 'chai';
import { ethers } from 'ethers';
import { network } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import type { Signer } from 'ethers';

const { ethers: hhEthers } = await network.connect();

describe('ProposalVerifier', function () {
    let verifier: Awaited<ReturnType<typeof hhEthers.deployContract>>;
    let other: Signer;

    beforeEach(async function () {
        [, other] = await hhEthers.getSigners();
        verifier = await hhEthers.deployContract('ProposalVerifier');
        await verifier.waitForDeployment();
    });

    describe('submitBatch', function () {
        it('should submit a batch with valid root', async function () {
            const leaves = [
                keccak256(Buffer.from('leaf1')),
                keccak256(Buffer.from('leaf2')),
                keccak256(Buffer.from('leaf3')),
            ];
            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const root = tree.getHexRoot();

            await expect(verifier.submitBatch(root, 3))
                .to.emit(verifier, 'BatchSubmitted')
                .withArgs(0, root, 3, (await hhEthers.provider.getBlock('latest'))!.timestamp + 1);

            expect(await verifier.batchCount()).to.equal(1);
        });

        it('should reject empty root', async function () {
            await expect(
                verifier.submitBatch(ethers.ZeroHash, 3)
            ).to.be.revertedWith('Empty root');
        });

        it('should reject zero leaf count', async function () {
            const root = keccak256(Buffer.from('test'));
            await expect(
                verifier.submitBatch(root, 0)
            ).to.be.revertedWith('Empty batch');
        });

        it('should only allow owner to submit', async function () {
            const root = keccak256(Buffer.from('test'));
            await expect(
                (verifier.connect(other) as unknown as typeof verifier).submitBatch(root, 1)
            ).to.be.revertedWithCustomError(verifier, 'OwnableUnauthorizedAccount');
        });
    });

    describe('verifyProof', function () {
        it('should verify a valid Merkle proof', async function () {
            const leaves = [
                keccak256(Buffer.from('proposal1+summary1')),
                keccak256(Buffer.from('proposal2+summary2')),
                keccak256(Buffer.from('proposal3+summary3')),
            ];
            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const root = tree.getHexRoot();

            await verifier.submitBatch(root, 3);

            // Verify each leaf
            for (const leaf of leaves) {
                const proof = tree.getHexProof(leaf);
                const isValid = await verifier.verifyProof(0, proof, leaf);
                expect(isValid).to.equal(true);
            }
        });

        it('should reject invalid proofs', async function () {
            const leaves = [
                keccak256(Buffer.from('leaf1')),
                keccak256(Buffer.from('leaf2')),
            ];
            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const root = tree.getHexRoot();

            await verifier.submitBatch(root, 2);

            const fakeLeaf = keccak256(Buffer.from('fake'));
            const proof = tree.getHexProof(leaves[0]);
            const isValid = await verifier.verifyProof(0, proof, fakeLeaf);
            expect(isValid).to.equal(false);
        });

        it('should reject non-existent batch', async function () {
            await expect(
                verifier.verifyProof(99, [], keccak256(Buffer.from('test')))
            ).to.be.revertedWith('Batch does not exist');
        });
    });

    describe('getBatch', function () {
        it('should return correct batch details', async function () {
            const root = keccak256(Buffer.from('test'));
            await verifier.submitBatch(root, 5);

            const [merkleRoot, timestamp, leafCount] = await verifier.getBatch(0);
            expect(merkleRoot).to.equal('0x' + root.toString('hex'));
            expect(leafCount).to.equal(5);
            expect(timestamp).to.be.gt(0);
        });
    });

    describe('revokeBatch', function () {
        it('should allow owner to revoke a batch', async function () {
            const root = keccak256(Buffer.from('test'));
            await verifier.submitBatch(root, 5);

            await expect(verifier.revokeBatch(0))
                .to.emit(verifier, 'BatchRevoked')
                .withArgs(0);

            const [merkleRoot] = await verifier.getBatch(0);
            expect(merkleRoot).to.equal(ethers.ZeroHash);
        });

        it('should revert if not owner', async function () {
            const root = keccak256(Buffer.from('test'));
            await verifier.submitBatch(root, 5);

            await expect(
                (verifier.connect(other) as unknown as typeof verifier).revokeBatch(0)
            ).to.be.revertedWithCustomError(verifier, 'OwnableUnauthorizedAccount');
        });
    });

    describe('pause/unpause', function () {
        it('should allow owner to pause and unpause', async function () {
            await verifier.pause();
            expect(await verifier.paused()).to.equal(true);

            await verifier.unpause();
            expect(await verifier.paused()).to.equal(false);
        });

        it('should revert verifyProof when paused', async function () {
            const leaves = [keccak256(Buffer.from('leaf1'))];
            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const root = tree.getHexRoot();

            await verifier.submitBatch(root, 1);
            await verifier.pause();

            const leaf = leaves[0];
            const proof = tree.getHexProof(leaf);

            await expect(
                verifier.verifyProof(0, proof, leaf)
            ).to.be.revertedWithCustomError(verifier, 'EnforcedPause');
        });
    });
});
