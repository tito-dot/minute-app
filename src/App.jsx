import React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
const COLORS = {
bg: "#F7F6F2", surface: "#FFFFFF", navy: "#1A2B45",
green: "#2D7A5F", amber: "#C97A28", border: "#DDD9D0",
textPrimary: "#1A2B45", textSecondary: "#6B7280", textMuted: "#9CA3AF",
recording: "#E53E3E", gdocs: "#1A73E8",
};
// ── Google OAuth ─────────────────────────────────────────────
const SCOPES = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";
function useGoogleAuth(clientId) {
const [accessToken, setAccessToken] = useState(null);
const [authError, setAuthError] = useState("");
const tokenClientRef = useRef(null);
useEffect(() => {
if (!clientId || !clientId.includes("googleusercontent")) return;
const script = document.createElement("script");
script.src = "https://accounts.google.com/gsi/client";
script.async = true;
script.onload = () => {
tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
client_id: clientId,
scope: SCOPES,
callback: (resp) => {
if (resp.error) setAuthError("Google認証に失敗しました: " + resp.error);
else { setAccessToken(resp.access_token); setAuthError(""); }
},
});
};
document.body.appendChild(script);
return () => { try { document.body.removeChild(script); } catch (_) {} };
}, [clientId]);
const signIn = () => {
if (!tokenClientRef.current) { setAuthError("クライアントIDを先に設定してください。"); return; }
tokenClientRef.current.requestAccessToken();
};
return { accessToken, signIn, signOut: () => setAccessToken(null), authError };
}
// ── Google Docsへ書き出し ────────────────────────────────────

