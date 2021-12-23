// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IClans.sol";
import "./IOxygen.sol";
import "./IY2123.sol";

import "hardhat/console.sol";

contract Clans is IClans, ERC1155, EIP712, Ownable, Pausable {
  using Strings for uint256;
  string private baseURI;
  using Counters for Counters.Counter;
  Counters.Counter public clanIdTracker;
  uint256 public creatorInitialClanTokens = 100;
  uint256 public changeLeaderPercentage = 10;
  IOxygen public oxgnToken;
  IY2123 public y2123NFT;

  mapping(address => bool) private admins;
  mapping(uint256 => uint256) public highestOwnedCount;
  mapping(uint256 => address) public highestOwned;

  constructor(string memory _baseURI) ERC1155(_baseURI) EIP712("y2123", "1.0") {
    baseURI = _baseURI;
    _pause();
  }

  function uri(uint256 clanId) public view override returns (string memory) {
    return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, clanId.toString())) : baseURI;
  }

  function shouldChangeLeader(uint256 clanId, uint256 amount) public view returns (bool) {
    return amount > (highestOwnedCount[clanId] * (changeLeaderPercentage + 100)) / 100;
  }

  function createClan() external whenNotPaused {
    uint256 clanId = clanIdTracker.current();
    clanIdTracker.increment();
    _mint(msg.sender, clanId, creatorInitialClanTokens, "");
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override(ERC1155) {
    for (uint256 i = 0; i < ids.length; ++i) {
      uint256 id = ids[i];
      uint256 newAmount = balanceOf(to, id) + amounts[i];

      console.log("After transfer, %s will have %s tokens.", to, newAmount);

      if (shouldChangeLeader(id, newAmount)) {
        highestOwnedCount[id] = newAmount;
        highestOwned[id] = to;
      }
    }

    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }

  /** ADMIN */

  function setContracts(address _y2123NFT, address _oxgnToken) external onlyOwner {
    y2123NFT = IY2123(_y2123NFT);
    oxgnToken = IOxygen(_oxgnToken);
  }

  function setPaused(bool _paused) external onlyOwner {
    if (_paused) _pause();
    else _unpause();
  }

  function addAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }

  /** STAKING */

  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;
  using Counters for Counters.Counter;

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

  // was not view
  function onERC721Received(
    address operator,
    address,
    uint256,
    bytes calldata
  ) external view returns (bytes4) {
    require(operator == address(this), "token must be staked over stake method");
    return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
  }
}
