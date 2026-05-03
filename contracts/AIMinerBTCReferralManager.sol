// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AIMinerBTC Referral Manager (Standalone)
 * @dev Independent contract for managing referral commissions
 * Works without modifying the main AIMinerBTC contract
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AIMinerBTCReferralManager {
    address public owner;
    address public mainContract;
    IERC20 public usdt;

    bool public paused;

    // Referral structure
    struct ReferralData {
        address referrer;
        uint256 totalEarned;
        uint256 pendingCommissions;
        uint256 lastClaimTime;
    }

    mapping(address => ReferralData) public referralData;
    mapping(address => address[]) public directReferrals;

    // Settings
    uint256 public defaultReferralThreshold = 200 * 1e18; // 200 USDT
    uint256 public level1Rate = 5; // 5%
    uint256 public level2Rate = 3; // 3%
    uint256 public level3Rate = 2; // 2%
    uint256 public level4to6Rate = 1; // 1%
    uint256 public level7to10Rate = 1; // 1%

    uint256 public level4to6Threshold = 1000 * 1e18; // 1000 USDT
    uint256 public level7to10Threshold = 2000 * 1e18; // 2000 USDT

    // Events
    event ReferralRegistered(address indexed user, address indexed referrer);
    event CommissionDistributed(address indexed referrer, address indexed referee, uint256 amount, uint256 level);
    event CommissionClaimed(address indexed user, uint256 amount);
    event SettingsUpdated(string setting, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract paused");
        _;
    }

    constructor(address _mainContract, address _usdt) {
        owner = msg.sender;
        mainContract = _mainContract;
        usdt = IERC20(_usdt);
    }

    /**
     * @dev Register a user with their referrer (can be called by anyone)
     */
    function registerReferral(address _user, address _referrer) external notPaused {
        require(_user != address(0) && _referrer != address(0), "Invalid addresses");
        require(_user != _referrer, "Cannot refer yourself");
        require(referralData[_user].referrer == address(0), "Already registered");

        referralData[_user].referrer = _referrer;
        directReferrals[_referrer].push(_user);

        emit ReferralRegistered(_user, _referrer);
    }

    /**
     * @dev Admin function to distribute commissions manually
     * Called when someone withdraws from main contract
     */
    function distributeCommission(address _user, uint256 _rewardAmount) external onlyOwner notPaused {
        address upline = referralData[_user].referrer;
        require(upline != address(0), "No referrer registered");

        // Check if contract has enough USDT
        uint256 contractBalance = usdt.balanceOf(address(this));
        require(contractBalance > 0, "No funds in referral manager");

        uint256 totalCommission = 0;
        address currentUpline = upline;

        // Process up to 10 levels
        for (uint256 i = 1; i <= 10; i++) {
            if (currentUpline == address(0)) break;

            uint256 commission = 0;

            // Get upline stake from main contract (simplified - you'd need to call main contract)
            // For now, assume we pass this information or have a way to get it
            uint256 uplineStake = getUplineStake(currentUpline);

            if (i <= 3) {
                if (uplineStake >= defaultReferralThreshold) {
                    if (i == 1) commission = (_rewardAmount * level1Rate) / 100;
                    else if (i == 2) commission = (_rewardAmount * level2Rate) / 100;
                    else if (i == 3) commission = (_rewardAmount * level3Rate) / 100;
                }
            } else if (i <= 6) {
                if (uplineStake >= level4to6Threshold) {
                    commission = (_rewardAmount * level4to6Rate) / 100;
                }
            } else if (i <= 10) {
                if (uplineStake >= level7to10Threshold) {
                    commission = (_rewardAmount * level7to10Rate) / 100;
                }
            }

            if (commission > 0) {
                referralData[currentUpline].pendingCommissions += commission;
                referralData[currentUpline].totalEarned += commission;
                totalCommission += commission;

                emit CommissionDistributed(currentUpline, _user, commission, i);
            }

            currentUpline = referralData[currentUpline].referrer;
        }

        require(totalCommission <= contractBalance, "Insufficient funds for commissions");
    }

    /**
     * @dev Users can claim their pending commissions
     */
    function claimCommissions() external notPaused {
        uint256 amount = referralData[msg.sender].pendingCommissions;
        require(amount > 0, "No commissions to claim");
        require(usdt.balanceOf(address(this)) >= amount, "Insufficient contract balance");

        referralData[msg.sender].pendingCommissions = 0;
        referralData[msg.sender].lastClaimTime = block.timestamp;

        require(usdt.transfer(msg.sender, amount), "Transfer failed");

        emit CommissionClaimed(msg.sender, amount);
    }

    /**
     * @dev Get upline stake (simplified - in real implementation, call main contract)
     */
    function getUplineStake(address _user) internal view returns (uint256) {
        // This is a placeholder. In real implementation, you might:
        // 1. Have the admin pass this value when calling distributeCommission
        // 2. Call the main contract's getUserInfo function
        // 3. Store stake amounts in this contract

        // For now, return a default value
        return defaultReferralThreshold; // Assume minimum threshold met
    }

    /**
     * @dev Update settings
     */
    function updateSettings(
        uint256 _defaultThreshold,
        uint256 _l1Rate,
        uint256 _l2Rate,
        uint256 _l3Rate
    ) external onlyOwner {
        defaultReferralThreshold = _defaultThreshold;
        level1Rate = _l1Rate;
        level2Rate = _l2Rate;
        level3Rate = _l3Rate;

        emit SettingsUpdated("settings", block.timestamp);
    }

    /**
     * @dev Admin can deposit USDT for commissions
     */
    function depositFunds(uint256 _amount) external onlyOwner {
        require(usdt.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(usdt.transfer(owner, _amount), "Transfer failed");
    }

    /**
     * @dev Pause/unpause contract
     */
    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    /**
     * @dev View functions
     */
    function getReferralInfo(address _user) external view returns (
        address referrer,
        uint256 totalEarned,
        uint256 pendingCommissions,
        uint256 lastClaimTime,
        uint256 directReferralsCount
    ) {
        ReferralData memory data = referralData[_user];
        return (
            data.referrer,
            data.totalEarned,
            data.pendingCommissions,
            data.lastClaimTime,
            directReferrals[_user].length
        );
    }

    function getDirectReferrals(address _user) external view returns (address[] memory) {
        return directReferrals[_user];
    }
}