// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/contracts/FHE.sol";

/**
 * @title FHEAddressEncryption
 * @dev Helper library for address encryption operations using Fhenix FHE
 * @notice This library provides utilities for encrypting addresses and comparing encrypted values
 */
library FHEAddressEncryption {
    using FHE for *;

    /**
     * @dev Encrypt an address with generator-specific context
     * @param _address Address to encrypt
     * @param _generator Generator address (used as part of encryption context)
     * @return Encrypted address as eaddress type
     */
    function encryptAddress(
        address _address,
        address _generator
    ) internal pure returns (eaddress) {
        // Create unique encryption context based on generator
        // Note: In production, this would use Fhenix's actual encryption
        // For now, we use FHE.asEaddress which handles the encryption
        return FHE.asEaddress(_address);
    }

    /**
     * @dev Compare two encrypted addresses
     * @param _a First encrypted address
     * @param _b Second encrypted address
     * @return Encrypted boolean indicating equality
     */
    function compareEncrypted(
        eaddress _a,
        eaddress _b
    ) internal pure returns (ebool) {
        return FHE.eq(_a, _b);
    }

    /**
     * @dev Create an encrypted boolean value
     * @param _value Boolean value to encrypt
     * @return Encrypted boolean
     */
    function encryptBool(bool _value) internal pure returns (ebool) {
        return FHE.asEbool(_value);
    }

    /**
     * @dev Create an encrypted uint256 value
     * @param _value Uint256 value to encrypt
     * @return Encrypted uint256
     */
    function encryptUint256(uint256 _value) internal pure returns (euint256) {
        return FHE.asEuint256(_value);
    }

    /**
     * @dev Decrypt an encrypted boolean (only for authorized parties)
     * @param _value Encrypted boolean to decrypt
     * @return Decrypted boolean value
     */
    function decryptBool(ebool _value) internal pure returns (bool) {
        return FHE.decrypt(_value);
    }

    /**
     * @dev Check if an encrypted value is not equal to another
     * @param _a First encrypted address
     * @param _b Second encrypted address
     * @return Encrypted boolean indicating inequality
     */
    function notEqual(
        eaddress _a,
        eaddress _b
    ) internal pure returns (ebool) {
        return FHE.ne(_a, _b);
    }

    /**
     * @dev Perform AND operation on encrypted booleans
     * @param _a First encrypted boolean
     * @param _b Second encrypted boolean
     * @return Result of AND operation
     */
    function andOperation(
        ebool _a,
        ebool _b
    ) internal pure returns (ebool) {
        return FHE.and(_a, _b);
    }

    /**
     * @dev Perform OR operation on encrypted booleans
     * @param _a First encrypted boolean
     * @param _b Second encrypted boolean
     * @return Result of OR operation
     */
    function orOperation(
        ebool _a,
        ebool _b
    ) internal pure returns (ebool) {
        return FHE.or(_a, _b);
    }

    /**
     * @dev Perform NOT operation on encrypted boolean
     * @param _value Encrypted boolean
     * @return Result of NOT operation
     */
    function notOperation(ebool _value) internal pure returns (ebool) {
        return FHE.not(_value);
    }

    /**
     * @dev Create encrypted timestamp
     * @return Current block timestamp as encrypted uint256
     */
    function encryptedTimestamp() internal view returns (euint256) {
        return FHE.asEuint256(block.timestamp);
    }
}