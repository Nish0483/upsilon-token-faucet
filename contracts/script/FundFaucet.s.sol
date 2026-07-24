// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @notice Fund an already-deployed faucet. Approve this script's deployer first, or transfer directly.
/// @dev Env: FAUCET, UPS_TOKEN (optional), FUND_AMOUNT, PRIVATE_KEY
contract FundFaucet is Script {
    address constant DEFAULT_UPS = 0x57bfdA49355F95799399Deb4ff79aAB8d1971914;

    function run() external {
        address faucet = vm.envAddress("FAUCET");
        address token = vm.envOr("UPS_TOKEN", DEFAULT_UPS);
        uint256 fundAmount = vm.envUint("FUND_AMOUNT");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        require(IERC20(token).transfer(faucet, fundAmount), "transfer failed");
        vm.stopBroadcast();

        console2.log("Funded faucet", faucet);
        console2.log("Amount", fundAmount);
        console2.log("Balance", IERC20(token).balanceOf(faucet));
    }
}
