const Web3 = require('web3');
require("dotenv").config();

const web3 = new Web3(process.env.RPC_URL);

// // Variables
const contractAddress = process.env.CONTRACT_ADDRESS; // Your deployed contract address
const privateKey = process.env.PRIVATE_KEY; // The private key of the owner wallet
const ownerAddress = process.env.OWNER_ADDRESS; // The owner's Ethereum address
// // ABI of the MyToken contract
const contractABI = require('./CONTRACT_ABI.json');

// // Create contract instance
const myTokenContract = new web3.eth.Contract(contractABI, contractAddress);

const YanTokenContract = {

    // Function to mint tokens
    mintTokens: async (to, amount) => {
        
               
        const nonce = await web3.eth.getTransactionCount(ownerAddress, 'latest');

        const tx = {
            from: ownerAddress,
            to: contractAddress,
            nonce: nonce,
            gas: 2000000, // Adjust gas limit as needed 
            data: myTokenContract.methods.mint(to, amount).encodeABI(),
        };

        // Sign the transaction 
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

        // Send the transaction 
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);


        return receipt;
    },

    // Function to burn tokens

    burnTokens: async (from, amount) => {

        const nonce = await web3.eth.getTransactionCount(ownerAddress, 'latest');

        const tx = {
            from: ownerAddress,
            to: contractAddress,
            nonce: nonce,
            gas: 2000000, // Adjust gas limit as needed 
            data: myTokenContract.methods.burnToken(from, amount).encodeABI(),
        };

        // Sign the transaction 
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

        // Send the transaction 
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt;
    },

    burnAllTokens: async (from) => {
        // Retrieve the balance of the 'from' address
        const balance = await myTokenContract.methods.balanceOf(from).call();
    
        // Check if the balance is greater than 0
        if (balance > 0) {
            const nonce = await web3.eth.getTransactionCount(ownerAddress, 'latest');
    
            const tx = {
                from: ownerAddress,
                to: contractAddress,
                nonce: nonce,
                gas: 2000000, // Adjust gas limit as needed
                data: myTokenContract.methods.burnToken(from, balance).encodeABI(),
            };
    
            // Sign the transaction 
            const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    
            // Send the transaction 
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            return receipt;
        } else {
            console.log('No tokens to burn for this address');
        }
    }
    

}

module.exports = YanTokenContract;