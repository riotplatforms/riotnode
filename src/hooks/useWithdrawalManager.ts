import { Contract, parseUnits, formatUnits, JsonRpcProvider, BrowserProvider } from 'ethers';
import { useWallet } from '../lib/web3';
import { CONTRACT_ABI as WITHDRAWAL_MANAGER_ABI } from '../lib/abi';

const WITHDRAWAL_MANAGER_ADDRESS = '0x504E877770923E8EbF8C02c2266D4D6f7ad45429'; 

const BSC_RPC = 'https://bsc-rpc.publicnode.com';

export function useWithdrawalManager() {
    const { signer, walletProvider } = useWallet();

    const getContract = async (withSigner = false) => {
        if (withSigner) {
            if (signer) return new Contract(WITHDRAWAL_MANAGER_ADDRESS, WITHDRAWAL_MANAGER_ABI, signer);
            if (walletProvider) {
                const browserProvider = new BrowserProvider(walletProvider as any);
                const s = await browserProvider.getSigner();
                return new Contract(WITHDRAWAL_MANAGER_ADDRESS, WITHDRAWAL_MANAGER_ABI, s);
            }
            if ((window as any).ethereum) {
                const browserProvider = new BrowserProvider((window as any).ethereum);
                const s = await browserProvider.getSigner();
                return new Contract(WITHDRAWAL_MANAGER_ADDRESS, WITHDRAWAL_MANAGER_ABI, s);
            }
            throw new Error("Wallet connection not ready. Please ensure your wallet is connected and try again.");
        }
        const readOnlyProvider = new JsonRpcProvider(BSC_RPC);
        return new Contract(WITHDRAWAL_MANAGER_ADDRESS, WITHDRAWAL_MANAGER_ABI, readOnlyProvider);
    };

    const requestReferralWithdrawal = async () => {
        if (!signer) throw new Error("Wallet not fully connected. Please reconnect.");
        const contract = await getContract(true);
        const tx = await contract.requestReferralWithdrawal();
        return await tx.wait();
    };

    const requestStakingRewardWithdrawal = async (amount: string) => {
        if (!signer) throw new Error("Wallet not fully connected. Please reconnect.");
        const contract = await getContract(true);
        const val = parseUnits(amount, 18);
        const tx = await contract.requestStakingRewardWithdrawal(val);
        return await tx.wait();
    };

    const approveWithdrawal = async (requestId: number) => {
        if (!signer) throw new Error("Wallet not fully connected. Please reconnect.");
        const contract = await getContract(true);
        const tx = await contract.approveWithdrawal(requestId);
        return await tx.wait();
    };

    const processWithdrawal = async (requestId: number) => {
        if (!signer) throw new Error("Wallet not fully connected. Please reconnect.");
        const contract = await getContract(true);
        const tx = await contract.processWithdrawal(requestId);
        return await tx.wait();
    };

    const getPendingRequestsCount = async () => {
        const contract = await getContract();
        const count = await contract.getPendingRequestsCount();
        return Number(count);
    };

    const getUserRequests = async (userAddress: string) => {
        const contract = await getContract();
        const requests = await contract.getUserRequests(userAddress);
        return requests.map((id: any) => Number(id));
    };

    const getWithdrawalRequest = async (requestId: number) => {
        const contract = await getContract();
        const request = await contract.withdrawalRequests(requestId);
        return {
            user: request.user,
            amount: formatUnits(request.amount, 18),
            requestTime: Number(request.requestTime),
            approved: request.approved,
            processed: request.processed,
            withdrawalType: request.withdrawalType
        };
    };

    const hasCompletedStakingCycle = async (userAddress: string) => {
        const contract = await getContract();
        return await contract.hasCompletedStakingCycle(userAddress);
    };

    const getMatureStakingRewards = async (userAddress: string) => {
        const contract = await getContract();
        const rewards = await contract.getMatureStakingRewards(userAddress);
        return formatUnits(rewards, 18);
    };

    const getTotalStakingRewardsWithdrawn = async (userAddress: string) => {
        const contract = await getContract();
        const withdrawn = await contract.totalStakingRewardsWithdrawn(userAddress);
        return formatUnits(withdrawn, 18);
    };

    const getTotalReferralRewardsWithdrawn = async (userAddress: string) => {
        const contract = await getContract();
        const withdrawn = await contract.totalReferralRewardsWithdrawn(userAddress);
        return formatUnits(withdrawn, 18);
    };

    return {
        requestReferralWithdrawal,
        requestStakingRewardWithdrawal,
        approveWithdrawal,
        processWithdrawal,
        getPendingRequestsCount,
        getUserRequests,
        getWithdrawalRequest,
        hasCompletedStakingCycle,
        getMatureStakingRewards,
        getTotalStakingRewardsWithdrawn,
        getTotalReferralRewardsWithdrawn
    };
}