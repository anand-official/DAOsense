import { network } from 'hardhat';

async function main() {
    const { ethers } = await network.connect();
    const currentNetwork = await ethers.provider.getNetwork();
    console.log(`\nDeploying ProposalVerifier to ${currentNetwork.name} (chainId: ${currentNetwork.chainId})\n`);

    const ProposalVerifier = await ethers.getContractFactory('ProposalVerifier');
    const verifier = await ProposalVerifier.deploy();
    await verifier.waitForDeployment();

    const address = await verifier.getAddress();
    console.log(`ProposalVerifier deployed at: ${address}`);
    console.log(`\nAdd to your .env:`);
    console.log(`   NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS=${address}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
