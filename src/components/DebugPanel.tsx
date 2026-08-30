import React, { useEffect, useRef, useState } from 'react';

type LogEntry = { t: string; level: string; msg: string };

// Install console capture ONCE at module load. All console.log/warn/error
// calls are mirrored into window.__aimLogs (ring buffer) so they can be
// viewed on-device inside the Telegram WebView (where devtools don't exist).
if (typeof window !== 'undefined' && !(window as any).__aimLogsInstalled) {
    (window as any).__aimLogsInstalled = true;
    (window as any).__aimLogs = [];
    const store = (level: string, args: any[]) => {
        try {
            const arr = (window as any).__aimLogs as LogEntry[];
            const msg = args.map(a => {
                if (typeof a === 'string') return a;
                try { return JSON.stringify(a); } catch { return String(a); }
            }).join(' ');
            arr.push({ t: new Date().toLocaleTimeString(), level, msg: msg.slice(0, 600) });
            if (arr.length > 400) arr.splice(0, arr.length - 400);
        } catch { /* ignore */ }
    };
    ['log', 'warn', 'error'].forEach(level => {
        const orig = (console as any)[level].bind(console);
        (console as any)[level] = (...args: any[]) => { store(level, args); orig(...args); };
    });
    (window as any).tmaLog = (msg: string) => store('log', [msg]);
}

// Snapshot of every wallet-related state the transaction pipeline depends on.
// Logged to console (captured) AND returned so it can be copied to the developer.
const captureWalletState = (): string => {
    const g = window as any;
    const L: string[] = [];
    const push = (s: string) => L.push(s);
    push('=== WALLET STATE CAPTURE ===');
    push(`time: ${new Date().toISOString()}`);
    push(`TMA: ${!!g.Telegram?.WebApp}`);
    push(`UA: ${navigator.userAgent.slice(0, 90)}`);
    push(`address(localStorage): ${localStorage.getItem('aimining_address')}`);
    push(`manual_address: ${localStorage.getItem('aimining_manual_address')}`);
    push(`wallet_type: ${localStorage.getItem('aimining_wallet_type')}`);
    push(`is_walletconnect: ${localStorage.getItem('aimining_is_walletconnect')}`);
    push(`window.ethereum: ${!!g.ethereum}`);
    const gp = g.__globalAppKitProvider;
    push(`__globalAppKitProvider: ${!!gp}`);
    if (gp) {
        push(`  connected: ${gp.connected}`);
        push(`  session: ${!!gp.session}`);
        const exp = Number(gp.session?.expiry || 0);
        if (exp) push(`  expiry: ${new Date(exp * 1000).toISOString()} ${exp * 1000 < Date.now() ? '(EXPIRED!)' : '(valid)'}`);
        push(`  accounts: ${JSON.stringify(gp.accounts || [])}`);
        const relayer = gp.signClient?.core?.relayer;
        push(`  relayer.connected: ${relayer?.connected}`);
        const peer = gp.session?.peer?.metadata?.name;
        if (peer) push(`  peer: ${peer}`);
    }
    push(`__manualWalletProvider: ${!!g.__manualWalletProvider}`);
    const text = L.join('\n');
    console.log(text);
    return text;
};

const btnStyle: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', color: '#4ade80', padding: '5px 9px', borderRadius: '5px', fontSize: 9, cursor: 'pointer' };

// Floating on-device log viewer — lets any user (no devtools needed) capture
// what actually happens when they click stake/withdraw inside Telegram.
export default function DebugPanel() {
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [tick, setTick] = useState(0);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!open) return;
        const refresh = () => setLogs([...(((window as any).__aimLogs || []) as LogEntry[])]);
        refresh();
        timerRef.current = setInterval(refresh, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [open, tick]);

    const copyAll = () => {
        const text = logs.map(l => `[${l.t}] ${l.level.toUpperCase()} ${l.msg}`).join('\n');
        (navigator as any).clipboard?.writeText(text)
            .then(() => alert('Logs copied! Paste them to the developer.'))
            .catch(() => { prompt('Copy logs:', text.slice(0, 2000)); });
    };

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-16 right-2 z-[99999] w-8 h-8 rounded-full bg-black/80 border border-white/25 text-[11px] flex items-center justify-center cursor-pointer active:scale-90"
                    title="Debug Logs"
                >
                    🐞
                </button>
            )}
            {open && (
                <div className="fixed inset-0 z-[100000] flex flex-col p-3" style={{ background: 'rgba(0,0,0,0.97)', fontFamily: 'monospace', fontSize: 9 }}>
                    <div className="flex gap-2 mb-2 flex-wrap">
                        <button onClick={() => { captureWalletState(); setTick(t => t + 1); }} style={btnStyle}>Capture State</button>
                        <button onClick={copyAll} style={btnStyle}>Copy Logs</button>
                        <button onClick={() => { (window as any).__aimLogs = []; setLogs([]); }} style={btnStyle}>Clear</button>
                        <button onClick={() => setOpen(false)} style={btnStyle}>Close</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2" style={{ background: '#000', border: '1px solid rgba(74,222,128,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {logs.length === 0 ? 'No logs yet. Tap stake/withdraw, then come back.' : logs.map((l, i) => (
                            <div key={i} style={{ color: l.level === 'error' ? '#ef4444' : l.level === 'warn' ? '#fbbf24' : '#4ade80' }}>
                                [{l.t}] {l.msg}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
