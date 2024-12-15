import * as ethers from "ethers";
import * as accs from './accs.js';
import axios from "axios";
import crypto from "crypto-js";

const chains = {
    "ethereum": "https://api.etherscan.io/api",
    "polygon": "https://api.polygonscan.com/api",
    "optimism": "https://api-optimistic.etherscan.io/api",
    "arbitrum": "https://api.arbiscan.io/api",
    "fantom": "https://api.ftmscan.com/api",
    "bsc": "https://api.bscscan.com/api",
    // "core": "https://scan.coredao.org/api" пока не работает
};

const apiKeys = {
    "ethereum": process.env.ethereum,
    "polygon": process.env.polygon,
    "optimism": process.env.optimism,
    "arbitrum": process.env.arbitrum,
    "fantom": process.env.fantom,
    "bsc": process.env.bsc,
    "core": process.env.core
};


const sleep = async (millis) => new Promise(resolve => setTimeout(resolve, millis));

const abi = [
  {
    "constant": false,
    "inputs": [
      {
        "name": "to",
        "type": "address"
      },
      {
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const iface = new ethers.utils.Interface(abi);

let transfers = [];
const abiCoder = new ethers.utils.AbiCoder();

const collectTransfers = async (address) => {
    address = address.toLowerCase();
    for (const [chain, endpoint] of Object.entries(chains)) {
        let cursor = null;

        await sleep(1 * 1000);
        try {
            axios.get(endpoint, {
              params: {
                module: 'account',
                action: 'txlist',
                address: address,
                apikey: apiKeys.chain,
              }
            }).then(response => {
                const result = response.data.result;
                if (Array.isArray(result)) {
                    result.map(async function(tx) {
                        if (tx.from == address.toLowerCase()) {
                            if (tx.functionName.includes('transfer(')) {
                                try {
                                    let decodedInput = iface.decodeFunctionData("transfer", tx.input);
                                    let addressTo = decodedInput.to.toLowerCase();
                                    if (!transfers[address].includes(addressTo)) {
                                        transfers[address].push(addressTo);
                                    }
                                } catch (err) {}
                            }

                            if (tx.methodId == '0x') {
                                if (!transfers[address].includes(tx.to.toLowerCase())) {
                                    transfers[address].push(tx.to.toLowerCase());
                                }
                            }
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Ошибка при выполнении запроса:', error);
            });
        } catch (err) {
            console.log(err);
        }
    }
};

function findAddressMatches(transfers) {
    const allElements = [];
    const matchingElements = {};
    for (const address in transfers) {
        const addresses = transfers[address];
        allElements.push(...addresses);
    }

    const duplicates = allElements.filter((element, index) => allElements.indexOf(element) !== index);

    for (const address in transfers) {
        const addresses = transfers[address];
        const matches = addresses.filter((element) => duplicates.includes(element));

        if (matches.length > 0) {
          matchingElements[address] = matches;
        }
    }

    return matchingElements;
}

function findMatchingTransfers(transfers) {
    const processedLinks = new Set();

    for (const walletX in transfers) {
        for (const walletY in transfers) {
            if (walletX !== walletY) {
                const receiversX = transfers[walletX];
                const receiversY = transfers[walletY];
                const commonReceiver = receiversX.find(receiver => receiversY.includes(receiver));

                if (commonReceiver && !processedLinks.has(`${walletY}_${walletX}`)) {
                    console.log(`Кошельки ${walletX} и ${walletY} связаны переводом на кошелек ${commonReceiver}`);
                    processedLinks.add(`${walletX}_${walletY}`);
                }
            }
        }
    }
}


const accounts = accs.importAccs();
const colors = new Map();

async function fetchData() {
    for (const account of accounts) {
        transfers[account.toLowerCase()] = [];
        await collectTransfers(account);
    }
    
    console.log(transfers);
    let addressMatches = findAddressMatches(transfers);
    console.log(addressMatches);
    findMatchingTransfers(addressMatches);
}

fetchData().catch(error => {
    console.error('Произошла ошибка:', error);
});

