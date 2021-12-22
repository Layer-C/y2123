// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IClans.sol";

contract Clans_only is IClans, ERC1155, Ownable, Pausable {
  using Strings for uint256;
  string private baseURI;
  using Counters for Counters.Counter;
  Counters.Counter public clanIdTracker;
  uint256 public creatorInitialClanTokens;
  uint256 public changeLeaderPercentage;

  mapping(uint256 => uint256) public highestOwnedCount;
  mapping(uint256 => address) public highestOwned;

  constructor(string memory _baseURI) ERC1155(_baseURI) {
    baseURI = _baseURI;
    _pause();
  }

  function uri(uint256 clanId) public view override returns (string memory) {
    return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, clanId.toString())) : baseURI;
  }

  function calculateClanTokenRequired(uint256 amount) external view returns (uint256) {
    return (amount * changeLeaderPercentage) / 100;
  }

  function createClan() external whenNotPaused {
    uint256 clanId = clanIdTracker.current();
    clanIdTracker.increment();
    _mint(msg.sender, clanId, creatorInitialClanTokens, "");
    highestOwnedCount[clanId] = creatorInitialClanTokens;
    highestOwned[clanId] = msg.sender;
  }
}