async function exportToGoogleDocs(token, minutes, logs) {
const title = `議事録_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")}`;
const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
method: "POST",
headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
body: JSON.stringify({ title }),
});
const doc = await createRes.json();
if (!doc.documentId) throw new Error("ドキュメント作成に失敗");
const logText = logs.map((l) => `${l.time} ${l.text}`).join("\n");
const body = `作成日時: ${new Date().toLocaleString("ja-JP")}\n\n` +
`━━━━ 議事録 ━━━━\n\n${minutes}\n\n` +
`━━━━ 発言ログ ━━━━\n\n${logText}`;
await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
method: "POST",
headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: body } }] }),
});
return `https://docs.google.com/document/d/${doc.documentId}/edit`;
}
// ── 設定モーダル ─────────────────────────────────────────────
function SettingsModal({ clientId, onSave, onClose }) {
const [val, setVal] = useState(clientId);
return (
<div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
<div style={{ backgroundColor: "#fff", borderRadius: 14, padding: 32, width: 520, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
<h2 style={{ margin: "0 0 4px", fontSize: 17, color: COLORS.navy }}> Google Docs 連携の設定</h2>
<p style={{ margin: "0 0 18px", fontSize: 12, color: COLORS.textSecondary }}>OAuthクライアントIDを取得して貼り付けると、議事録をGoogleドキュメントに直接保存できます。</p>
<div style={{ background: "#EEF4FF", borderRadius: 9, padding: "14px 18px", marginBottom: 20, fontSize: 12, lineHeight: 2, color: "#1A2B45" }}>
<strong> 5分で設定できます</strong><br />
1 <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={{ color: COLORS.gdocs }}>Google Cloud Console</a> → 新しいプロジェクトを作成<br />
2 「APIとサービス」→「ライブラリ」→ <strong>Google Docs API</strong> を有効化<br />
3 「認証情報を作成」→「OAuthクライアントID」→ 種類:<strong>ウェブアプリケーション</strong><br />
4 「承認済みのJavaScriptオリジン」に <code style={{ background: "#D6E4FF", padding: "1px 5px", borderRadius: 3 }}>{window.location.origin}</code> を追加<br />
5 表示されたクライアントIDをコピーして下に貼り付け
</div>
<label style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, display: "block", marginBottom: 6 }}>OAuthクライアントID</label>
<input value={val} onChange={(e) => setVal(e.target.value)}
placeholder="xxxxxxxxxx.apps.googleusercontent.com"
style={{ width: "100%", padding: "10px 13px", border: `1px solid ${COLORS.border}`, borderRadius: 7, fontSize: 13, boxSizing: "border-box", fontFamily: "monospace", outline: "none" }} />
<div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
<button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", cursor: "pointer", fontSize: 13 }}>キャンセル</button>
<button onClick={() => { onSave(val); onClose(); }}
style={{ padding: "9px 20px", borderRadius: 7, border: "none", background: COLORS.gdocs, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
保存して連携
</button>

</div>
</div>
</div>
);
}
// ── 波形 ─────────────────────────────────────────────────────
function WaveBar({ delay, active }) {
return <div style={{ width: 3, borderRadius: 2, backgroundColor: active ? COLORS.recording : COLORS.border, animationName: active ? "wave" : "none", animationDuration: "0.8s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: delay, height: active ? undefined : 8 }} />;
}
// ── Markdownレンダリング ──────────────────────────────────────
function RenderMinutes({ text }) {
if (!text) return null;
return text.split("\n").map((line, i) => {
if (line.startsWith("## ")) return <h3 key={i} style={{ color: COLORS.navy, fontSize: 14, fontWeight: 700, margin: "16px 0 6px", borderBottom: `2px solid ${COLORS.green}`, paddingBottom: 4 }}>{line.slice(3)}</h3>;
if (/^[-・]/.test(line)) return <div key={i} style={{ display: "flex", gap: 8, margin: "3px 0", fontSize: 13 }}><span style={{ color: COLORS.green, flexShrink: 0 }}>▸</span><span>{line.replace(/^[-・]\s*/, "")}</span></div>;
if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
return <p key={i} style={{ fontSize: 13, margin: "3px 0", lineHeight: 1.75 }}>{line}</p>;
});
}
// ── メインアプリ ─────────────────────────────────────────────
export default function App() {
const [isRecording, setIsRecording] = useState(false);
const [interimText, setInterimText] = useState("");
const [minutes, setMinutes] = useState("");
const [isGenerating, setIsGenerating] = useState(false);
const [lastUpdated, setLastUpdated] = useState(null);
const [countdown, setCountdown] = useState(30);
const [logs, setLogs] = useState([]);
const [errorMsg, setErrorMsg] = useState("");
const [showSettings, setShowSettings] = useState(false);
const [exportStatus, setExportStatus] = useState("idle"); // idle | exporting | done | error
const [docUrl, setDocUrl] = useState("");
const [clientId, setClientId] = useState(() => { try { return localStorage.getItem("gClientId") || ""; } catch (_) { return ""; } });
const recognitionRef = useRef(null);
const timerRef = useRef(null);
const cntdRef = useRef(null);
const transcriptRef = useRef("");
const logsRef = useRef([]);
const { accessToken, signIn, signOut, authError } = useGoogleAuth(clientId);
const clientIdSet = clientId.includes("googleusercontent");
// ── 議事録生成 ──────────────────────────────────────────────

const generateMinutes = useCallback(async (text) => {
if (!text.trim()) return;
setIsGenerating(true);
try {
const res = await fetch("https://api.anthropic.com/v1/messages", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
model: "claude-sonnet-4-20250514",
max_tokens: 1000,
system: `あなたは会議の議事録作成アシスタントです。音声認識テキストから読みやすい日本語の議事録を作成してください。
形式:
## 議事サマリー
(要点を箇条書き)
## 主な議題・決定事項
(箇条書き)
## アクションアイテム
(担当者・期限が判明している場合は記載)
音声認識の誤りは文脈から補正。不明な部分は[不明]と記載。内容が少なければサマリーのみで可。`,
messages: [{ role: "user", content: `以下の会議音声テキストから議事録を作成してください:\n\n${text}` }],
}),
});
const data = await res.json();

const result =
  data.content?.map((c) => c.text || "").join("\n") || "";

setMinutes(result);
setLastUpdated(new Date());

} catch (e) {
  console.error(e);
  setErrorMsg(
    "議事録生成エラー: " +
    (e.message || JSON.stringify(e))
  );
} finally {
setIsGenerating(false);
}
}, []);
// ── タイマー ───────────────────────────────────────────────
const startTimer = useCallback(() => {
setCountdown(30);
clearInterval(timerRef.current);
clearInterval(cntdRef.current);
cntdRef.current = setInterval(() => setCountdown((c) => (c <= 1 ? 30 : c - 1)), 1000);
timerRef.current = setInterval(() => { generateMinutes(transcriptRef.current); setCountdown(30); }, 30000);
}, [generateMinutes]);
const stopTimer = useCallback(() => { clearInterval(timerRef.current); clearInterval(cntdRef.current); }, []);

// ── 音声認識 ───────────────────────────────────────────────
const startRecording = useCallback(() => {
setErrorMsg("");
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) { setErrorMsg("このブラウザは音声認識に対応していません(Chrome推奨)。"); return; }
const rec = new SR();
rec.lang = "ja-JP"; rec.continuous = true; rec.interimResults = true;
rec.onresult = (e) => {
let interim = "";
for (let i = e.resultIndex; i < e.results.length; i++) {
const r = e.results[i];
if (r.isFinal) {
const text = r[0].transcript.trim();
if (text) {
const timeStr = new Date().toLocaleTimeString("ja-JP");
const newLog = { time: timeStr, text };
logsRef.current = [...logsRef.current, newLog];
setLogs([...logsRef.current]);
transcriptRef.current = transcriptRef.current ? transcriptRef.current + "\n" + text : text;
}
} else interim += r[0].transcript;
}
setInterimText(interim);
};
rec.onerror = (e) => { if (e.error !== "no-speech") setErrorMsg(`音声認識エラー: ${e.error}`); };
rec.onend = () => { if (recognitionRef.current) try { recognitionRef.current.start(); } catch (_) {} };
recognitionRef.current = rec;
rec.start();
setIsRecording(true);
startTimer();
}, [startTimer]);
const stopRecording = useCallback(() => {
if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); recognitionRef.current = null; }
setIsRecording(false); setInterimText(""); stopTimer();
if (transcriptRef.current.trim()) generateMinutes(transcriptRef.current);
}, [stopTimer, generateMinutes]);
const handleReset = () => {
stopRecording();
setMinutes(""); setLogs([]); setLastUpdated(null);
setCountdown(30); setDocUrl(""); setExportStatus("idle"); setErrorMsg("");
transcriptRef.current = ""; logsRef.current = [];
};
// ── Google Docs エクスポート ───────────────────────────────

