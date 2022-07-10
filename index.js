require('dotenv').config();
const ethers = require('ethers');
const LitSDK = require("lit-js-sdk/build/index.node.js")

const lit = new LitSDK.LitNodeClient({
    alertWhenUnauthorized: false,
    // debug: false
});

const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const consumer = new ethers.Wallet(process.env.CONSUMER_WALLET_PK, ethersProvider);
const provider = new ethers.Wallet(process.env.PROVIDER_WALLET_PK, ethersProvider);

const chain = process.env.LIT_CHAIN;
const signedMessage = "Cask Protocol Example";

const planId = '100';
const secretMessage = "this is a super secret message";


// globals to simulate persisting the encrypted string and key
let saveEncryptedString;
let saveEncryptedSymmetricKey;


function accessControlConditions() {
    return [
        {
            conditionType: "evmBasic",
            contractAddress: "",
            standardContractType: "",
            chain,
            method: "",
            parameters: [":userAddress"],
            returnValueTest: {
                comparator: "=",
                value: provider.address,
            },
        },
        {operator: "or"},
        {
            conditionType: "evmBasic",
            contractAddress: process.env.CASK_SUBSCRIPTIONS_CONTRACT,
            standardContractType: 'CASK',
            chain,
            method: 'getActiveSubscriptionCount',
            parameters: [
                ':userAddress',
                provider.address,
                planId
            ],
            returnValueTest: {
                comparator: '>',
                value: '0'
            }
        },
    ];
}

async function encrypt() {
    console.log(`ENCRYPTING...`);

    const saveAuthSig = {
        sig: await provider.signMessage(signedMessage),
        derivedVia: "web3.eth.personal.sign",
        signedMessage: signedMessage,
        address: provider.address,
    };

    const {encryptedString, symmetricKey} = await LitSDK.encryptString(secretMessage);

    const encryptedSymmetricKey = await lit.saveEncryptionKey({
        unifiedAccessControlConditions: accessControlConditions(),
        symmetricKey,
        authSig: saveAuthSig,
        chain,
    });

    saveEncryptedString = ethers.utils.hexlify(new Uint8Array(await encryptedString.arrayBuffer()));
    saveEncryptedSymmetricKey = ethers.utils.hexlify(encryptedSymmetricKey);

    console.log(`encryptedString: ${saveEncryptedString}`);
    console.log(`encryptedSymmetricKey: ${saveEncryptedSymmetricKey}`);
}

async function decryptAsConsumer() {
    console.log(`DECRYPTING AS CONSUMER...`);

    const restoreAuthSigConsumer = {
        sig: await consumer.signMessage(signedMessage),
        derivedVia: "web3.eth.personal.sign",
        signedMessage: signedMessage,
        address: consumer.address,
    };

    const decryptSymmetricKey = await lit.getEncryptionKey({
        unifiedAccessControlConditions: accessControlConditions(),
        toDecrypt: saveEncryptedSymmetricKey.substring(2), // strip leading '0x'
        chain,
        authSig: restoreAuthSigConsumer,
    });

    const decryptedString = await LitSDK.decryptString(
        new Blob([ethers.utils.arrayify(saveEncryptedString).buffer]),
        decryptSymmetricKey);

    console.log(`Decrypt result: ${decryptedString}`);
}

async function decryptAsProvider() {
    console.log(`DECRYPTING AS PROVIDER...`);

    const restoreAuthSigProvider = {
        sig: await provider.signMessage(signedMessage),
        derivedVia: "web3.eth.personal.sign",
        signedMessage: signedMessage,
        address: provider.address,
    };

    const decryptSymmetricKey = await lit.getEncryptionKey({
        unifiedAccessControlConditions: accessControlConditions(),
        toDecrypt: saveEncryptedSymmetricKey.substring(2), // strip leading '0x'
        chain,
        authSig: restoreAuthSigProvider,
    });

    const decryptedString = await LitSDK.decryptString(
        new Blob([ethers.utils.arrayify(saveEncryptedString).buffer]),
        decryptSymmetricKey);

    console.log(`Decrypt result: ${decryptedString}`);
}




(async () => {
    await lit.connect();

    await encrypt();
    await decryptAsConsumer();
    // await decryptAsProvider();
})();