import { ethers } from 'hardhat';

async function main() {
    const network = await ethers.provider.getNetwork();
    console.log(`\n🚀 Deploying ProposalVerifier to ${network.name} (chainId: ${network.chainId})\n`);

    const ProposalVerifier = await ethers.getContractFactory('ProposalVerifier');
    const verifier = await ProposalVerifier.deploy();
    await verifier.waitForDeployment();

    const address = await verifier.getAddress();
    console.log(`✅ ProposalVerifier deployed at: ${address}`);
    console.log(`\n📋 Add to your .env:`);
    console.log(`   NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS=${address}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
