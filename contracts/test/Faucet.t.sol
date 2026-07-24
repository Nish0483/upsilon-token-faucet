// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Faucet} from "../src/Faucet.sol";
import {MockUPS} from "../src/mocks/MockUPS.sol";

contract FaucetTest is Test {
    Faucet internal faucet;
    MockUPS internal ups;

    address internal operator = makeAddr("operator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant DRIP = 100 ether;
    uint256 internal constant COOLDOWN = 1 days;
    uint256 internal constant FUND = 10_000 ether;

    function setUp() public {
        ups = new MockUPS(FUND);
        faucet = new Faucet(address(ups), operator, DRIP, COOLDOWN);
        require(ups.transfer(address(faucet), FUND), "fund");
    }

    function test_drip_success() public {
        vm.prank(operator);
        faucet.drip(alice);
        assertEq(ups.balanceOf(alice), DRIP);
        assertFalse(faucet.canClaim(alice));
    }

    function test_drip_reverts_during_cooldown() public {
        vm.prank(operator);
        faucet.drip(alice);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Faucet.CooldownActive.selector, COOLDOWN));
        faucet.drip(alice);
    }

    function test_drip_after_cooldown() public {
        vm.prank(operator);
        faucet.drip(alice);

        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(operator);
        faucet.drip(alice);
        assertEq(ups.balanceOf(alice), DRIP * 2);
    }

    function test_only_operator_can_drip() public {
        vm.prank(stranger);
        vm.expectRevert(Faucet.NotOperator.selector);
        faucet.drip(alice);

        vm.prank(alice);
        vm.expectRevert(Faucet.NotOperator.selector);
        faucet.drip(alice);
    }

    function test_operator_cannot_withdraw() public {
        vm.prank(operator);
        vm.expectRevert(Faucet.NotOwner.selector);
        faucet.withdraw(operator, DRIP);
    }

    function test_owner_can_withdraw() public {
        uint256 beforeBal = ups.balanceOf(address(this));
        faucet.withdraw(address(this), DRIP);
        assertEq(ups.balanceOf(address(this)), beforeBal + DRIP);
    }

    function test_independent_users() public {
        vm.startPrank(operator);
        faucet.drip(alice);
        faucet.drip(bob);
        vm.stopPrank();
        assertEq(ups.balanceOf(alice), DRIP);
        assertEq(ups.balanceOf(bob), DRIP);
    }

    function test_insufficient_balance() public {
        faucet.withdraw(address(this), FUND);
        vm.prank(operator);
        vm.expectRevert(Faucet.InsufficientFaucetBalance.selector);
        faucet.drip(alice);
    }

    function test_rejects_zero_recipient() public {
        vm.prank(operator);
        vm.expectRevert(Faucet.ZeroAddress.selector);
        faucet.drip(address(0));
    }

    function test_set_operator() public {
        address nextOp = makeAddr("nextOp");
        faucet.setOperator(nextOp);

        vm.prank(operator);
        vm.expectRevert(Faucet.NotOperator.selector);
        faucet.drip(alice);

        vm.prank(nextOp);
        faucet.drip(alice);
        assertEq(ups.balanceOf(alice), DRIP);
    }

    function test_token_and_operator() public view {
        assertEq(address(faucet.token()), address(ups));
        assertEq(faucet.operator(), operator);
        assertEq(faucet.owner(), address(this));
    }
}
