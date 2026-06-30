import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Newspaper, Loader2, Link2, Gavel, SearchCheck } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Ev = { by: string; url: string }
type Claim = { id: string; submitter: string; claim: string; evidence: Ev[]; state: string; rating: string; summary: string }
const RAT: Record<string, { c: string; label: string }> = { true: { c: '#15803d', label: 'TRUE' }, misleading: { c: '#b45309', label: 'MISLEADING' }, false: { c: '#b21d2f', label: 'FALSE' }, unverified: { c: '#6c6557', label: 'UNVERIFIED' } }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_claims: 0, assessed: 0, evidence: 0 })
  const [claims, setClaims] = useState<Claim[]>([]); const [sel, setSel] = useState<string | null>(null)
  const [compose, setCompose] = useState(false); const [claim, setClaim] = useState(''); const [evUrl, setEvUrl] = useState('')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_claims: Number(s?.total_claims ?? 0), assessed: Number(s?.assessed ?? 0), evidence: Number(s?.evidence ?? 0) })
      const total = Number(s?.total_claims ?? 0); const out: Claim[] = []
      for (let i = total - 1; i >= 0 && i >= total - 24; i--) { try { const c = (await read('get_claim', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i), evidence: c.evidence ?? [] }) } catch {} }
      setClaims(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function submit() { if (!claim.trim()) return toast.error('Claim.'); setCreating(true); const t = toast.loading('Filing…'); try { const id = (await write('submit_claim', [claim.trim()])) as any; toast.success('Filed.', { id: t }); setClaim(''); setCompose(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function addEv(c: Claim) { if (!evUrl.trim()) return toast.error('Evidence URL.'); setBusy(c.id); const t = toast.loading('Filing source…'); try { await write('add_evidence', [c.id, evUrl.trim()]); setEvUrl(''); toast.success('Source added.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function assess(c: Claim) { setBusy(c.id); const t = toast.loading('Validators weighing the record… (30–60s)'); try { await write('assess', [c.id]); const x = (await read('get_claim', [c.id])) as any; toast.success(String(x?.rating).toUpperCase(), { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const c = claims.find((x) => x.id === sel) || null
  const r = c && c.state === 'assessed' ? (RAT[c.rating] ?? RAT.unverified) : null
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()
  const SERIF = { fontFamily: 'Playfair Display, Georgia, serif' }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="light" position="top-right" richColors />

      {/* ============================== MASTHEAD ============================== */}
      <div className="mx-auto max-w-6xl px-5">
        {/* folio line — dateline · edition · Connect text link (no header bar) */}
        <div className="flex items-center justify-between gap-3 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          <span className="hidden sm:inline">{today}</span>
          <span className="sm:hidden">Bradbury Edition</span>
          <span className="hidden md:inline">Testnet Bradbury · Chain 4221</span>
          <button onClick={connect} className="underline decoration-dotted underline-offset-4 transition-colors hover:text-primary">
            {wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected ✓' : 'Connect Wallet'}
          </button>
        </div>

        {/* top hairline rule (heavy + thin) */}
        <div className="border-t-4 border-foreground" />
        <div className="mt-[3px] border-t border-foreground" />

        {/* the masthead title */}
        <div className="py-6 text-center">
          <h1 style={SERIF} className="text-5xl font-black leading-none tracking-tight md:text-7xl">CrowdFactCheck</h1>
          <p style={SERIF} className="mx-auto mt-3 max-w-xl text-sm italic text-muted md:text-base">
            “Crowd-sourced, consensus-rated fact-checking — the record, examined.”
          </p>
        </div>

        {/* bottom hairline rule (thin + heavy) */}
        <div className="border-t border-foreground" />
        <div className="mt-[3px] border-t-4 border-foreground" />

        {/* dateline / statistics strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          <span><b className="text-foreground"><NumberTicker value={stats.total_claims} /></b> Claims Filed</span>
          <span aria-hidden>◆</span>
          <span><b className="text-primary"><NumberTicker value={stats.assessed} /></b> Verdicts Rendered</span>
          <span aria-hidden>◆</span>
          <span><b className="text-foreground"><NumberTicker value={stats.evidence} /></b> Sources Cited</span>
        </div>
      </div>

      {/* ================================ BODY =============================== */}
      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[300px_1fr]">

        {/* ---- LEFT: THE DESK ---- */}
        <aside className="lg:border-r lg:border-border lg:pr-7">
          <div className="flex items-end justify-between border-b-2 border-foreground pb-1.5">
            <h2 style={SERIF} className="text-2xl font-black leading-none">The Desk</h2>
            <button onClick={() => setCompose(!compose)} className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline">
              {compose ? 'Close' : '＋ File a claim'}
            </button>
          </div>

          {compose && (
            <div className="mt-3 grid gap-2 border border-border bg-surface p-3">
              <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={3} placeholder="A circulating claim to put on the record…" className="resize-none border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" />
              <Button size="sm" onClick={submit} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />} File the claim</Button>
            </div>
          )}

          <div className="mt-1">
            {claims.length === 0 && <div className="py-6 text-sm italic text-muted">The desk is clear. File the first claim.</div>}
            {claims.map((x) => {
              const xr = x.state === 'assessed' ? (RAT[x.rating] ?? RAT.unverified) : null
              const on = sel === x.id
              return (
                <button key={x.id} onClick={() => setSel(x.id)} className={`block w-full border-b border-border py-3 pl-3 text-left transition-colors ${on ? 'border-l-[3px] border-l-primary bg-[#eee9dd]' : 'border-l-[3px] border-l-transparent hover:bg-[#f0ece1]'}`}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">No. {x.id} · {x.state === 'assessed' ? 'Ruled' : 'Under review'}</div>
                  <div style={SERIF} className="mt-1 line-clamp-3 text-[15px] font-bold leading-snug">{x.claim}</div>
                  <div className="mt-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: xr ? xr.c : '#6c6557' }}>{xr ? `▮ ${xr.label}` : `${x.evidence.length} source${x.evidence.length === 1 ? '' : 's'} on file`}</div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ---- RIGHT: THE ARTICLE ---- */}
        <article>
          {!c ? (
            <div className="grid h-72 place-items-center text-center">
              <div>
                <Newspaper className="mx-auto h-8 w-8 text-muted" />
                <p style={SERIF} className="mt-3 text-xl font-bold text-muted">Select a claim from The Desk.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
                <Newspaper className="h-3.5 w-3.5" /> Fact-Check Dispatch · No. {c.id}
              </div>

              <div className="mt-3 flex items-start gap-5">
                <h1 style={SERIF} className="flex-1 text-4xl font-black leading-[1.04] tracking-tight md:text-5xl">{c.claim}</h1>
                {r && (
                  <motion.div
                    initial={{ scale: 1.5, opacity: 0, rotate: -22 }}
                    animate={{ scale: 1, opacity: 1, rotate: -8 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                    className="shrink-0 select-none border-[3px] px-3 py-1.5 text-center"
                    style={{ borderColor: r.c, color: r.c, boxShadow: `0 0 0 1px ${r.c} inset` }}
                  >
                    <div style={SERIF} className="text-2xl font-black leading-none md:text-3xl">{r.label}</div>
                    <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.25em]">Verdict</div>
                  </motion.div>
                )}
              </div>

              {/* byline / dateline */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-border py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                <span>Filed by {short(c.submitter)}</span>
                <span aria-hidden>·</span>
                <span>{c.evidence.length} source{c.evidence.length === 1 ? '' : 's'} on the record</span>
                <span aria-hidden>·</span>
                <span style={{ color: r ? r.c : undefined }}>{c.state === 'assessed' ? 'Verdict rendered' : 'Awaiting ruling'}</span>
              </div>

              {/* lede / summary with drop cap */}
              {r && c.summary ? (
                <p className="mt-4 text-lg leading-relaxed text-foreground first-letter:float-left first-letter:mr-2.5 first-letter:mt-1 first-letter:text-6xl first-letter:font-black first-letter:leading-[0.7] first-letter:text-primary" style={SERIF}>
                  {c.summary}
                </p>
              ) : (
                <p style={SERIF} className="mt-4 text-base italic leading-relaxed text-muted">
                  The validators have not yet ruled. Add sources to the record below, then call for a verdict.
                </p>
              )}

              {/* footnotes — numbered cited sources [1][2] */}
              <div className="mt-7 border-t-2 border-foreground pt-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted">Sources on the Record</div>
                <ol className="mt-3 space-y-2.5">
                  {c.evidence.length === 0 && <li className="text-sm italic text-muted">No sources cited yet.</li>}
                  {c.evidence.map((e, i) => (
                    <li key={i} className="flex items-baseline gap-2.5 text-sm leading-snug">
                      <span className="font-bold text-primary">[{i + 1}]</span>
                      <a href={e.url} target="_blank" rel="noreferrer" className="break-all text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid">{e.url}</a>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">— {short(e.by)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* actions */}
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <div className="flex min-w-0 flex-1 gap-2">
                  <input value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Cite a source URL…" className="min-w-0 flex-1 border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => addEv(c)}><Link2 className="h-4 w-4" /> Cite</Button>
                </div>
                {c.evidence.length > 0 && (
                  <Button size="sm" disabled={busy === c.id} onClick={() => assess(c)}>
                    {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} {c.state === 'assessed' ? 'Re-rate' : 'Render verdict'}
                  </Button>
                )}
              </div>
            </>
          )}
        </article>
      </main>

      {/* =============================== IMPRINT ============================== */}
      <footer className="mt-4 border-t-4 border-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          <span style={SERIF} className="text-xs font-black tracking-normal text-foreground">CrowdFactCheck</span>
          <span>Published on-chain · GenLayer Bradbury</span>
          <a href={EXPLORER} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-primary">{short(CONTRACT)} ↗</a>
        </div>
      </footer>
    </div>
  )
}
