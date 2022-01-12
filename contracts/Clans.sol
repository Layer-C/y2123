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
  bool public featureFlagCreateClan = true;
  bool public featureFlagSwitchColony = false;
  uint256 public creatorInitialClanTokens = 100;
  uint256 public changeLeaderPercentage = 10;
  uint256 public createClanCostMultiplyer = 100;
  uint256 public switchColonyCost = 10000;
  uint256 public updateRankCostMultiplyerOxgn = 10;
  uint256 public updateRankCostMultiplyerClanToken = 10;
  uint256 public clanRankCap = 5; // to be discussed reduce to 3 or 5
  IOxygen public oxgnToken;
  IY2123 public y2123NFT;

  mapping(address => bool) private admins;
  mapping(uint256 => uint256) public clanToHighestOwnedCount;
  mapping(uint256 => address) public clanToHighestOwnedAccount;
  mapping(uint256 => uint256) public clanToColony;

  event ClanCreated(uint256 indexed clanId, uint256 indexed colonyId);
  event SwitchColony(uint256 indexed clanId, uint256 indexed colonyId);

  constructor(string memory _baseURI) ERC1155(_baseURI) EIP712("y2123", "1.0") {
    baseURI = _baseURI;
    clanIdTracker.increment(); // start with clanId = 1
    createClan(1); // clanId = 1 in colonyId = 1
    createClan(2); // clanId = 2 in colonyId = 2
    createClan(3); // clanId = 3 in colonyId = 3
    featureFlagCreateClan = false;
    _pause();
  }

  function uri(uint256 clanId) public view override returns (string memory) {
    return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, clanId.toString())) : baseURI;
  }

  function toggleFeatureFlagCreateClan() external onlyOwner {
    featureFlagCreateClan = !featureFlagCreateClan;
  }

  function toggleFeatureFlagSwitchColony() external onlyOwner {
    featureFlagSwitchColony = !featureFlagSwitchColony;
  }

  function setChangeLeaderPercentage(uint256 newVal) public onlyOwner {
    require(changeLeaderPercentage > 0, "Value lower then 1");
    changeLeaderPercentage = newVal;
  }

  function setCreatorInitialClanTokens(uint256 newVal) public onlyOwner {
    creatorInitialClanTokens = newVal;
  }

  function setCreateClanCostMultiplyer(uint256 newVal) public onlyOwner {
    createClanCostMultiplyer = newVal;
  }

  function setSwitchColonyCost(uint256 newVal) public onlyOwner {
    switchColonyCost = newVal;
  }

  function setUpdateRankCostMultiplyerOxgn(uint256 newVal) public onlyOwner {
    updateRankCostMultiplyerOxgn = newVal;
  }

  function setUpdateRankCostMultiplyerClanToken(uint256 newVal) public onlyOwner {
    updateRankCostMultiplyerClanToken = newVal;
  }

  function shouldChangeLeader(uint256 clanId, uint256 amount) public view returns (bool) {
    return amount > (clanToHighestOwnedCount[clanId] * (changeLeaderPercentage + 100)) / 100;
  }

  function createClan(uint256 colonyId) public {
    require(featureFlagCreateClan, "feature not enabled");
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    uint256 clanId = clanIdTracker.current();
    clanToColony[clanId] = colonyId;

    if (!admins[_msgSender()] && msg.sender != tx.origin) {
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

  function switchColony(uint256 clanId, uint256 colonyId) external {
    require(featureFlagSwitchColony, "feature not enabled");
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    require(clanId < clanIdTracker.current(), "invalid clan");
    require(clanToColony[clanId] != colonyId, "clan already belongs to this colony");
    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      oxgnToken.burn(_msgSender(), switchColonyCost);
      oxgnToken.updateOriginAccess();
    }

    emit SwitchColony(clanId, colonyId);
    clanToColony[clanId] = colonyId;
  }

  function getClanCountInColony(uint256 colonyId) public view returns (uint256 clans) {
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    uint256 clanCount = 0;
    for (uint256 i = 0; i < clanIdTracker.current(); i++) {
      if (clanToColony[i] == colonyId) {
        clanCount++;
      }
    }
    return clanCount;
  }

//Error!
  function getClansInColony(uint256 colonyId) public view returns (uint256[] memory) {
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    uint256 clanCount = getClanCountInColony(colonyId);
    uint256[] memory clans = new uint256[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < clanIdTracker.current(); i++) {
      if (clanToColony[i] == colonyId) {
        clans[clanIndex] = i;
        clanIndex++;
      }
    }
    return clans;
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
        clanToHighestOwnedCount[id] = newAmount;
        clanToHighestOwnedAccount[id] = to;
      }
    }

    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }

  /** CLAN RECORDS */

  struct ClanStruct {
    uint256 clanId;
    uint256 rank;
    uint256 updateClanTimestamp;
    uint256 updateRankTimestamp;
    bool isEntity;
  }

  struct ClanRecordsStruct {
    address entity;
    uint256[] stakedNftIds;
    uint256[] stakedNftTimestamps;
    ClanStruct clanData;
  }

  mapping(address => ClanStruct) public clanStructs;
  address[] public entityList;

  function isEntity(address entityAddress) public view returns (bool isIndeed) {
    return clanStructs[entityAddress].isEntity;
  }

  function getEntityCount() public view returns (uint256 entityCount) {
    return entityList.length;
  }

  function getEntityClanCount(uint256 clanId) public view returns (uint256 entityCount) {
    uint256 clanCount = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        clanCount++;
      }
    }
    return clanCount;
  }

