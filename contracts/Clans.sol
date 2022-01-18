// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IOxygen.sol";
import "./IY2123.sol";

//import "hardhat/console.sol";

contract Clans is ERC1155, EIP712, Ownable {
  using Strings for uint256;
  string private baseURI;
  using Counters for Counters.Counter;
  Counters.Counter public clanIdTracker;
  bool public featureFlagCreateClan = true;
  bool public featureFlagSwitchColony = false;
  bool public featureFlagSuperDemote = false;
  uint256 public creatorInitialClanTokens = 100;
  uint256 public changeLeaderPercentage = 10;
  uint256 public createClanCostMultiplier = 100;
  uint256 public switchColonyCost = 10000;
  uint256 public switchClanCostBase = 10;
  uint256 public switchClanCostMultiplier = 100000; // divides 100000 (5 decimal points)
  uint256 public updateRankCostMultiplierOxgn = 10;
  uint256 public updateRankCostMultiplierClanToken = 10;
  uint256 public clanRankCap = 5; // to be discussed reduce to 3 or 5
  uint256 public minClanInColony = 3;
  IOxygen public oxgnToken;
  IY2123 public y2123Nft;

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

  function toggleFeatureFlagSuperDemote() external onlyOwner {
    featureFlagSuperDemote = !featureFlagSuperDemote;
  }

  function setChangeLeaderPercentage(uint256 newVal) public onlyOwner {
    require(changeLeaderPercentage > 0, "Value lower then 1");
    changeLeaderPercentage = newVal;
  }

  function setCreatorInitialClanTokens(uint256 newVal) public onlyOwner {
    creatorInitialClanTokens = newVal;
  }

  function setCreateClanCostMultiplier(uint256 newVal) public onlyOwner {
    createClanCostMultiplier = newVal;
  }

  function setSwitchColonyCost(uint256 newVal) public onlyOwner {
    switchColonyCost = newVal;
  }

  function setSwitchClanCostBase(uint256 newVal) public onlyOwner {
    switchClanCostBase = newVal;
  }

  function setSwitchClanCostMultiplier(uint256 newVal) public onlyOwner {
    switchClanCostMultiplier = newVal;
  }

  function setUpdateRankCostMultiplierOxgn(uint256 newVal) public onlyOwner {
    updateRankCostMultiplierOxgn = newVal;
  }

  function setUpdateRankCostMultiplierClanToken(uint256 newVal) public onlyOwner {
    updateRankCostMultiplierClanToken = newVal;
  }

  function setMinClanInColony(uint256 newVal) public onlyOwner {
    minClanInColony = newVal;
  }

  function shouldChangeLeader(uint256 clanId, uint256 amount) public view returns (bool) {
    return amount > (clanToHighestOwnedCount[clanId] * (changeLeaderPercentage + 100)) / 100;
  }

  /** ADMIN */

  function setContracts(address _oxgnToken, address _y2123Nft) external onlyOwner {
    oxgnToken = IOxygen(_oxgnToken);
    y2123Nft = IY2123(_y2123Nft);
  }

  function addAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }

  function _hash(
    address account,
    uint256 oxgnTokenClaim,
    uint256 oxgnTokenDonate,
    uint256 clanTokenClaim,
    uint256 nonce
  ) internal view returns (bytes32) {
    return _hashTypedDataV4(keccak256(abi.encode(keccak256("Claim(address account,uint256 oxgnTokenClaim,uint256 oxgnTokenDonate,uint256 clanTokenClaim,uint256 nonce)"), account, oxgnTokenClaim, oxgnTokenDonate, clanTokenClaim, nonce)));
  }

  function recoverAddress(
    address account,
    uint256 oxgnTokenClaim,
    uint256 oxgnTokenDonate,
    uint256 clanTokenClaim,
    uint256 nonce,
    bytes calldata signature
  ) public view returns (address) {
    return ECDSA.recover(_hash(account, oxgnTokenClaim, oxgnTokenDonate, clanTokenClaim, nonce), signature);
  }

  /** CLAIM & DONATE */

  address _signerAddress;

  function setSignerAddress(address signerAddress) external onlyOwner {
    _signerAddress = signerAddress;
  }

  event Withdraw(address owner, uint256 amount);

  // How important feature for rewarding extra oxgn to clan leader???
  // How to calculate extra oxgn token for clan leader, how to track start/stop timeline for clan leader
  // 20% tax goes randomly to a clanLeader(X number of nft staked percentage chances + min NFT req) wallet address or charity vault
  // Track how much tax clanLeader earned
  // Clan A - 90 NFT staked - 90% chance
  // Clan B - 9 NFT staked - 9% chance
  // Clan C - 1 NFT staked - 1% chance (eliminate)
  function claim(uint256 oxgnTokenClaim, uint256 oxgnTokenDonate, uint256 clanTokenClaim, bytes calldata signature) external {
    require(oxgnTokenClaim > 0, "empty claim");
    require(_signerAddress == recoverAddress(msg.sender, oxgnTokenClaim, oxgnTokenDonate, clanTokenClaim, accountNonce(msg.sender), signature), "invalid signature");

    oxgnToken.mint(msg.sender, oxgnTokenClaim);
    addressToNonce[msg.sender].increment();
    accountToLastWithdraw[msg.sender] = block.timestamp;
    accountToLastWithdrawAmount[msg.sender] = oxgnTokenClaim;
    emit Withdraw(msg.sender, oxgnTokenClaim);
  }

  function withdrawForDonation() external onlyOwner {
    uint256 amount = oxgnToken.balanceOf(address(this));
    oxgnToken.transfer(msg.sender, amount);
  }

  /** CLAN */

  function createClan(uint256 colonyId) public {
    //TODO: Logic Clan leader cant create clan
    require(featureFlagCreateClan, "feature not enabled");
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    require(isEntity(msg.sender), "must be in a clan");
    uint256 clanId = clanIdTracker.current();
    clanToColony[clanId] = colonyId;

///***error prone */
    if (!admins[_msgSender()] && msg.sender != tx.origin) { //rethink tx.orgin here
      uint256 cost = clanId * createClanCostMultiplier;
      if (cost > 0) {
        oxgnToken.burn(_msgSender(), cost);
        oxgnToken.updateOriginAccess();
      }
    }

    clanIdTracker.increment();
    emit ClanCreated(clanId, colonyId);

    // Switch to created clan
    clanStructs[msg.sender].clanId = clanId;
    clanStructs[msg.sender].updateClanTimestamp = block.timestamp;
    // Reset rank
    clanStructs[msg.sender].rank = 0;
    clanStructs[msg.sender].updateRankTimestamp = block.timestamp;

    // Clan leader assigned to msg.sender thru mint
    _mint(msg.sender, clanId, creatorInitialClanTokens, "");
  }

  // Posibility a colony ends up with 0 clan in it
  function switchColony(uint256 clanId, uint256 colonyId) external {
    require(featureFlagSwitchColony, "feature not enabled");
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    require(clanId > 0 && clanId < clanIdTracker.current(), "invalid clan");
    require(clanToColony[clanId] != colonyId, "clan already belongs to this colony");
    uint256 currentColony = clanToColony[clanId];
    uint256 currentColonyCount = getClanCountInColony(currentColony);
    require(currentColonyCount > minClanInColony, "colony needs to have at least some clan");
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

      //console.log("After transfer, %s will have %s tokens.", to, newAmount);
      if (shouldChangeLeader(id, newAmount)) {
        clanToHighestOwnedCount[id] = newAmount;
        clanToHighestOwnedAccount[id] = to;
        //...
        //TODO:Logic for tracking address start and stop being a clan leader
        // Clan ID 1 [addres1(startdate), address2(startdate), address7(startdate)]
        // Clan ID 2 [addres3(startdate), address9(startdate), address3(startdate), address9(startdate)]

        //TODO: address9(startdate) belong Clan ID 2, can only be leader in Clan ID 2

        // address9(startdate) belong Clan ID 2, but holds the most clan id 1 token, 
        //TODO: so when switch to clan id 1 should automatically be the new leader

        //TODO: Clan leader cant change to another clan!

        // have to make it - belong in 1 clan at a time and only can be leader in that same clan
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

  function updateEntityClan(address entityAddress, uint256 clanId) internal {
    require(clanId > 0 && clanId < clanIdTracker.current(), "invalid clan");
    if (isEntity(entityAddress)) {
      //switch clan flow
      //TODO: Logic clan leader cant change to another clan!
      if (clanStructs[entityAddress].clanId != clanId) {
        uint256 switchClanCost = switchClanCostBase + ((getEntityClanCount(clanId) * switchClanCostMultiplier) / 100000);
        oxgnToken.burn(_msgSender(), switchClanCost);
        oxgnToken.updateOriginAccess();

        clanStructs[entityAddress].clanId = clanId;
        clanStructs[entityAddress].updateClanTimestamp = block.timestamp;
        //reset rank
        clanStructs[entityAddress].rank = 0;
        clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
      }
    } else {
      //create clan record flow
      clanStructs[entityAddress].clanId = clanId;
      clanStructs[entityAddress].rank = 0;
      clanStructs[entityAddress].updateClanTimestamp = block.timestamp;
      clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
      clanStructs[entityAddress].isEntity = true;
      entityList.push(entityAddress);
    }
  }

  // clan leader can promote and demote his own rank
  function promoteClanRank(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank < clanRankCap, "max rank reached");

    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      uint256 costOxgn = clanStructs[entityAddress].rank * updateRankCostMultiplierOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
        oxgnToken.updateOriginAccess();
      }
      uint256 costClanToken = clanStructs[entityAddress].rank * updateRankCostMultiplierClanToken;
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
      uint256 costOxgn = clanStructs[entityAddress].rank * updateRankCostMultiplierOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
        oxgnToken.updateOriginAccess();
      }
      uint256 costClanToken = clanStructs[entityAddress].rank * updateRankCostMultiplierClanToken;
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
    require(featureFlagSuperDemote, "feature not enabled");
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank > 0, "rank is 0");

    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      uint256 costOxgn = clanRankCap * updateRankCostMultiplierOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
        oxgnToken.updateOriginAccess();
      }
      uint256 costClanToken = clanRankCap * updateRankCostMultiplierClanToken;
      if (costClanToken > 0) {
        _burn(_msgSender(), clanId, costClanToken);
      }
    }

    clanStructs[entityAddress].rank = 0;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
    return true;
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

  event Stake(uint256 tokenId, address contractAddress, address owner, uint256 clanId);
  event Unstake(uint256 tokenId, address contractAddress, address owner);

  modifier ifContractExists(address contractAddress) {
    require(activeContracts.contains(contractAddress), "contract does not exists");
    _;
  }

  modifier incrementNonce() {
    addressToNonce[msg.sender].increment();
    _;
  }

  function stake(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 clanId
  ) external incrementNonce {
    StakedContract storage _contract = contracts[contractAddress];
    require(_contract.active, "token contract is not active");

    updateEntityClan(msg.sender, clanId);

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      contractTokenIdToOwner[contractAddress][tokenId] = msg.sender;
      _contract.instance.transferFrom(msg.sender, address(this), tokenId);
      addressToStakedTokensSet[contractAddress][msg.sender].add(tokenId);
      contractTokenIdToStakedTimestamp[contractAddress][tokenId] = block.timestamp;

      emit Stake(tokenId, contractAddress, msg.sender, clanId);
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

  /** OXGN TANK */

  mapping(address => uint8) _addressToTankLevel;
  uint256[] public tankPrices = [50 ether, 100 ether, 200 ether, 400 ether, 800 ether, 1600 ether, 3200 ether, 6400 ether, 12800 ether];

  function upgradeTank() external {
    require(tankLevelOfOwner(msg.sender) < tankPrices.length + 1, "tank is at max level");
    oxgnToken.burn(msg.sender, nextLevelTankPrice(msg.sender));
    _addressToTankLevel[msg.sender]++;
  }

  function upgradeTank(address receiver) external onlyOwner {
    require(tankLevelOfOwner(receiver) < tankPrices.length + 1, "tank is at max level");
    _addressToTankLevel[receiver]++;
  }

  function nextLevelTankPrice(address owner) public view returns (uint256) {
    return tankPrices[_addressToTankLevel[owner]];
  }

  function tankLevelOfOwner(address owner) public view returns (uint256) {
    return _addressToTankLevel[owner] + 1;
  }

  function setTankPrices(uint256[] memory newPrices) external onlyOwner {
    tankPrices = newPrices;
  }
}
