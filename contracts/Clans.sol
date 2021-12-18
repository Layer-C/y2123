// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IOxygen.sol";
import "./IY2123.sol";

contract Clans is EIP712, Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;
  using Counters for Counters.Counter;

  IOxygen public oxgnToken;
  IY2123 public y2123NFT;

  struct StakedContract {
    bool active;
    IERC721 instance;
  }

  mapping(address => mapping(address => EnumerableSet.UintSet)) addressToStakedTokensSet;
  mapping(address => mapping(uint256 => address)) contractTokenIdToOwner;
  mapping(address => mapping(uint256 => uint256)) contractTokenIdToStakedTimestamp;
  mapping(address => StakedContract) public contracts;
  mapping(address => Counters.Counter) addressToNonce;
  mapping(address => uint256) public accountToLastWithdraw;
  mapping(address => uint256) public accountToLastWithdrawAmount;

  EnumerableSet.AddressSet activeContracts;
  address _signerAddress;

  event Stake(uint256 tokenId, address contractAddress, address owner);
  event Unstake(uint256 tokenId, address contractAddress, address owner);
  event Withdraw(address owner, uint256 amount);

  modifier ifContractExists(address contractAddress) {
    require(activeContracts.contains(contractAddress), "contract does not exists");
    _;
  }

  modifier incrementNonce() {
    addressToNonce[msg.sender].increment();
    _;
  }

  constructor() EIP712("Clans", "1.0") {}

  function setContracts(address _y2123NFT, address _oxgnToken) external onlyOwner {
    y2123NFT = IY2123(_y2123NFT);
    oxgnToken = IOxygen(_oxgnToken);
  }

  function stake(address contractAddress, uint256[] memory tokenIds) external incrementNonce {
    StakedContract storage _contract = contracts[contractAddress];
    require(_contract.active, "token contract is not active");

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];

      // Assign token to his owner
      contractTokenIdToOwner[contractAddress][tokenId] = msg.sender;

      // Transfer token to this smart contract
      _contract.instance.safeTransferFrom(msg.sender, address(this), tokenId);

      // Add this token to user staked tokens
      addressToStakedTokensSet[contractAddress][msg.sender].add(tokenId);

      // Save stake timestamp
      contractTokenIdToStakedTimestamp[contractAddress][tokenId] = block.timestamp;

      emit Stake(tokenId, contractAddress, msg.sender);
    }
  }

  function unstake(address contractAddress, uint256[] memory tokenIds) external incrementNonce ifContractExists(contractAddress) {
    StakedContract storage _contract = contracts[contractAddress];

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      require(addressToStakedTokensSet[contractAddress][msg.sender].contains(tokenId), "token is not staked");

      // Remove owner of this token
      delete contractTokenIdToOwner[contractAddress][tokenId];

      // Transfer token to his owner
      _contract.instance.safeTransferFrom(address(this), msg.sender, tokenId);

      // Remove this token from user staked tokens
      addressToStakedTokensSet[contractAddress][msg.sender].remove(tokenId);

      // Remove stake timestamp
      delete contractTokenIdToStakedTimestamp[contractAddress][tokenId];

      emit Unstake(tokenId, contractAddress, msg.sender);
    }
  }

  function stakedTokensOfOwner(address contractAddress, address owner) external view ifContractExists(contractAddress) returns (uint256[] memory) {
    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[contractAddress][owner];

    uint256[] memory tokenIds = new uint256[](userTokens.length());

    for (uint256 i = 0; i < userTokens.length(); i++) {
      tokenIds[i] = userTokens.at(i);
    }

    return tokenIds;
  }

  function stakedTokenTimestamp(address contractAddress, uint256 tokenId) external view ifContractExists(contractAddress) returns (uint256) {
    return contractTokenIdToStakedTimestamp[contractAddress][tokenId];
  }

  function withdrawGoldz(uint256 amount, bytes calldata signature) external {
    require(_signerAddress == recoverAddress(msg.sender, amount, accountNonce(msg.sender), signature), "invalid signature");
    oxgnToken.transferFrom(address(this), msg.sender, amount);
    addressToNonce[msg.sender].increment();
    accountToLastWithdraw[msg.sender] = block.timestamp;
    accountToLastWithdrawAmount[msg.sender] = amount;
    emit Withdraw(msg.sender, amount);
  }

  function addContract(address contractAddress) public onlyOwner {
    contracts[contractAddress].active = true;
    contracts[contractAddress].instance = IERC721(contractAddress);
    activeContracts.add(contractAddress);
  }

  function updateContract(address contractAddress, bool active) public onlyOwner ifContractExists(contractAddress) {
    require(activeContracts.contains(contractAddress), "contract not added");
    contracts[contractAddress].active = active;
  }

  function accountNonce(address accountAddress) public view returns (uint256) {
    return addressToNonce[accountAddress].current();
  }

  function setSignerAddress(address signerAddress) external onlyOwner {
    _signerAddress = signerAddress;
  }

  function _hash(
    address account,
    uint256 amount,
    uint256 nonce
  ) internal view returns (bytes32) {
    return _hashTypedDataV4(keccak256(abi.encode(keccak256("MyGoldz(uint256 amount,address account,uint256 nonce)"), amount, account, nonce)));
  }

  function recoverAddress(
    address account,
    uint256 amount,
    uint256 nonce,
    bytes calldata signature
  ) public view returns (address) {
    return ECDSA.recover(_hash(account, amount, nonce), signature);
  }

  function onERC721Received(
    address operator,
    address,
    uint256,
    bytes calldata
  ) external returns (bytes4) {
    require(operator == address(this), "token must be staked over stake method");
    return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
  }

  function printY2123() public view returns (uint256) {
    return y2123NFT.totalSupply();
  }
}
