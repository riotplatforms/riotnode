// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AIMinerBTC Withdrawal Manager
 * @dev Admin-controlled withdrawal system for referral rewards and staking rewards
 * Only allows claiming accumulated rewards after staking cycle completion
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IAIMinerBTC {
    function getUserInfo(address _user) external view returns (
        address referrer,
        uint256 totalStaked,
        uint256 totalEarned,
        uint256 referralRewards,
        uint256 totalBonus,
        uint256 totalReferralEarned,
        uint256 teamSize,
        uint256 stakeCount
    );

    function getUserStake(address _user, uint256 _index) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 tier,
        bool withdrawn
    );
}

contract AIMinerBTCWithdrawalManager {
    IERC20 public usdt;
    IAIMinerBTC public stakingContract;

    mapping(address => bool) public admins;
    address public deployer;
    address public secondAdmin;

    uint256 public constant CYCLE_DAYS = 37;
    uint256 public constant MIN_STAKE_FOR_REFERRAL = 200 * 1e18;

    // Withdrawal request tracking
    struct WithdrawalRequest {
        address user;
        uint256 amount;
        uint256 requestTime;
        bool approved;
        bool processed;
        string withdrawalType; // "referral" or "staking"
    }

    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    uint256 public requestCount;

    event AdminChanged(address oldAdmin, address newAdmin);
    event WithdrawalRequested(uint256 indexed requestId, address indexed user, uint256 amount, string withdrawalType);
    event WithdrawalApproved(uint256 indexed requestId, address indexed user, uint256 amount);
    event WithdrawalProcessed(uint256 indexed requestId, address indexed user, uint256 amount);

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    constructor(address _usdt, address _stakingContract, address _secondAdmin) {
        usdt = IERC20(_usdt);
        stakingContract = IAIMinerBTC(_stakingContract);

        deployer = msg.sender;
        admins[msg.sender] = true;

        if (_secondAdmin != address(0)) {
            secondAdmin = _secondAdmin;
            admins[_secondAdmin] = true;
        }
    }

    /**
     * @dev Check if user has completed at least one 37-day staking cycle
     */
    function hasCompletedStakingCycle(address _user) public view returns (bool) {
        (, , , , , , , uint256 stakeCount) = stakingContract.getUserInfo(_user);

        for (uint256 i = 0; i < stakeCount; i++) {
            (uint256 amount, uint256 startTime, , bool withdrawn) = stakingContract.getUserStake(_user, i);

            // Check if stake has completed 37 days and was withdrawn
            if (withdrawn && block.timestamp >= startTime + (CYCLE_DAYS * 1 days)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Request withdrawal of referral rewards
     * Only users with 200+ USDT staked and completed cycle can request
     */
    function requestReferralWithdrawal() external {
        (, uint256 totalStaked, , uint256 referralRewards, , , , ) = stakingContract.getUserInfo(msg.sender);

        require(totalStaked >= MIN_STAKE_FOR_REFERRAL, "Minimum 200 USDT stake required");
        require(hasCompletedStakingCycle(msg.sender), "Must complete at least one 37-day staking cycle");
        require(referralRewards > 0, "No referral rewards available");

        requestCount++;
        withdrawalRequests[requestCount] = WithdrawalRequest({
            user: msg.sender,
            amount: referralRewards,
            requestTime: block.timestamp,
            approved: false,
            processed: false,
            withdrawalType: "referral"
        });

        emit WithdrawalRequested(requestCount, msg.sender, referralRewards, "referral");
    }

    /**
     * @dev Request withdrawal of staking rewards only (not principal)
     * Only users who have completed staking cycle can request
     */
    function requestStakingRewardWithdrawal(uint256 _amount) external {
        (, , uint256 totalEarned, , , , , ) = stakingContract.getUserInfo(msg.sender);

        require(hasCompletedStakingCycle(msg.sender), "Must complete at least one 37-day staking cycle");
        require(_amount > 0 && _amount <= totalEarned, "Invalid withdrawal amount");

        requestCount++;
        withdrawalRequests[requestCount] = WithdrawalRequest({
            user: msg.sender,
            amount: _amount,
            requestTime: block.timestamp,
            approved: false,
            processed: false,
            withdrawalType: "staking"
        });

        emit WithdrawalRequested(requestCount, msg.sender, _amount, "staking");
    }

    /**
     * @dev Admin approves withdrawal request
     */
    function approveWithdrawal(uint256 _requestId) external onlyAdmin {
        require(_requestId > 0 && _requestId <= requestCount, "Invalid request ID");
        require(!withdrawalRequests[_requestId].approved, "Already approved");
        require(!withdrawalRequests[_requestId].processed, "Already processed");

        withdrawalRequests[_requestId].approved = true;

        emit WithdrawalApproved(_requestId, withdrawalRequests[_requestId].user, withdrawalRequests[_requestId].amount);
    }

    /**
     * @dev Admin processes approved withdrawal (transfers funds)
     */
    function processWithdrawal(uint256 _requestId) external onlyAdmin {
        require(_requestId > 0 && _requestId <= requestCount, "Invalid request ID");
        require(withdrawalRequests[_requestId].approved, "Not approved");
        require(!withdrawalRequests[_requestId].processed, "Already processed");

        WithdrawalRequest storage request = withdrawalRequests[_requestId];
        require(usdt.balanceOf(address(this)) >= request.amount, "Insufficient contract balance");

        // Transfer funds to user
        require(usdt.transfer(request.user, request.amount), "Transfer failed");

        request.processed = true;

        emit WithdrawalProcessed(_requestId, request.user, request.amount);
    }

    /**
     * @dev Emergency withdrawal by admin (only for contract balance management)
     */
    function emergencyWithdraw(uint256 _amount, address _to) external onlyAdmin {
        require(usdt.balanceOf(address(this)) >= _amount, "Insufficient balance");
        require(usdt.transfer(_to, _amount), "Transfer failed");
    }

    /**
     * @dev Get pending withdrawal requests count
     */
    function getPendingRequestsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= requestCount; i++) {
            if (!withdrawalRequests[i].processed) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev Get user's withdrawal requests
     */
    function getUserRequests(address _user) external view returns (uint256[] memory) {
        uint256[] memory tempRequests = new uint256[](requestCount);
        uint256 count = 0;

        for (uint256 i = 1; i <= requestCount; i++) {
            if (withdrawalRequests[i].user == _user) {
                tempRequests[count] = i;
                count++;
            }
        }

        uint256[] memory userRequests = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            userRequests[i] = tempRequests[i];
        }

        return userRequests;
    }

    /**
     * @dev Update admin addresses
     */
    function updateAdmins(address _newAdmin, bool _status) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        admins[_newAdmin] = _status;

        if (_newAdmin == secondAdmin && !_status) {
            secondAdmin = address(0);
        } else if (secondAdmin == address(0) && _status) {
            secondAdmin = _newAdmin;
        }
    }
}