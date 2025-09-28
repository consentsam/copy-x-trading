// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockAavePool.sol";

contract DeployMockAave is Script {
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockAavePool mockAavePool = new MockAavePool();

        console.log("MockAavePool deployed to:", address(mockAavePool));

        vm.stopBroadcast();

        return address(mockAavePool);
    }
}