//Error!
  function getAccountsInClan(uint256 clanId) public view returns (address[] memory) {
    uint256 clanCount = getEntityClanCount(clanId);
    address[] memory e = new address[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        e[clanIndex] = entityList[i];
        clanIndex++;
      }
    }
    return e;
  }

//Error!
  function getClanRecords(uint256 clanId) public view returns (ClanRecordsStruct[] memory) {
    uint256 clanCount = getEntityClanCount(clanId);
    ClanRecordsStruct[] memory e = new ClanRecordsStruct[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        e[clanIndex].entity = entityList[i];
        e[clanIndex].clanData = getClan(entityList[i]);
        clanIndex++;
      }
    }
    return e;
  }

//Error!
  function getClanAndStakedRecords(uint256 clanId, address nftContractAddress) public view returns (ClanRecordsStruct[] memory) {
    uint256 clanCount = getEntityClanCount(clanId);
    ClanRecordsStruct[] memory e = new ClanRecordsStruct[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        e[clanIndex].entity = entityList[i];
        e[clanIndex].clanData = getClan(entityList[i]);
        e[clanIndex].stakedNftIds = stakedTokensOfOwner(nftContractAddress, entityList[i]);
        if (e[clanIndex].stakedNftIds.length > 0) {
          uint256[] memory ts = new uint256[](e[clanIndex].stakedNftIds.length);
          for (uint256 j = 0; j < e[clanIndex].stakedNftIds.length; j++) {
            ts[j] = stakedTokenTimestamp(nftContractAddress, e[clanIndex].stakedNftIds[j]);
          }
          e[clanIndex].stakedNftTimestamps = ts;
        }
        clanIndex++;
      }
    }
    return e;
  }

  function getClan(address entityAddress) public view returns (ClanStruct memory) {
    return clanStructs[entityAddress];
  }

  function newEntity(address entityAddress, uint256 clanId) public returns (bool success) {
    require(!isEntity(entityAddress), "account already in a clan");
    clanStructs[entityAddress].clanId = clanId;
    clanStructs[entityAddress].rank = 0;
    clanStructs[entityAddress].updateClanTimestamp = block.timestamp;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
    clanStructs[entityAddress].isEntity = true;
    entityList.push(entityAddress);
    return true;
  }

  function updateEntityClan(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId != clanId, "account already in this clan");
    clanStructs[entityAddress].clanId = clanId;
    clanStructs[entityAddress].rank = 0;
    clanStructs[entityAddress].updateClanTimestamp = block.timestamp;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
    return true;
  }

  // clan leader can promote and demote his own rank
  function promoteClanRank(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank < clanRankCap, "max rank reached");

    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      uint256 costOxgn = clanStructs[entityAddress].rank * updateRankCostMultiplyerOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
        oxgnToken.updateOriginAccess();
      }
      uint256 costClanToken = clanStructs[entityAddress].rank * updateRankCostMultiplyerClanToken;
      if (costClanToken > 0) {
        _burn(_msgSender(), clanId, costClanToken);
      }
    }

    clanStructs[entityAddress].rank = clanStructs[entityAddress].rank + 1;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
    return true;
  }

  function demoteClanRank(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank > 0, "rank is 0");

    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      uint256 costOxgn = clanStructs[entityAddress].rank * updateRankCostMultiplyerOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
        oxgnToken.updateOriginAccess();
      }
      uint256 costClanToken = clanStructs[entityAddress].rank * updateRankCostMultiplyerClanToken;
      if (costClanToken > 0) {
        _burn(_msgSender(), clanId, costClanToken);
      }
    }

    clanStructs[entityAddress].rank = clanStructs[entityAddress].rank - 1;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
    return true;
  }

  // Super demote to rank 0 no matter what rank you are now!
  function superDemoteClanRank(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank > 0, "rank is 0");

    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      uint256 costOxgn = clanRankCap * updateRankCostMultiplyerOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
        oxgnToken.updateOriginAccess();
      }
      uint256 costClanToken = clanRankCap * updateRankCostMultiplyerClanToken;
      if (costClanToken > 0) {
        _burn(_msgSender(), clanId, costClanToken);
      }
    }

    clanStructs[entityAddress].rank = 0;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
    return true;
  }

  // any clan balancing on chain?

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
      _contract.instance.transferFrom(msg.sender, address(this), tokenId);
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
      _contract.instance.transferFrom(address(this), msg.sender, tokenId);
      addressToStakedTokensSet[contractAddress][msg.sender].remove(tokenId);
      delete contractTokenIdToStakedTimestamp[contractAddress][tokenId];

      emit Unstake(tokenId, contractAddress, msg.sender);
    }
  }

  function stakedTokensOfOwner(address contractAddress, address owner) public view ifContractExists(contractAddress) returns (uint256[] memory) {
    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[contractAddress][owner];
    uint256[] memory tokenIds = new uint256[](userTokens.length());

    for (uint256 i = 0; i < userTokens.length(); i++) {
      tokenIds[i] = userTokens.at(i);
    }

    return tokenIds;
  }

  function stakedTokenTimestamp(address contractAddress, uint256 tokenId) public view ifContractExists(contractAddress) returns (uint256) {
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
