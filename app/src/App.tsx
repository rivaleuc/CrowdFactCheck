import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  SearchCheck, Wallet, Loader2, Plus, Link2, Gavel, ChevronDown, CircleCheck, CircleAlert, CircleX, CircleHelp,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Ev = { by: string; url: string }
type Claim = { id: string; submitter: string; claim: string; evidence: Ev[]; state: string; rating: string; summary: string }

const RAT: Record<string, { c: string; I: any }> = {
  true: { c: 'text-true border-true/40 bg-true/10', I: CircleCheck },
  misleading: { c: 'text-unverifiable border-unverifiable/40 bg-unverifiable/10', I: CircleAlert },
  false: { c: 'text-false border-false/40 bg-false/10', I: CircleX },
  unverified: { c: 'text-muted border-border bg-white/[0.03]', I: CircleHelp },
}

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_claims: 0, assessed: 0, evidence: 0 })
  const [claims, setClaims] = useState<Claim[]>([])
  const [open, setOpen] = useState(false); const [exp, setExp] = useState<string | null>(null)
  const [claim, setClaim] = useState(''); const [evUrl, setEvUrl] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_claims: Number(s?.total_claims ?? 0), assessed: Number(s?.assessed ?? 0), evidence: Number(s?.evidence ?? 0) })
      const total = Number(s?.total_claims ?? 0); const out: Claim[] = []
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const c = (await read('get_claim', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i), evidence: c.evidence ?? [] }) } catch {} }
      setClaims(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function submit() { if (!claim.trim()) return toast.error('Enter a claim.'); setCreating(true); const t = toast.loading('Submitting claim…'); try { await write('submit_claim', [claim.trim()]); toast.success('Submitted.', { id: t }); setClaim(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function addEv(c: Claim) { const u = evUrl[c.id]; if (!u?.trim()) return toast.error('Evidence URL.'); setBusy(c.id); const t = toast.loading('Adding evidence…'); try { await write('add_evidence', [c.id, u.trim()]); setEvUrl({ ...evUrl, [c.id]: '' }); toast.success('Evidence added.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function assess(c: Claim) { setBusy(c.id); const t = toast.loading('Validators weighing evidence… (30–60s)'); try { await write('assess', [c.id]); const x = (await read('get_claim', [c.id])) as any; toast.success(`Rating: ${String(x?.rating).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#2dd4bf1c,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <SearchCheck className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">CrowdFactCheck</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_claims} /></b> claims · <b className="text-primary"><NumberTicker value={stats.assessed} /></b> rated · <b className="text-accent"><NumberTicker value={stats.evidence} /></b> evidence</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Fact-checks the crowd can audit</h1>
        <p className="mt-1 text-sm text-muted">Submit a claim, the crowd attaches evidence, and validators synthesize a rating from the sources — not one outlet's word.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Submit a claim'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 flex gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="A circulating claim to check…" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" onClick={submit} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />} Submit</Button>
            </div>
          </motion.div>
        )}

        <div className="mt-6 space-y-2">
          {claims.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No claims yet.</div>}
          {claims.map((c) => {
            const r = RAT[c.rating] ?? RAT.unverified; const I = r.I; const rated = c.state === 'assessed'
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card/50">
                <button onClick={() => setExp(exp === c.id ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {rated ? <I className={`h-4 w-4 shrink-0 ${r.c.split(' ')[0]}`} /> : <SearchCheck className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="flex-1 text-sm">{c.claim}</span>
                  {rated ? <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${r.c}`}>{c.rating}</span> : <span className="font-mono text-[11px] text-muted">{c.evidence.length} ev</span>}
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${exp === c.id ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {exp === c.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-border/60">
                      <div className="space-y-3 p-4">
                        <div className="space-y-1">
                          {c.evidence.length === 0 && <p className="text-xs text-muted">No evidence yet — add a source.</p>}
                          {c.evidence.map((e, i) => <a key={i} href={e.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-xs text-accent hover:underline"><Link2 className="h-3 w-3 shrink-0" /> {e.url}</a>)}
                        </div>
                        {rated && c.summary && <p className="rounded-lg border border-border bg-background/40 p-2.5 text-xs text-muted">{c.summary}</p>}
                        <div className="flex gap-2">
                          <input value={evUrl[c.id] ?? ''} onChange={(e) => setEvUrl({ ...evUrl, [c.id]: e.target.value })} placeholder="Evidence URL" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                          <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => addEv(c)}><Link2 className="h-4 w-4" /> Add</Button>
                          {c.evidence.length > 0 && <Button size="sm" disabled={busy === c.id} onClick={() => assess(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} {rated ? 'Re-rate' : 'Assess'}</Button>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>CrowdFactCheck · crowd-sourced, consensus-rated fact-checking on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
