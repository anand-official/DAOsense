import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.24',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {},
        fuji: {
            url: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
            chainId: 43113,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
        },
        mainnet: {
            url: process.env.MAINNET_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
            chainId: 43114,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
        },
    },
};

export default config;
