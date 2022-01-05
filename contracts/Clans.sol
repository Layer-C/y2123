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
  uint256 public createClanCostMultiplyer = 100;
  uint256 public switchColonyCost = 10000;
  IOxygen public oxgnToken;
  IY2123 public y2123NFT;

  mapping(address => bool) private admins;
  mapping(uint256 => uint256) public highestOwnedCount;
  mapping(uint256 => address) public highestOwned;
  mapping(uint256 => uint256) public clanColony;

  event ClanCreated(uint256 indexed clanId, uint256 indexed colonyId);
  event SwitchColony(uint256 indexed clanId, uint256 indexed colonyId);

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

  function createClan(uint256 colonyId) external whenNotPaused {
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    uint256 clanId = clanIdTracker.current();
    clanColony[clanId] = colonyId;

    if (!admins[_msgSender()]) {
      uint256 cost = clanId * createClanCostMultiplyer;
      if (cost > 0) {
        oxgnToken.burn(_msgSender(), cost);
        oxgnToken.updateOriginAccess();
      }
    }

    clanIdTracker.increment();
    emit ClanCreated(clanId, colonyId);
    _mint(msg.sender, clanId, creatorInitialClanTokens, "");
  }

  function switchColony(uint256 clanId, uint256 colonyId) external whenNotPaused {
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    require(clanId < clanIdTracker.current(), "invalid clan");
    require(highestOwned[clanId] == _msgSender(), "clan leader only");
    require(clanColony[clanId] != colonyId, "clan already belongs to this colony");

    oxgnToken.burn(_msgSender(), switchColonyCost);
    oxgnToken.updateOriginAccess();

    emit SwitchColony(clanId, colonyId);
    clanColony[clanId] = colonyId;
  }

  function testMint(
    address to,
    uint256 id,
    uint256 amount
  ) external {
    _mint(to, id, amount, "");
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

  function setContracts(address _oxgnToken) external onlyOwner {
    //y2123NFT = IY2123(_y2123NFT);
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
      contractTokenIdToOwner[contractAddress][tokenId] = msg.sender;
      _contract.instance.safeTransferFrom(msg.sender, address(this), tokenId);
      addressToStakedTokensSet[contractAddress][msg.sender].add(tokenId);
      contractTokenIdToStakedTimestamp[contractAddress][tokenId] = block.timestamp;

      emit Stake(tokenId, contractAddress, msg.sender);
    }
  }

  function unstake(address contractAddress, uint256[] memory tokenIds) external incrementNonce ifContractExists(contractAddress) {
    StakedContract storage _contract = contracts[contractAddress];

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      require(addressToStakedTokensSet[contractAddress][msg.sender].contains(tokenId), "token is not staked");

      delete contractTokenIdToOwner[contractAddress][tokenId];
      _contract.instance.safeTransferFrom(address(this), msg.sender, tokenId);
      addressToStakedTokensSet[contractAddress][msg.sender].remove(tokenId);
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

  /** CLAIM & DONATE */

  function claim(uint256 amount, bytes calldata signature) external {
    require(amount > 0, "you have nothing to withdraw, do not lose your gas");
    require(_signerAddress == recoverAddress(msg.sender, amount, accountNonce(msg.sender), signature), "invalid signature");
    oxgnToken.mint(msg.sender, amount);
    addressToNonce[msg.sender].increment();
    accountToLastWithdraw[msg.sender] = block.timestamp;
    accountToLastWithdrawAmount[msg.sender] = amount;
    emit Withdraw(msg.sender, amount);
  }

  function withdrawForDonation() external onlyOwner {
    uint256 amount = oxgnToken.balanceOf(address(this));
    oxgnToken.transfer(msg.sender, amount);
  }

  /** VAULT */

  mapping(address => uint8) _addressToVaultLevel;
  uint256[] public vaultPrices = [40 ether, 80 ether, 120 ether, 240 ether, 480 ether, 960 ether, 2880 ether, 8640 ether, 25920 ether];

  function buyVault() external {
    require(vaultLevelOfOwner(msg.sender) < vaultPrices.length + 1, "vault is at max level");
    oxgnToken.burn(msg.sender, nextVaultPrice(msg.sender));
    _addressToVaultLevel[msg.sender]++;
  }

  function buyVault(address receiver) external onlyOwner {
    require(vaultLevelOfOwner(receiver) < vaultPrices.length + 1, "vault is at max level");
    _addressToVaultLevel[receiver]++;
  }

  function nextVaultPrice(address owner) public view returns (uint256) {
    return vaultPrices[_addressToVaultLevel[owner]];
  }

  function vaultLevelOfOwner(address owner) public view returns (uint256) {
    return _addressToVaultLevel[owner] + 1;
  }

  function setVaultPrices(uint256[] memory newPrices) external onlyOwner {
    vaultPrices = newPrices;
  }
}
