# Y2123.com NFT Smart Contracts

Layer C (layerc.io)

Created by shanq.eth

Register for Alchemy API KEY
https://dashboard.alchemyapi.io/

Register for Etherscan API KEY
https://etherscan.io/login

Run unit test:
npx hardhat test

Deploy contract:
npx hardhat run scripts/deploy_oxygen.js --network rinkeby

Verify contract:
npx hardhat verify --contract contracts/Oxygen.sol:Oxygen --network rinkeby <deployed contract address>

Generate .go for GO Backend:
solc --abi contracts/Oxygen.sol --base-path . --include-path node_modules/ -o build
abigen --pkg contracts --abi ./build/Oxygen.abi --out ./build/Oxygen.go
