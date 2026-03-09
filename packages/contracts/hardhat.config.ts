import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import { defineConfig } from "hardhat/config";
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = defineConfig({
    plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
    solidity: {
        profiles: {
            default: {
                version: "0.8.24",
            },
            production: {
                version: "0.8.24",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        },
    },
    test: {
        mocha: {
            timeout: 40000,
        },
    },
    networks: {
        fuji: {
            type: "http",
            chainType: "l1",
            url: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
            chainId: 43113,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
        },
        mainnet: {
            type: "http",
            chainType: "l1",
            url: process.env.MAINNET_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
            chainId: 43114,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
        },
    },
});

export default config;
