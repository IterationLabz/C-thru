import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { scoreCompany } from '@/lib/readinessEngine'
import { GenerateDraftButton } from './GenerateDraftButton'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import Badge from '@/components/Badge'

export const dynamic = 'force-dynamic'

function displayName(domain: string): string {
  const stripped = domain.replace(/\.(com|io|co|net|org|ai|app|dev|so|xyz)$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params
  return { title: displayName(domain) }
}

export default async function AccountDetailPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const score = await scoreCompany(domain)
  if (!score) notFound()

  const pct = score.rulesTotal === 0 ? 0 : Math.round((score.rulesMet / score.rulesTotal) * 100)
  const scoreColor = pct >= 60 ? 'var(--color-green)' : pct >= 40 ? 'var(--color-accent)' : 'var(--color-ink-3)'

  return (
    <AppShell maxWidth="52rem">
      {/* ── Breadcrumb ── */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.75rem', fontSize: '0.8125rem' }}>
        <Link href="/accounts" style={{ color: 'var(--color-ink-3)', textDecoration: 'none' }}>Accounts</Link>
        <span style={{ color: 'var(--color-line)' }}>/</span>
        <span style={{ color: 'var(--color-ink-2)' }}>{displayName(domain)}</span>
      </nav>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.375rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--color-paper-2)',
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--color-ink-2)',
              flexShrink: 0,
            }}
          >
            {displayName(domain).charAt(0)}
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
            }}
          >
            {displayName(domain)}
          </h1>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>{domain}</p>
      </div>

      {/* ── Score summary ── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <p
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-3)',
                marginBottom: '0.375rem',
              }}
            >
              Readiness score
            </p>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '3rem',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {score.rulesMet}/{score.rulesTotal}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', marginTop: '0.25rem' }}>
              rules met
            </p>
          </div>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: `conic-gradient(${scoreColor} ${pct * 3.6}deg, var(--color-paper-2) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'var(--color-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: scoreColor,
              }}
            >
              {pct}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '6px', background: 'var(--color-paper-2)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: scoreColor, borderRadius: '3px', transition: 'width 0.4s' }} />
        </div>
      </Card>

      {/* ── Per-rule breakdown (signature element) ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-3)',
            marginBottom: '0.875rem',
          }}
        >
          Rule breakdown
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {score.breakdown.map(r => (
            <div
              key={r.ruleId}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                background: 'var(--color-card)',
                border: `1px solid ${r.passed ? 'rgba(91,122,70,0.2)' : 'var(--color-line)'}`,
                borderRadius: '12px',
                padding: '0.875rem 1.125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1,
                    marginTop: '1px',
                    color: r.passed ? 'var(--color-green)' : 'var(--color-ink-3)',
                    flexShrink: 0,
                  }}
                >
                  {r.passed ? '✓' : '✗'}
                </span>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                    <Link href="/settings" style={{ textDecoration: 'none', color: 'inherit' }}>
                      {r.label}
                    </Link>
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', marginTop: '0.125rem' }}>
                    {r.value}
                  </p>
                </div>
              </div>
              <Badge color={r.passed ? 'green' : 'neutral'}>
                {r.passed ? 'Met' : 'Not met'}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      {/* ── Draft outreach CTA ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
              Ready to reach out?
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', lineHeight: 1.45 }}>
              C-thru drafts a message from their readiness data. You review, edit, and send — never automatic.
            </p>
          </div>
          <GenerateDraftButton domain={domain} />
        </div>
      </Card>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '1.25rem', fontFamily: 'var(--font-mono)' }}>
        Scores computed live ·{' '}
        <Link href="/settings" style={{ color: 'var(--color-ink-3)' }}>Edit rules →</Link>
      </p>
    </AppShell>
  )
}
