// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title Faucet
 * @notice Backend-operated drip faucet for UPX test tokens.
 *
 * Pattern A (Alchemy-style):
 *   1. Backend checks the user's IP (blocks VPN / proxy / datacenter).
 *   2. Backend EOA (operator) calls `drip(to)` and pays gas.
 *   3. Contract enforces cooldown + drip amount; tokens stay in the contract.
 *
 * Roles:
 *   - operator: can only call `drip` (cannot withdraw the vault).
 *   - owner (admin): withdraw, change drip/cooldown/operator.
 *
 * Deploy once per chain (Sepolia, Hoodi, BSC testnet). Same token address on all.
 */
contract Faucet {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotOperator();
    error ZeroAddress();
    error ZeroAmount();
    error CooldownActive(uint256 secondsRemaining);
    error InsufficientFaucetBalance();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Dripped(address indexed to, uint256 amount, uint256 nextClaimAt);
    event DripAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice UPX ERC-20 this faucet pays out.
    IERC20 public immutable token;

    /// @notice Admin who can withdraw tokens and change settings.
    address public owner;

    /// @notice Backend wallet authorized to call `drip` only.
    address public operator;

    /// @notice How many tokens (in wei) each successful drip pays.
    uint256 public dripAmount;

    /// @notice Seconds a recipient must wait between drips.
    uint256 public cooldown;

    /// @notice Last successful drip time per recipient.
    mapping(address => uint256) public lastClaimAt;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param token_       UPX token address
     * @param operator_    Backend EOA that may call drip
     * @param dripAmount_  Tokens per drip (wei)
     * @param cooldown_    Wait time between drips (seconds)
     */
    constructor(address token_, address operator_, uint256 dripAmount_, uint256 cooldown_) {
        if (token_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        if (dripAmount_ == 0 || cooldown_ == 0) revert ZeroAmount();

        token = IERC20(token_);
        operator = operator_;
        dripAmount = dripAmount_;
        cooldown = cooldown_;
        owner = msg.sender;

        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorUpdated(address(0), operator_);
    }

    // -------------------------------------------------------------------------
    // Drip (operator only)
    // -------------------------------------------------------------------------

    /**
     * @notice Send `dripAmount` tokens to `to`. Callable only by `operator`.
     * @param to  Recipient wallet
     */
    function drip(address to) external onlyOperator {
        if (to == address(0)) revert ZeroAddress();
        _requireCooldownPassed(to);
        _payOut(to);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Seconds until `user` may receive another drip (0 = ready).
    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 last = lastClaimAt[user];
        if (last == 0) return 0;

        uint256 unlockAt = last + cooldown;
        if (block.timestamp >= unlockAt) return 0;
        return unlockAt - block.timestamp;
    }

    /// @notice True if cooldown is clear (does not check faucet balance).
    function canClaim(address user) external view returns (bool) {
        uint256 last = lastClaimAt[user];
        if (last == 0) return true;
        return block.timestamp >= last + cooldown;
    }

    /// @notice Token balance held by this faucet.
    function faucetBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    // -------------------------------------------------------------------------
    // Owner actions
    // -------------------------------------------------------------------------

    function setDripAmount(uint256 newAmount) external onlyOwner {
        if (newAmount == 0) revert ZeroAmount();
        emit DripAmountUpdated(dripAmount, newAmount);
        dripAmount = newAmount;
    }

    function setCooldown(uint256 newCooldown) external onlyOwner {
        if (newCooldown == 0) revert ZeroAmount();
        emit CooldownUpdated(cooldown, newCooldown);
        cooldown = newCooldown;
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (token.balanceOf(address(this)) < amount) revert InsufficientFaucetBalance();
        if (!token.transfer(to, amount)) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _requireCooldownPassed(address user) internal view {
        uint256 last = lastClaimAt[user];
        if (last == 0) return;

        uint256 unlockAt = last + cooldown;
        if (block.timestamp < unlockAt) {
            revert CooldownActive(unlockAt - block.timestamp);
        }
    }

    /// @dev Records drip time and transfers `dripAmount` tokens to `user`.
    function _payOut(address user) internal {
        uint256 amount = dripAmount;
        if (token.balanceOf(address(this)) < amount) revert InsufficientFaucetBalance();

        lastClaimAt[user] = block.timestamp;

        if (!token.transfer(user, amount)) revert TransferFailed();

        emit Dripped(user, amount, block.timestamp + cooldown);
    }
}