const handleExport = async () => {
if (!accessToken || !minutes) return;
setExportStatus("exporting"); setDocUrl("");
try {
const url = await exportToGoogleDocs(accessToken, minutes, logsRef.current);
setDocUrl(url); setExportStatus("done");
} catch (e) {
setExportStatus("error"); setErrorMsg("Google Docsへの保存に失敗しました: " + e.message);
}
};
useEffect(() => () => { stopTimer(); if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); } }, [stopTimer]);
const formatTime = (d) => d?.toLocaleTimeString("ja-JP") || "";
return (
<div style={{ minHeight: "100vh", backgroundColor: COLORS.bg, fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif", color: COLORS.textPrimary }}>
<style>{`
@keyframes wave { 0%,100%{height:6px} 50%{height:22px} }
@keyframes pulse { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(1.6);opacity:0} }
button:hover{opacity:.87} button:active{transform:scale(.97)}
a:hover{opacity:.8}
::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:3px}
`}</style>
{showSettings && (
<SettingsModal clientId={clientId}
onSave={(id) => { setClientId(id); try { localStorage.setItem("gClientId", id); } catch (_) {} }}
onClose={() => setShowSettings(false)} />
)}
{/* ヘッダー */}
<header style={{ backgroundColor: COLORS.navy, padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
<div style={{ display: "flex", alignItems: "center", gap: 11 }}>
<div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}> </div>
<div>
<div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>リアルタイム議事録</div>
<div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>音声を聞きながら自動で記録・Google Docs出力</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
{isRecording && (
<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
<div style={{ position: "relative", width: 10, height: 10 }}>
<div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: COLORS.recording, animation: "pulse 1s ease-out infinite" }} />
<div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: COLORS.recording }} />
</div>

<span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>録音中</span>
</div>
)}
<button onClick={() => setShowSettings(true)}
style={{ padding: "7px 13px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.28)", backgroundColor: "transparent", color: "rgba(255,255,255,0.75)", fontSize: 12, cursor: "pointer" }}>
Google設定
</button>
</div>
</header>
{/* コントロールバー */}
<div style={{ backgroundColor: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
{/* 録音ボタン */}
<button onClick={isRecording ? stopRecording : startRecording}
style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, backgroundColor: isRecording ? COLORS.recording : COLORS.green, color: "#fff", boxShadow: isRecording ? "0 0 0 3px rgba(229,62,62,0.18)" : "0 2px 8px rgba(45,122,95,0.28)" }}>
{isRecording ? " 録音停止" : " 録音開始"}
</button>
{/* 波形 */}
<div style={{ display: "flex", alignItems: "center", gap: 3, height: 26 }}>
{["0s","0.1s","0.2s","0.3s","0.4s","0.15s","0.25s"].map((d, i) => <WaveBar key={i} delay={d} active={isRecording} />)}
</div>
{/* カウントダウン */}
{isRecording && (
<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
<div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${COLORS.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: COLORS.green }}>{countdown}</div>
<span style={{ fontSize: 11, color: COLORS.textSecondary }}>秒後に更新</span>
</div>
)}
<div style={{ flex: 1 }} />
{/* 手動更新 */}
{logs.length > 0 && (
<button onClick={() => generateMinutes(transcriptRef.current)} disabled={isGenerating}
style={{ padding: "8px 13px", borderRadius: 6, border: `1px solid ${COLORS.green}`, backgroundColor: "transparent", color: COLORS.green, fontSize: 12, fontWeight: 600, cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.5 : 1 }}>
{isGenerating ? " 生成中..." : " 今すぐ更新"}
</button>
)}
{/* Google Docs ゾーン */}
{minutes && (
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
{!clientIdSet ? (
<button onClick={() => setShowSettings(true)}
style={{ padding: "8px 13px", borderRadius: 6, border: `1px solid ${COLORS.gdocs}`, backgroundColor: "transparent", color: COLORS.gdocs, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>

Google連携を設定
</button>
) : !accessToken ? (
<button onClick={signIn}
style={{ padding: "8px 14px", borderRadius: 6, border: "none", backgroundColor: COLORS.gdocs, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
Googleでログイン
</button>
) : (
<>
<button onClick={handleExport} disabled={exportStatus === "exporting"}
style={{ padding: "8px 14px", borderRadius: 6, border: "none", backgroundColor: exportStatus === "exporting" ? "#9CA3AF" : COLORS.gdocs, color: "#fff", fontSize: 12, fontWeight: 700, cursor: exportStatus === "exporting" ? "not-allowed" : "pointer" }}>
{exportStatus === "exporting" ? " 保存中..." : " Google Docsへ保存"}
</button>
<button onClick={signOut}
style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, backgroundColor: "transparent", color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}>
ログアウト
</button>
{exportStatus === "done" && docUrl && (
<a href={docUrl} target="_blank" rel="noreferrer"
style={{ fontSize: 12, color: COLORS.gdocs, fontWeight: 600, textDecoration: "none" }}>
ドキュメントを開く →
</a>
)}
</>
)}
</div>
)}
<button onClick={handleReset}
style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${COLORS.border}`, backgroundColor: "transparent", color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>
リセット
</button>
</div>
{/* エラー */}
{(errorMsg || authError) && (
<div style={{ margin: "10px 20px 0", padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, fontSize: 13, color: "#B91C1C", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<span> {errorMsg || authError}</span>
<button onClick={() => { setErrorMsg(""); }} style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: 14 }}>✕</button>
</div>
)}
{/* メインエリア */}
<div style={{ display: "flex", height: "calc(100vh - 125px)", overflow: "hidden" }}>
{/* 左:発言ログ */}
<div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${COLORS.border}`, minWidth: 0 }}>

<div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, letterSpacing: "0.04em" }}> 発言ログ</span>
<span style={{ fontSize: 11, color: COLORS.textMuted }}>{logs.length}件</span>
</div>
<div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
{logs.length === 0 && !interimText ? (
<div style={{ textAlign: "center", marginTop: 64, color: COLORS.textMuted }}>
<div style={{ fontSize: 34, marginBottom: 12 }}> </div>
<div style={{ fontSize: 13 }}>録音を開始すると<br />発言が表示されます</div>
</div>
) : (
<>
{logs.map((log, i) => (
<div key={i} style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
<span style={{ fontSize: 10, color: COLORS.textMuted, flexShrink: 0, marginTop: 4, fontFamily: "monospace" }}>{log.time}</span>
<div style={{ fontSize: 13, lineHeight: 1.7, backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 10px", flex: 1 }}>{log.text}</div>
</div>
))}
{interimText && (
<div style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start", opacity: 0.5 }}>
<span style={{ fontSize: 10, color: COLORS.textMuted, flexShrink: 0, marginTop: 4 }}>...</span>
<div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.7, backgroundColor: "#F9FAFB", border: `1px dashed ${COLORS.border}`, borderRadius: 7, padding: "6px 10px", flex: 1, fontStyle: "italic" }}>{interimText}</div>
</div>
)}
</>
)}
</div>
</div>
{/* 右:議事録 */}
<div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
<div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, letterSpacing: "0.04em" }}> 議事録</span>
{lastUpdated && <span style={{ fontSize: 11, color: COLORS.textMuted }}>最終更新 {formatTime(lastUpdated)}</span>}
</div>
<div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
{!minutes && !isGenerating ? (
<div style={{ textAlign: "center", marginTop: 64, color: COLORS.textMuted }}>
<div style={{ fontSize: 34, marginBottom: 12 }}> </div>
<div style={{ fontSize: 13 }}>{isRecording ? "30秒後に議事録が\n自動生成されます" : "録音を開始すると\n議事録が自動生成されます"}</div>
</div>
) : isGenerating && !minutes ? (
<div style={{ textAlign: "center", marginTop: 64, color: COLORS.textSecondary }}>
<div style={{ fontSize: 34, marginBottom: 12 }}> </div>
<div style={{ fontSize: 13 }}>議事録を生成しています...</div>
</div>
) : (

<div style={{ backgroundColor: COLORS.surface, borderRadius: 10, padding: "16px 20px", border: `1px solid ${COLORS.border}`, position: "relative" }}>
{isGenerating && <div style={{ position: "absolute", top: 10, right: 12, fontSize: 11, color: COLORS.amber }}>更新中...</div>}
<RenderMinutes text={minutes} />
</div>
)}
</div>
{minutes && (
<div style={{ padding: "10px 16px", borderTop: `1px solid ${COLORS.border}` }}>
<button onClick={() => navigator.clipboard.writeText(minutes)}
style={{ width: "100%", padding: 9, borderRadius: 7, border: `1px solid ${COLORS.border}`, backgroundColor: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>
議事録をクリップボードにコピー
</button>
</div>
)}
</div>
</div>
</div>
);
}
