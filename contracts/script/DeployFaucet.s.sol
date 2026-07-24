// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Faucet} from "../src/Faucet.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @notice Deploy UPX Faucet (operator-drip pattern).
/// @dev Env: PRIVATE_KEY, OPERATOR (optional, defaults to deployer), UPS_TOKEN, DRIP_AMOUNT, COOLDOWN, FUND_AMOUNT
contract DeployFaucet is Script {
    address constant DEFAULT_UPS = 0x57bfdA49355F95799399Deb4ff79aAB8d1971914;

    function run() external {
        address token = vm.envOr("UPS_TOKEN", DEFAULT_UPS);
        uint256 dripAmount = vm.envOr("DRIP_AMOUNT", uint256(100 ether));
        uint256 cooldown = vm.envOr("COOLDOWN", uint256(1 days));
        uint256 fundAmount = vm.envOr("FUND_AMOUNT", uint256(0));

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.envOr("OPERATOR", deployer);

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer (owner)", deployer);
        console2.log("Operator", operator);
        console2.log("UPX token", token);
        console2.log("Drip", dripAmount);
        console2.log("Cooldown", cooldown);

        vm.startBroadcast(deployerKey);

        Faucet faucet = new Faucet(token, operator, dripAmount, cooldown);
        console2.log("Faucet", address(faucet));

        if (fundAmount > 0) {
            require(IERC20(token).transfer(address(faucet), fundAmount), "fund transfer failed");
            console2.log("Funded", fundAmount);
        }

        vm.stopBroadcast();
    }
}
