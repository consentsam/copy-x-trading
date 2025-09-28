// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FHEAddressEncryption.sol";
import "../src/AlphaEngineSubscription.sol";

contract DeployAlphaEngine is Script {
    // Deployment configuration
    uint256 constant INITIAL_SUBSCRIPTION_FEE = 0.01 ether;
    uint256 constant INITIAL_PERFORMANCE_FEE = 500; // 5%

    function run() public returns (address) {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying AlphaEngine contracts...");
        console.log("Deployer:", msg.sender);
        console.log("Chain ID:", block.chainid);

        // Deploy AlphaEngineSubscription contract
        console.log("\nDeploying AlphaEngineSubscription contract...");
        AlphaEngineSubscription alphaEngine = new AlphaEngineSubscription();
        console.log("AlphaEngineSubscription deployed to:", address(alphaEngine));

        // Skip auto-registration for testing purposes
        // We want to test the registration flow from the frontend
        console.log("\nSkipping auto-registration for testing...");

        // Stop broadcasting
        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("       DEPLOYMENT SUCCESSFUL");
        console.log("========================================");
        console.log("Main Contract:", address(alphaEngine));
        console.log("Block:", block.number);
        console.log("========================================\n");

        return address(alphaEngine);
    }

    // Function to verify contracts on block explorer
    function verify() public {
        address alphaEngine = vm.envAddress("ALPHA_ENGINE_ADDRESS");

        console.log("Verifying contracts on block explorer...");

        // Verify main contract
        string[] memory contractArgs = new string[](8);
        contractArgs[0] = "forge";
        contractArgs[1] = "verify-contract";
        contractArgs[2] = "--chain-id";
        contractArgs[3] = vm.toString(block.chainid);
        contractArgs[4] = "--compiler-version";
        contractArgs[5] = "0.8.20";
        contractArgs[6] = vm.toString(alphaEngine);
        contractArgs[7] = "AlphaEngineSubscription";

        vm.ffi(contractArgs);
        console.log("AlphaEngineSubscription verified");
    }
}