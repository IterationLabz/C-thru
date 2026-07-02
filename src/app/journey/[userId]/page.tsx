import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getJourney } from '@/lib/journeyEngine'
import AppShell from '@/components/AppShell'
import Badge from '@/components/Badge'

export const dynamic = 'force-dynamic'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params
  return { title: decodeURIComponent(userId) }
}

export default async function JourneyPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const decodedId = decodeURIComponent(userId)
  const journey = await getJourney(decodedId)
  if (!journey) notFound()

  const { user, events, identificationAt } = journey
  const preCount = events.filter(e => !e.postIdentification).length
  const postCount = events.filter(e => e.postIdentification).length

  return (
    <AppShell maxWidth="52rem">
      {/* ── Breadcrumb ── */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.75rem', fontSize: '0.8125rem' }}>
        <Link href="/journey" style={{ color: 'var(--color-ink-3)', textDecoration: 'none' }}>Journey</Link>
        <span style={{ color: 'var(--color-line)' }}>/</span>
        <span style={{ color: 'var(--color-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email ?? decodedId}
        </span>
      </nav>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.875rem',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            marginBottom: '0.25rem',
          }}
        >
          {user.email ?? decodedId}
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>{decodedId}</p>
        {identificationAt && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', marginTop: '0.5rem' }}>
            Identified {formatTime(identificationAt)}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
          <Link href={`/ask?q=${encodeURIComponent(`count events for user ${decodedId}`)}`} style={{ textDecoration: 'none' }}>
            <Badge color="neutral">{events.length} events total</Badge>
          </Link>
          {preCount > 0 && (
            <Link href={`/ask?q=${encodeURIComponent(`count anonymous events for user ${decodedId}`)}`} style={{ textDecoration: 'none' }}>
              <Badge color="neutral">{preCount} pre-identify</Badge>
            </Link>
          )}
          {postCount > 0 && (
            <Link href={`/ask?q=${encodeURIComponent(`count identified events for user ${decodedId}`)}`} style={{ textDecoration: 'none' }}>
              <Badge color="accent">{postCount} post-identify</Badge>
            </Link>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-ink-3)' }}>No events for this user.</p>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Spine */}
          <div
            style={{
              position: 'absolute',
              left: '7px',
              top: '8px',
              bottom: '8px',
              width: '1px',
              background: 'var(--color-line)',
            }}
          />

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {events.map((evt, i) => {
              const isSeam =
                i > 0 &&
                !events[i - 1]!.postIdentification &&
                evt.postIdentification

              return (
                <li key={evt.id}>
                  {/* ── Identification seam ── */}
                  {isSeam && identificationAt && (
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        margin: '1.25rem 0',
                        paddingLeft: '2rem',
                      }}
                    >
                      {/* Seam dot */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          width: '15px',
                          height: '15px',
                          borderRadius: '50%',
                          background: 'var(--color-accent)',
                          border: '2px solid var(--color-card)',
                          boxShadow: `0 0 0 2px var(--color-accent)`,
                          zIndex: 1,
                        }}
                      />
                      {/* Seam line */}
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ height: '1px', flex: 1, background: 'var(--color-accent)', opacity: 0.3 }} />
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            background: 'var(--color-card)',
                            padding: '0.1875rem 0.625rem',
                            borderRadius: '20px',
                            border: '1px solid rgba(184,92,72,0.3)',
                          }}
                        >
                          ── identified as {user.email ?? decodedId} ──
                        </span>
                        <div style={{ height: '1px', flex: 1, background: 'var(--color-accent)', opacity: 0.3 }} />
                      </div>
                    </div>
                  )}

                  {/* ── Event row ── */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      paddingLeft: '2rem',
                      paddingBottom: i < events.length - 1 ? '0.75rem' : 0,
                    }}
                  >
                    {/* Dot */}
                    <Link href={`/ask?q=${encodeURIComponent(`show event at ${evt.receivedAt} for user ${decodedId}`)}`}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '3px',
                          top: '5px',
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: evt.postIdentification ? 'var(--color-accent)' : 'var(--color-ink-3)',
                          border: '2px solid var(--color-card)',
                          zIndex: 1,
                        }}
                      />
                    </Link>

                    {/* Timestamp */}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6875rem',
                        color: 'var(--color-ink-3)',
                        whiteSpace: 'nowrap',
                        paddingTop: '1px',
                        minWidth: '10rem',
                      }}
                    >
                      {formatTime(evt.receivedAt)}
                    </span>

                    {/* Event name + anonymous tag */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.875rem',
                            fontWeight: evt.postIdentification ? 600 : 400,
                            color: evt.postIdentification ? 'var(--color-ink)' : 'var(--color-ink-2)',
                          }}
                        >
                          <Link href={`/ask?q=${encodeURIComponent(`show events named ${evt.name} for user ${decodedId}`)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {evt.name}
                          </Link>
                        </span>
                        {!evt.postIdentification && (
                          <Badge color="neutral">[anonymous]</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}

            {/* Seam at end if no post-identify events */}
            {identificationAt && events.every(e => !e.postIdentification) && (
              <li>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: '1.25rem',
                    paddingLeft: '2rem',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: '15px',
                      height: '15px',
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      border: '2px solid var(--color-card)',
                      boxShadow: `0 0 0 2px var(--color-accent)`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--color-accent)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ── identified as {user.email ?? decodedId} · {formatTime(identificationAt)} ──
                  </span>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </AppShell>
  )
}
