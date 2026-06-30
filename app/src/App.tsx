import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { SearchCheck, Wallet, Loader2, Plus, Link2, Gavel, Newspaper } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Ev = { by: string; url: string }
type Claim = { id: string; submitter: string; claim: string; evidence: Ev[]; state: string; rating: string; summary: string }
const RAT: Record<string, { c: string; label: string }> = { true: { c: '#34d399', label: 'TRUE' }, misleading: { c: '#fbbf24', label: 'MISLEADING' }, false: { c: '#fb7185', label: 'FALSE' }, unverified: { c: '#94a3b8', label: 'UNVERIFIED' } }

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#2dd4bf16,transparent_60%)]" />
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-5">
        <SearchCheck className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>CrowdFactCheck</span>
        <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_claims} /></b> claims · <b className="text-primary"><NumberTicker value={stats.assessed} /></b> rated</div>
        <Button size="sm" className="ml-auto" variant="outline" onClick={() => setCompose(!compose)}><Plus className="h-4 w-4" /> Claim</Button>
        <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </div></header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-7 lg:grid-cols-[260px_1fr]">
        {/* claim headlines rail */}
        <aside>
          {compose && (
            <div className="mb-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={3} placeholder="A circulating claim…" className="resize-none rounded-md border border-border bg-background/70 px-2.5 py-2 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" onClick={submit} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />} File</Button>
            </div>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">The desk</div>
          <div className="mt-2 space-y-1">
            {claims.map((x) => { const xr = x.state === 'assessed' ? (RAT[x.rating] ?? RAT.unverified) : null; return (
              <button key={x.id} onClick={() => setSel(x.id)} className={`block w-full rounded-lg border p-2.5 text-left ${sel === x.id ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40 hover:bg-card/70'}`}>
                <div className="line-clamp-2 text-sm leading-snug">{x.claim}</div>
                <div className="mt-1 text-[10px] font-bold uppercase" style={{ color: xr ? xr.c : '#7f8a99' }}>{xr ? xr.label : `${x.evidence.length} sources · open`}</div>
              </button>
            )})}
          </div>
        </aside>

        {/* article */}
        <article>
          {!c ? <div className="grid h-64 place-items-center text-sm text-muted">Pick a claim from the desk.</div> : (
            <>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted"><Newspaper className="h-3.5 w-3.5" /> fact-check · #{c.id}</div>
              <div className="mt-2 flex items-start gap-4">
                <h1 className="flex-1 text-3xl font-black leading-tight tracking-tight md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>{c.claim}</h1>
                {r && <div className="shrink-0 -rotate-6 rounded-xl border-4 px-4 py-2 text-center" style={{ borderColor: r.c, color: r.c }}><div className="text-xl font-black leading-none">{r.label}</div></div>}
              </div>
              {r && c.summary && <p className="mt-4 border-l-4 pl-4 text-lg leading-relaxed text-foreground/85" style={{ borderColor: r.c }}>{c.summary}</p>}

              {/* footnotes */}
              <div className="mt-6 border-t border-border pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sources on the record</div>
                <ol className="mt-2 space-y-1.5">
                  {c.evidence.length === 0 && <li className="text-sm text-muted">No sources cited yet.</li>}
                  {c.evidence.map((e, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-sm"><span className="font-mono text-xs text-primary">[{i + 1}]</span><a href={e.url} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">{e.url}</a><span className="text-[10px] text-muted">· {short(e.by)}</span></li>
                  ))}
                </ol>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="flex min-w-0 flex-1 gap-2"><input value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Add a source URL" className="min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => addEv(c)}><Link2 className="h-4 w-4" /> Cite</Button></div>
                {c.evidence.length > 0 && <Button size="sm" disabled={busy === c.id} onClick={() => assess(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} {c.state === 'assessed' ? 'Re-rate' : 'Render verdict'}</Button>}
              </div>
            </>
          )}
        </article>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-muted"><span>CrowdFactCheck · crowd-sourced, consensus-rated fact-checking</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
