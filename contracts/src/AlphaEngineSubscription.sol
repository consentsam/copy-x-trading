// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/contracts/FHE.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./FHEAddressEncryption.sol";

/**
 * @title AlphaEngineSubscription
 * @dev Manages encrypted subscriptions between AlphaConsumers and AlphaGenerators
 * @notice This contract uses FHE to protect subscriber privacy while enabling verification
 */
contract AlphaEngineSubscription is Ownable, ReentrancyGuard, Pausable {
    using FHE for *;
    using FHEAddressEncryption for *;

    // ============ State Variables ============

    struct Generator {
        address generatorAddress;
        uint256 subscriptionFee;
        uint256 performanceFee; // Percentage in basis points (100 = 1%)
        bool isActive;
        uint256 totalSubscribers;
        uint256 totalVolume;
        uint256 registeredAt;
    }

    struct EncryptedSubscription {
        eaddress encryptedConsumerAddress; // FHE encrypted address
        euint256 subscribedAt; // FHE encrypted timestamp
        ebool isActive; // FHE encrypted active status
        euint256 subscriptionFee; // FHE encrypted fee paid
    }

    struct TradeExecution {
        bytes32 tradeId;
        address generator;
        bytes executionData; // Encrypted trade parameters
        uint256 gasEstimate;
        uint256 expiryTime;
        bool executed;
        uint256 createdAt;
    }

    // Mappings
    mapping(address => Generator) public generators;
    mapping(address => EncryptedSubscription[]) private generatorSubscriptions;
    mapping(address => mapping(eaddress => ebool)) private generatorToConsumerActive;
    mapping(bytes32 => TradeExecution) public trades;
    mapping(address => bytes32[]) private generatorTrades;

    // Configuration
    uint256 public constant MAX_PERFORMANCE_FEE = 3000; // 30%
    uint256 public constant MIN_SUBSCRIPTION_FEE = 0.001 ether;
    uint256 public constant MAX_TRADE_EXPIRY = 1440; // 24 hours in minutes

    // Events
    event GeneratorRegistered(
        address indexed generator,
        uint256 subscriptionFee,
        uint256 performanceFee
    );

    event SubscriptionCreated(
        address indexed generator,
        eaddress encryptedSubscriber,  // FHE encrypted address type
        uint256 timestamp
    );

    event TradeProposed(
        bytes32 indexed tradeId,
        address indexed generator,
        uint256 expiryTime,
        uint256 gasEstimate
    );

    event TradeExecuted(
        bytes32 indexed tradeId,
        address indexed executor,
        bool success
    );

    event SubscriptionCancelled(
        address indexed generator,
        eaddress encryptedSubscriber,  // FHE encrypted address type
        uint256 timestamp
    );

    event GeneratorUpdated(
        address indexed generator,
        uint256 newSubscriptionFee,
        uint256 newPerformanceFee
    );

    event GeneratorUnregistered(
        address indexed generator,
        uint256 timestamp
    );

    // ============ Modifiers ============

    modifier onlyGenerator() {
        require(generators[msg.sender].isActive, "Not an active generator");
        _;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address");
        _;
    }

    modifier validFee(uint256 _fee) {
        require(_fee >= MIN_SUBSCRIPTION_FEE, "Fee too low");
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // Constructor can be extended with initial parameters if needed
    }

    // ============ Core Functions ============

    /**
     * @dev Register as an AlphaGenerator
     * @param _subscriptionFee Fee in wei for subscriptions
     * @param _performanceFee Performance fee in basis points
     */
    function registerGenerator(
        uint256 _subscriptionFee,
        uint256 _performanceFee
    ) external validAddress(msg.sender) validFee(_subscriptionFee) {
        require(_performanceFee <= MAX_PERFORMANCE_FEE, "Performance fee too high");
        require(!generators[msg.sender].isActive, "Already registered");

        generators[msg.sender] = Generator({
            generatorAddress: msg.sender,
            subscriptionFee: _subscriptionFee,
            performanceFee: _performanceFee,
            isActive: true,
            totalSubscribers: 0,
            totalVolume: 0,
            registeredAt: block.timestamp
        });

        emit GeneratorRegistered(msg.sender, _subscriptionFee, _performanceFee);
    }

    /**
     * @dev Update generator fees
     * @param _subscriptionFee New subscription fee
     * @param _performanceFee New performance fee
     */
    function updateGeneratorFees(
        uint256 _subscriptionFee,
        uint256 _performanceFee
    ) external onlyGenerator validFee(_subscriptionFee) {
        require(_performanceFee <= MAX_PERFORMANCE_FEE, "Performance fee too high");

        Generator storage gen = generators[msg.sender];
        gen.subscriptionFee = _subscriptionFee;
        gen.performanceFee = _performanceFee;

        emit GeneratorUpdated(msg.sender, _subscriptionFee, _performanceFee);
    }

    /**
     * @dev Unregister as an AlphaGenerator
     * @notice This will deactivate the generator but keep the record for historical purposes
     */
    function unregisterGenerator() external onlyGenerator {
        Generator storage gen = generators[msg.sender];
        require(gen.isActive, "Generator already inactive");

        // Deactivate the generator
        gen.isActive = false;

        emit GeneratorUnregistered(msg.sender, block.timestamp);
    }

    /**
     * @dev Subscribe to an AlphaGenerator with encrypted address
     * @param _generator The generator to subscribe to
     * @param _encryptedAddress FHE encrypted consumer address
     */
    function subscribe(
        address _generator,
        eaddress _encryptedAddress
    ) external payable nonReentrant whenNotPaused {
        Generator storage gen = generators[_generator];
        require(gen.isActive, "Generator not active");
        require(msg.value >= gen.subscriptionFee, "Insufficient payment");

        // Check if already subscribed using the nested mapping
        ebool isAlreadySubscribed = generatorToConsumerActive[_generator][_encryptedAddress];
        require(!FHE.decrypt(isAlreadySubscribed), "Already subscribed");

        // Create encrypted subscription
        EncryptedSubscription memory newSub = EncryptedSubscription({
            encryptedConsumerAddress: _encryptedAddress,
            subscribedAt: FHE.asEuint256(block.timestamp),
            isActive: FHE.asEbool(true),
            subscriptionFee: FHE.asEuint256(msg.value)
        });

        // Store subscription
        generatorSubscriptions[_generator].push(newSub);
        generatorToConsumerActive[_generator][_encryptedAddress] = FHE.asEbool(true);

        // Update generator stats
        gen.totalSubscribers++;
        gen.totalVolume += msg.value;

        // Transfer fee to generator
        (bool success, ) = payable(_generator).call{value: msg.value}("");
        require(success, "Transfer failed");

        emit SubscriptionCreated(_generator, _encryptedAddress, block.timestamp);
    }

    /**
     * @dev Unsubscribe from an AlphaGenerator
     * @param _generator The generator to unsubscribe from
     * @param _encryptedAddress Encrypted address of the subscriber
     */
    function unsubscribe(
        address _generator,
        eaddress _encryptedAddress
    ) external whenNotPaused {
        // Verify the caller is subscribed
        ebool subscribedStatus = generatorToConsumerActive[_generator][_encryptedAddress];
        require(FHE.decrypt(subscribedStatus), "Not subscribed");

        // Mark as inactive
        generatorToConsumerActive[_generator][_encryptedAddress] = FHE.asEbool(false);

        // Update subscription status in array
        EncryptedSubscription[] storage subs = generatorSubscriptions[_generator];
        for (uint256 i = 0; i < subs.length; i++) {
            ebool isMatch = FHE.eq(subs[i].encryptedConsumerAddress, _encryptedAddress);
            if (FHE.decrypt(isMatch)) {
                subs[i].isActive = FHE.asEbool(false);
                break;
            }
        }

        // Update generator stats
        generators[_generator].totalSubscribers--;

        emit SubscriptionCancelled(_generator, _encryptedAddress, block.timestamp);
    }

    /**
     * @dev Get encrypted subscribers for a generator (public function)
     * @param _generator Generator address
     * @return Array of encrypted addresses
     */
    function getEncryptedSubscribers(
        address _generator
    ) external view returns (eaddress[] memory) {
        EncryptedSubscription[] memory subs = generatorSubscriptions[_generator];

        // Count active subscriptions
        uint256 activeCount = 0;
        for (uint256 i = 0; i < subs.length; i++) {
            if (FHE.decrypt(subs[i].isActive)) {
                activeCount++;
            }
        }

        // Create array of active encrypted addresses
        eaddress[] memory activeAddresses = new eaddress[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < subs.length; i++) {
            if (FHE.decrypt(subs[i].isActive)) {
                activeAddresses[currentIndex++] = subs[i].encryptedConsumerAddress;
            }
        }

        return activeAddresses;
    }

    /**
     * @dev Check if an encrypted address is subscribed to a generator
     * @param _generator Generator address
     * @param _encryptedAddress Encrypted consumer address
     * @return Whether the address is actively subscribed
     */
    function isSubscribed(
        address _generator,
        eaddress _encryptedAddress
    ) external view returns (bool) {
        ebool subscriptionStatus = generatorToConsumerActive[_generator][_encryptedAddress];
        return FHE.decrypt(subscriptionStatus);
    }

    /**
     * @dev Propose a trade for execution by subscribers
     * @param _executionData Encrypted trade parameters
     * @param _gasEstimate Estimated gas for execution
     * @param _expiryMinutes Minutes until trade expires
     */
    function proposeTrade(
        bytes calldata _executionData,
        uint256 _gasEstimate,
        uint256 _expiryMinutes
    ) external onlyGenerator returns (bytes32) {
        require(_expiryMinutes > 0 && _expiryMinutes <= MAX_TRADE_EXPIRY, "Invalid expiry");
        require(_executionData.length > 0, "Empty execution data");
        require(_gasEstimate > 21000, "Gas estimate too low");

        bytes32 tradeId = keccak256(
            abi.encodePacked(msg.sender, _executionData, block.timestamp, block.number)
        );

        trades[tradeId] = TradeExecution({
            tradeId: tradeId,
            generator: msg.sender,
            executionData: _executionData,
            gasEstimate: _gasEstimate,
            expiryTime: block.timestamp + (_expiryMinutes * 60),
            executed: false,
            createdAt: block.timestamp
        });

        generatorTrades[msg.sender].push(tradeId);

        emit TradeProposed(tradeId, msg.sender, trades[tradeId].expiryTime, _gasEstimate);

        return tradeId;
    }

    /**
     * @dev Execute a proposed trade
     * @param _tradeId The trade to execute
     * @param _encryptedExecutor Encrypted address of executor
     */
    function executeTrade(
        bytes32 _tradeId,
        eaddress _encryptedExecutor
    ) external nonReentrant whenNotPaused {
        TradeExecution storage trade = trades[_tradeId];
        require(trade.generator != address(0), "Trade not found");
        require(!trade.executed, "Already executed");
        require(block.timestamp <= trade.expiryTime, "Trade expired");

        // Verify executor is subscribed
        ebool isExecutorSubscribed = generatorToConsumerActive[trade.generator][_encryptedExecutor];
        require(FHE.decrypt(isExecutorSubscribed), "Not subscribed to generator");

        trade.executed = true;

        // In production, this would integrate with DEX protocols
        // For now, we emit the event to signal successful validation
        bool success = true; // Placeholder for actual execution

        emit TradeExecuted(_tradeId, msg.sender, success);
    }

    /**
     * @dev Get generator's trade history
     * @param _generator Generator address
     * @return Array of trade IDs
     */
    function getGeneratorTrades(address _generator) external view returns (bytes32[] memory) {
        return generatorTrades[_generator];
    }

    /**
     * @dev Get subscription count for a generator
     * @param _generator Generator address
     * @return Number of active subscribers
     */
    function getSubscriberCount(address _generator) external view returns (uint256) {
        return generators[_generator].totalSubscribers;
    }

    // ============ Admin Functions ============

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Deactivate a generator (admin only)
     * @param _generator Generator to deactivate
     */
    function deactivateGenerator(address _generator) external onlyOwner {
        generators[_generator].isActive = false;
    }

    /**
     * @dev Emergency withdrawal (admin only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}

    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}