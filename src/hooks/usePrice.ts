import { useState, useEffect } from 'react';

const BINANCE_BTC_USDT_API = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';
const DEFAULT_BTC_PRICE = 65000;

export function usePrice() {
    const [btcPrice, setBtcPrice] = useState<number>(() => {
        const cached = localStorage.getItem('btc_price');
        if (cached) {
            const parsed = parseFloat(cached);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return DEFAULT_BTC_PRICE;
    });

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const response = await fetch(BINANCE_BTC_USDT_API);
                const data = await response.json();
                const price = parseFloat(data.price);
                if (!isNaN(price) && price > 0) {
                    setBtcPrice(price);
                    localStorage.setItem('btc_price', price.toString());
                }
            } catch (err) {
                console.error("Price fetch error:", err);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 60000); // Refresh every 60 seconds
        return () => clearInterval(interval);
    }, []);

    return { btcPrice };
}
