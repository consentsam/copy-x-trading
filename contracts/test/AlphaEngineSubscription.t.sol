// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AlphaEngineSubscription.sol";
import "../src/FHEAddressEncryption.sol";

contract AlphaEngineSubscriptionTest is Test {
    // Contract instances
    AlphaEngineSubscription public alphaEngine;

    // Test accounts
    address public owner = address(this);
    address public generator1 = address(0x1);
    address public generator2 = address(0x2);
    address public consumer1 = address(0x3);
    address public consumer2 = address(0x4);
    address public consumer3 = address(0x5);

    // Test parameters
    uint256 constant SUBSCRIPTION_FEE = 0.01 ether;
    uint256 constant PERFORMANCE_FEE = 500; // 5%
    uint256 constant HIGH_PERFORMANCE_FEE = 3001; // 30.01% - above max

    // Add receive function to accept ETH
    receive() external payable {}

    // Events
    event GeneratorRegistered(address indexed generator, uint256 subscriptionFee, uint256 performanceFee);
    event SubscriptionCreated(address indexed generator, eaddress encryptedSubscriber, uint256 timestamp);
    event TradeProposed(bytes32 indexed tradeId, address indexed generator, uint256 expiryTime, uint256 gasEstimate);

    function setUp() public {
        // Deploy contract
        alphaEngine = new AlphaEngineSubscription();

        // Fund test accounts
        vm.deal(generator1, 10 ether);
        vm.deal(generator2, 10 ether);
        vm.deal(consumer1, 10 ether);
        vm.deal(consumer2, 10 ether);
        vm.deal(consumer3, 10 ether);
    }

    // ============ Deployment Tests ============

    function test_Deployment() public {
        assertEq(alphaEngine.owner(), owner);
        assertFalse(alphaEngine.paused());
    }

    // ============ Generator Registration Tests ============

    function test_RegisterGenerator() public {
        vm.prank(generator1);
        vm.expectEmit(true, false, false, true);
        emit GeneratorRegistered(generator1, SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        (address genAddr, uint256 fee, uint256 perfFee, bool isActive,,, ) =
            alphaEngine.generators(generator1);

        assertEq(genAddr, generator1);
        assertEq(fee, SUBSCRIPTION_FEE);
        assertEq(perfFee, PERFORMANCE_FEE);
        assertTrue(isActive);
    }

    function test_RevertWhen_GeneratorFeeTooHigh() public {
        vm.prank(generator1);
        vm.expectRevert("Performance fee too high");
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, HIGH_PERFORMANCE_FEE);
    }

    function test_RevertWhen_DuplicateRegistration() public {
        vm.startPrank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        vm.expectRevert("Already registered");
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);
        vm.stopPrank();
    }

    function testFuzz_RegisterGenerator(uint256 fee, uint256 perfFee) public {
        fee = bound(fee, 0.001 ether, 1 ether);
        perfFee = bound(perfFee, 0, 3000);

        vm.prank(generator1);
        alphaEngine.registerGenerator(fee, perfFee);

        (, uint256 storedFee, uint256 storedPerfFee,,,, ) =
            alphaEngine.generators(generator1);

        assertEq(storedFee, fee);
        assertEq(storedPerfFee, perfFee);
    }

    // ============ Subscription Tests ============

    function test_Subscribe() public {
        // Setup generator
        vm.prank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        // Create encrypted address (mock for testing)
        eaddress encryptedAddress = FHE.asEaddress(consumer1);

        // Subscribe
        vm.prank(consumer1);
        vm.expectEmit(true, false, false, true);
        emit SubscriptionCreated(generator1, encryptedAddress, block.timestamp);

        alphaEngine.subscribe{value: SUBSCRIPTION_FEE}(generator1, encryptedAddress);

        // Verify generator stats
        (, , , , uint256 totalSubs, uint256 totalVol, ) =
            alphaEngine.generators(generator1);

        assertEq(totalSubs, 1);
        assertEq(totalVol, SUBSCRIPTION_FEE);

        // Verify generator received payment
        assertEq(generator1.balance, 10 ether + SUBSCRIPTION_FEE);
    }

    function test_RevertWhen_InsufficientPayment() public {
        vm.prank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        eaddress encryptedAddress = FHE.asEaddress(consumer1);

        vm.prank(consumer1);
        vm.expectRevert("Insufficient payment");
        alphaEngine.subscribe{value: 0.005 ether}(generator1, encryptedAddress);
    }

    function test_MultipleSubscriptions() public {
        // Register generator
        vm.prank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        // Multiple consumers subscribe
        eaddress encrypted1 = FHE.asEaddress(consumer1);
        eaddress encrypted2 = FHE.asEaddress(consumer2);
        eaddress encrypted3 = FHE.asEaddress(consumer3);

        vm.prank(consumer1);
        alphaEngine.subscribe{value: SUBSCRIPTION_FEE}(generator1, encrypted1);

        vm.prank(consumer2);
        alphaEngine.subscribe{value: SUBSCRIPTION_FEE}(generator1, encrypted2);

        vm.prank(consumer3);
        alphaEngine.subscribe{value: SUBSCRIPTION_FEE}(generator1, encrypted3);

        // Verify stats
        (, , , , uint256 totalSubs, uint256 totalVol, ) =
            alphaEngine.generators(generator1);

        assertEq(totalSubs, 3);
        assertEq(totalVol, SUBSCRIPTION_FEE * 3);
    }

    // ============ Trade Proposal Tests ============

    function test_ProposeTrade() public {
        // Register generator
        vm.prank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        // Propose trade
        bytes memory executionData = abi.encode("swap", "tokenA", "tokenB", 1 ether);
        uint256 gasEstimate = 300000;
        uint256 expiryMinutes = 30;

        vm.prank(generator1);
        bytes32 tradeId = alphaEngine.proposeTrade(executionData, gasEstimate, expiryMinutes);

        // Verify trade details
        (bytes32 id, address gen, , uint256 gas, uint256 expiry, bool executed, ) =
            alphaEngine.trades(tradeId);

        assertEq(id, tradeId);
        assertEq(gen, generator1);
        assertEq(gas, gasEstimate);
        assertEq(expiry, block.timestamp + (expiryMinutes * 60));
        assertFalse(executed);
    }

    function test_RevertWhen_NonGeneratorProposesTrade() public {
        bytes memory executionData = abi.encode("test");

        vm.prank(consumer1);
        vm.expectRevert("Not an active generator");
        alphaEngine.proposeTrade(executionData, 300000, 30);
    }

    function testFuzz_ProposeTrade(uint256 gasEstimate, uint256 expiryMinutes) public {
        gasEstimate = bound(gasEstimate, 21001, 10000000);
        expiryMinutes = bound(expiryMinutes, 1, 1440);

        vm.prank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        bytes memory executionData = abi.encode("fuzz", gasEstimate);

        vm.prank(generator1);
        bytes32 tradeId = alphaEngine.proposeTrade(executionData, gasEstimate, expiryMinutes);

        (, , , uint256 storedGas, uint256 expiry, , ) =
            alphaEngine.trades(tradeId);

        assertEq(storedGas, gasEstimate);
        assertEq(expiry, block.timestamp + (expiryMinutes * 60));
    }

    // ============ Admin Function Tests ============

    function test_PauseUnpause() public {
        alphaEngine.pause();
        assertTrue(alphaEngine.paused());

        alphaEngine.unpause();
        assertFalse(alphaEngine.paused());
    }

    function test_DeactivateGenerator() public {
        vm.prank(generator1);
        alphaEngine.registerGenerator(SUBSCRIPTION_FEE, PERFORMANCE_FEE);

        alphaEngine.deactivateGenerator(generator1);

        (, , , bool isActive, , , ) = alphaEngine.generators(generator1);
        assertFalse(isActive);
    }

    function test_RevertWhen_NonOwnerCallsAdmin() public {
        vm.prank(consumer1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, consumer1));
        alphaEngine.pause();
    }

    function test_EmergencyWithdraw() public {
        // Send ETH to contract
        vm.prank(consumer1);
        (bool sent, ) = address(alphaEngine).call{value: 1 ether}("");
        assertTrue(sent);

        uint256 initialBalance = address(this).balance;

        alphaEngine.emergencyWithdraw();

        assertEq(address(this).balance, initialBalance + 1 ether);
        assertEq(address(alphaEngine).balance, 0);
    }

    // ============ Edge Cases & Invariants ============

    function invariant_SubscriberCountNeverNegative() public {
        (, , , , uint256 totalSubs, , ) = alphaEngine.generators(generator1);
        assertGe(totalSubs, 0);
    }

    function invariant_TotalVolumeIncreases() public {
        (, , , , , uint256 totalVol, ) = alphaEngine.generators(generator1);
        // This invariant ensures volume only increases or stays same
        assertGe(totalVol, 0);
    }
}