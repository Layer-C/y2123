// SPDX-License-Identifier: MIT LICENSE
pragma solidity ^0.8.0;

interface IOxygen {
  function mint(address to, uint256 amount) external;

  function burn(address from, uint256 amount) external;

  function balanceOf(address account) external view returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
