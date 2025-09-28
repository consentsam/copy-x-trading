// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAavePool
 * @dev A mock implementation of AAVE Pool contract for testing purposes
 * This contract simulates the basic functions of AAVE's Pool contract
 */
contract MockAavePool {
    // Events
    event Supply(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 indexed referralCode
    );

    event Withdraw(
        address indexed reserve,
        address indexed user,
        address indexed to,
        uint256 amount
    );

    event Borrow(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint8 interestRateMode,
        uint256 borrowRate,
        uint16 indexed referralCode
    );

    event Repay(
        address indexed reserve,
        address indexed repayer,
        address indexed user,
        uint256 amount,
        bool useATokens
    );

    // Mapping to track user balances for testing
    mapping(address => mapping(address => uint256)) public userDeposits; // user => asset => amount
    mapping(address => mapping(address => uint256)) public userBorrows;  // user => asset => amount

    /**
     * @notice Supplies an amount of underlying asset into the reserve
     * @param asset The address of the underlying asset to supply
     * @param amount The amount to be supplied
     * @param onBehalfOf The address that will receive the aTokens
     * @param referralCode Code used to register the integrator
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        require(asset != address(0), "Invalid asset address");
        require(amount > 0, "Amount must be greater than 0");
        require(onBehalfOf != address(0), "Invalid onBehalfOf address");

        // Update user deposits
        userDeposits[onBehalfOf][asset] += amount;

        // Emit event
        emit Supply(asset, msg.sender, onBehalfOf, amount, referralCode);
    }

    /**
     * @notice Withdraws an amount of underlying asset from the reserve
     * @param asset The address of the underlying asset to withdraw
     * @param amount The amount to be withdrawn
     * @param to The address that will receive the underlying
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(asset != address(0), "Invalid asset address");
        require(amount > 0, "Amount must be greater than 0");
        require(to != address(0), "Invalid to address");
        require(userDeposits[msg.sender][asset] >= amount, "Insufficient balance");

        // Update user deposits
        userDeposits[msg.sender][asset] -= amount;

        // Emit event
        emit Withdraw(asset, msg.sender, to, amount);

        return amount;
    }

    /**
     * @notice Allows users to borrow an amount of underlying asset
     * @param asset The address of the underlying asset to borrow
     * @param amount The amount to be borrowed
     * @param interestRateMode The interest rate mode (1 for Stable, 2 for Variable)
     * @param referralCode The code used to register the integrator
     * @param onBehalfOf The address that will receive the debt
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external {
        require(asset != address(0), "Invalid asset address");
        require(amount > 0, "Amount must be greater than 0");
        require(onBehalfOf != address(0), "Invalid onBehalfOf address");
        require(interestRateMode == 1 || interestRateMode == 2, "Invalid interest rate mode");

        // Update user borrows
        userBorrows[onBehalfOf][asset] += amount;

        // Emit event (using mock borrow rate)
        emit Borrow(asset, msg.sender, onBehalfOf, amount, uint8(interestRateMode), 1000, referralCode);
    }

    /**
     * @notice Repays a borrowed amount on a specific reserve
     * @param asset The address of the borrowed underlying asset
     * @param amount The amount to repay (use type(uint256).max for entire debt)
     * @param interestRateMode The interest rate mode (1 for Stable, 2 for Variable)
     * @param onBehalfOf The address of the user who will get their debt reduced
     * @return The final amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256) {
        require(asset != address(0), "Invalid asset address");
        require(onBehalfOf != address(0), "Invalid onBehalfOf address");

        uint256 debt = userBorrows[onBehalfOf][asset];
        uint256 repayAmount = amount == type(uint256).max ? debt : amount;

        require(repayAmount <= debt, "Repay amount exceeds debt");

        // Update user borrows
        userBorrows[onBehalfOf][asset] -= repayAmount;

        // Emit event
        emit Repay(asset, msg.sender, onBehalfOf, repayAmount, false);

        return repayAmount;
    }

    /**
     * @notice Returns the user account data
     * @param user The address of the user
     * @return totalCollateralBase The total collateral of the user
     * @return totalDebtBase The total debt of the user
     * @return availableBorrowsBase The borrowing power left
     * @return currentLiquidationThreshold The liquidation threshold
     * @return ltv The loan to value
     * @return healthFactor The current health factor
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        // Return mock values for testing
        return (
            1000 * 10**18,  // 1000 USD collateral
            100 * 10**18,   // 100 USD debt
            900 * 10**18,   // 900 USD available to borrow
            8500,           // 85% liquidation threshold
            8000,           // 80% LTV
            10 * 10**18     // Health factor of 10
        );
    }

    /**
     * @notice Get user deposit balance for a specific asset
     * @param user The user address
     * @param asset The asset address
     * @return The deposit balance
     */
    function getUserDepositBalance(address user, address asset) external view returns (uint256) {
        return userDeposits[user][asset];
    }

    /**
     * @notice Get user borrow balance for a specific asset
     * @param user The user address
     * @param asset The asset address
     * @return The borrow balance
     */
    function getUserBorrowBalance(address user, address asset) external view returns (uint256) {
        return userBorrows[user][asset];
    }
}