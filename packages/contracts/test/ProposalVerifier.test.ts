import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import type { ProposalVerifier } from '../typechain-types';

describe('ProposalVerifier', function () {
    let verifier: ProposalVerifier;
    let owner: any;
    let other: any;

    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory('ProposalVerifier');
        verifier = (await Factory.deploy()) as unknown as ProposalVerifier;
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
                .withArgs(0, root, 3, (await ethers.provider.getBlock('latest'))!.timestamp + 1);

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
                verifier.connect(other).submitBatch(root, 1)
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
                expect(isValid).to.be.true;
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
            expect(isValid).to.be.false;
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
});
