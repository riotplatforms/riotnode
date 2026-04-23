import SignClient from "@walletconnect/sign-client";

let client: any;

export const initWC = async () => {
    if (client) return client;
    client = await SignClient.init({
        projectId: "ec457184730a7f1e24bbe58a393f442b",
        metadata: {
            name: "AI MINING BTC",
            description: "Staking",
            url: window.location.origin,
            icons: []
        }
    });

    return client;
};

export const createSession = async () => {
    if (!client) await initWC();
    
    const { uri, approval } = await client.connect({
        requiredNamespaces: {
            eip155: {
                methods: ["eth_sendTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
                chains: ["eip155:56"],
                events: ["accountsChanged", "chainChanged"]
            }
        }
    });

    return { uri, approval };
};
