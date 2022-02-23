// SPDX-License-Identifier: MIT LICENSE
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IOxygen.sol";

contract Oxygen is IOxygen, ERC20, Ownable {
  mapping(address => bool) private admins;
  uint256 public MAX_SUPPLY = 8000000000 ether;
  uint256 public rewardCount;
  uint256 public donationCount;
  uint256 public mintedCount;

  constructor() ERC20("Y2123 OXGN", "OXGN") {}

  function setMaxSupply(uint256 amount) external onlyOwner {
    require(amount > totalSupply(), "Value is smaller than the number of existing tokens");
    MAX_SUPPLY = amount;
  }

  function addAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }

  function mint(address to, uint256 amount) external override {
    require(admins[msg.sender], "Only admins can mint");
    require(mintedCount + amount <= MAX_SUPPLY, "Amount exceeds max cap or max cap reached!");
    mintedCount = mintedCount + amount;
    _mint(to, amount);
  }

  function reward(address to, uint256 amount) external {
    require(admins[msg.sender], "Only admins can mint");
    require(mintedCount + amount <= MAX_SUPPLY, "Amount exceeds max cap or max cap reached!");
    require(rewardCount <= MAX_SUPPLY*4/10, "Amount exceeds 40% rewards pool!");
    rewardCount = rewardCount + amount;
    mintedCount = mintedCount + amount;
    _mint(to, amount);
    //create 0.5 tokens for reserve
  }

  function donate(address to, uint256 amount) external {
    require(admins[msg.sender], "Only admins can mint");
    require(mintedCount + amount <= MAX_SUPPLY, "Amount exceeds max cap or max cap reached!");
    donationCount = donationCount + amount;
    rewardCount = rewardCount + amount;
    mintedCount = mintedCount + amount;
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external override {
    require(admins[msg.sender], "Only admins can burn");
    _burn(from, amount);
  }

  function withdrawReserve(uint256 amount) external onlyOwner {
    require(amount <= balanceOf(address(this)), "amount exceeds balance");
    transfer(_msgSender(), amount);
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override(ERC20, IOxygen) returns (bool) {
    if (admins[_msgSender()]) {
      _transfer(sender, recipient, amount);
      return true;
    }
    return super.transferFrom(sender, recipient, amount);
  }
}
