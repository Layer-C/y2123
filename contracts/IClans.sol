// SPDX-License-Identifier: MIT LICENSE
pragma solidity ^0.8.0;

interface IClans {
  function stake(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 clanId
  ) external;
}
