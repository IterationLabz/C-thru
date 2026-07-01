import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'C-thru — Open-source PQL engine' }

/* ── Marketing Nav ── */
function MarketingNav() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(247,244,238,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 2rem',
          height: '4rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Left Logo */}
        <div>
          <Link href="/">
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink)',
                textTransform: 'uppercase',
              }}
            >
              C<span style={{ color: 'var(--color-accent)' }}>—</span>thru
            </span>
          </Link>
        </div>

        {/* Right Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a
            href="https://github.com/IterationLabz/C-thru"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:block"
            style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-ink-2)', textDecoration: 'none' }}
          >
            GitHub
          </a>
          <Link
            href="/dashboard"
            style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-ink-2)', textDecoration: 'none' }}
          >
            Log In
          </Link>
          <div className="hex-btn-wrapper">
            <Link
              href="/dashboard"
              style={{
                display: 'inline-block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-ink)',
                background: 'rgba(184,92,72,0.06)',
                border: '1px solid rgba(184,92,72,0.2)',
                padding: '0.4375rem 1rem',
                borderRadius: '4px',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ── Reusable Mockup Window ── */
function MockupWindow({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-card)',
      borderRadius: '8px',
      border: '1px solid var(--color-line)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-line)',
        background: 'var(--color-card)',
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2DFD7' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2DFD7' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2DFD7' }} />
        </div>
        <div style={{ margin: '0 auto', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink-2)' }}>
          {title}
        </div>
      </div>
      <div style={{ padding: '1.5rem', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div style={{ background: 'transparent', minHeight: '100dvh' }}>
      <MarketingNav />

      {/* ── HERO ── */}
      <section style={{
        padding: '8rem 2rem 10rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3rem, 7vw, 5.5rem)',
            fontWeight: 400,
            lineHeight: 1.05,
            color: 'var(--color-ink)',
            marginBottom: '2rem',
            maxWidth: '56rem',
          }}
        >
          <span style={{ fontStyle: 'italic', color: 'var(--color-ink-2)' }}>The open-source PQL engine</span><br />
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '-0.03em' }}>where usage meets intent</span>
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.25rem',
            color: 'var(--color-ink-2)',
            lineHeight: 1.6,
            marginBottom: '3rem',
            maxWidth: '42rem',
            fontWeight: 400,
          }}
        >
          Finally — anyone can get data insights grounded in the facts of their business. C-thru has a flexible approach to context that earns trust without locking you into a SaaS billing cycle.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '6rem' }}>
          <div className="hex-btn-wrapper">
            <Link
              href="/dashboard"
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-sans)',
                fontSize: '1rem',
                fontWeight: 500,
                color: 'var(--color-ink)',
                background: 'rgba(184,92,72,0.06)',
                border: '1px solid rgba(184,92,72,0.2)',
                padding: '0.875rem 1.5rem',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              Get started for free
            </Link>
          </div>
          <a
            href="https://github.com/IterationLabz/C-thru"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-sans)',
              fontSize: '1rem',
              fontWeight: 500,
              color: 'var(--color-ink)',
              background: 'var(--color-card)',
              border: '1px solid var(--color-line)',
              padding: '0.875rem 1.5rem',
              borderRadius: '4px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            View on GitHub
          </a>
        </div>

        {/* Floating UI Mockup */}
        <div style={{ width: '100%', maxWidth: '960px', position: 'relative', zIndex: 10 }}>
          <MockupWindow title="C-thru Dashboard">
             <div style={{ display: 'flex', gap: '1.5rem', height: '400px', textAlign: 'left' }}>
                <div style={{ flex: 1, border: '1px solid var(--color-line)', borderRadius: '8px', background: 'var(--color-card)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-ink)' }}>Top Accounts by Readiness</h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Updated Live</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { name: 'Acme Corp', domain: 'acme.com', score: 92, status: 'Ready' },
                      { name: 'Globex', domain: 'globex.io', score: 85, status: 'Warm' },
                      { name: 'Initech', domain: 'initech.net', score: 78, status: 'Warm' },
                      { name: 'Soylent', domain: 'soylent.com', score: 45, status: 'Cold' },
                    ].map((c) => (
                      <div key={c.domain} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--color-line)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-ink-2)' }}>
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-ink)', fontSize: '0.9375rem' }}>{c.name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>{c.domain}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: c.score > 80 ? 'var(--color-green)' : c.score > 60 ? 'var(--color-amber)' : 'var(--color-ink-3)', fontSize: '1rem' }}>{c.score}/100</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>{c.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hidden md:flex" style={{ width: '300px', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ border: '1px solid var(--color-line)', borderRadius: '8px', background: 'var(--color-card)', padding: '1.5rem' }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-ink-3)', marginBottom: '0.75rem' }}>Active Users · 7d</p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)', lineHeight: 1 }}>12,450</p>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-green)', background: 'rgba(91,122,70,0.1)', padding: '0.125rem 0.4375rem', borderRadius: '6px', marginBottom: '0.25rem' }}>↑ 18%</span>
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--color-line)', borderRadius: '8px', background: 'var(--color-card)', padding: '1.5rem', flex: 1 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-ink-3)', marginBottom: '1rem' }}>Live Events</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {[
                        { event: 'dashboard_viewed', user: 'alice@acme.com', time: 'Just now' },
                        { event: 'report_exported', user: 'bob@globex.io', time: '1m ago' },
                        { event: 'query_run', user: 'carol@initech.net', time: '3m ago' },
                      ].map((e, i) => (
                        <div key={i} style={{ fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--color-green)', marginRight: '0.5rem' }}>●</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{e.event}</span>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '0.25rem', paddingLeft: '1rem' }}>{e.user} · {e.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
             </div>
          </MockupWindow>
        </div>
      </section>

      {/* ── TRUSTED BY ── */}
      <section style={{ padding: '4rem 2rem', borderTop: '1px solid var(--color-line)', borderBottom: '1px solid var(--color-line)', background: 'var(--color-paper)', textAlign: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
            <span style={{ color: 'var(--color-ink-3)', fontSize: '0.75rem' }}>⊢</span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--color-ink-3)', textTransform: 'uppercase' }}>
              Trusted by leading data companies
            </span>
            <span style={{ color: 'var(--color-ink-3)', fontSize: '0.75rem' }}>⊣</span>
         </div>
         <div style={{ 
           display: 'flex', 
           justifyContent: 'center', 
           flexWrap: 'wrap', 
           gap: '4rem', 
           opacity: 0.6,
           filter: 'grayscale(100%)'
         }}>
           {['ACME', 'Globex', 'Soylent', 'Initech', 'Umbrella'].map(name => (
             <span key={name} style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600 }}>{name}</span>
           ))}
         </div>
      </section>

      {/* ── SECONDARY HERO / OPEN SOURCE ── */}
      <section style={{ padding: '8rem 2rem', textAlign: 'center', background: 'var(--color-paper-2)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 400,
            lineHeight: 1.1,
            color: 'var(--color-ink)',
            marginBottom: '1.5rem',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '-0.02em' }}>Open-source workflows</span><br />
          <span style={{ fontStyle: 'italic', color: 'var(--color-ink-2)' }}>for every data question</span>
        </h2>
        <p style={{ fontSize: '1.125rem', color: 'var(--color-ink-2)', lineHeight: 1.6, maxWidth: '42rem', margin: '0 auto' }}>
          AI can answer almost any question. But in business, the only answers that matter are accurate ones. C-thru gives you a trusted foundation grounded entirely in your own telemetry.
        </p>
      </section>

      {/* ── SPLIT LAYOUT 1: WHAT IT IS ── */}
      <section style={{ padding: '8rem 2rem', borderTop: '1px solid var(--color-line)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '6rem', alignItems: 'center' }} className="md:grid-cols-[1fr_1.5fr]">
          
          <div style={{ paddingRight: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' }}>
               <div style={{ width: '8px', height: '8px', background: 'var(--color-green)', borderRadius: '1px' }} />
               <div style={{ width: '8px', height: '8px', background: 'transparent', border: '1px solid var(--color-ink-3)', borderRadius: '1px' }} />
            </div>
            
            <h3 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '2.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--color-ink)',
              marginBottom: '1.5rem',
            }}>
              Your product usage, finally answering the real question.
            </h3>
            
            <p style={{ fontSize: '1.125rem', color: 'var(--color-ink-2)', lineHeight: 1.6, marginBottom: '2rem' }}>
              Most analytics tools show you charts. C-thru tells you which companies are close to buying, who to talk to, and what to say — grounded in your real usage data, and nothing invented.
            </p>

            <Link
              href="/dashboard"
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: 'var(--color-ink)',
                background: 'var(--color-card)',
                border: '1px solid var(--color-line)',
                padding: '0.75rem 1.25rem',
                borderRadius: '4px',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              Explore features
            </Link>
          </div>

          <div style={{ position: 'relative' }}>
             <MockupWindow title="Product Readiness Overview">
                <div style={{ borderBottom: '1px solid var(--color-line)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                   <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 600 }}>Accounts Ready to Convert</h4>
                   <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>Interactive breakdown of account signals across product lines.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                   {[ '$24.5M', 'Enterprise', 'Commercial' ].map((val, i) => (
                     <div key={i} style={{ border: '1px solid var(--color-line)', borderRadius: '6px', padding: '1rem', textAlign: 'center' }}>
                       <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{val}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>Total Pipeline</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--color-green)', marginTop: '0.25rem' }}>↑ 4.1% vs last week</div>
                     </div>
                   ))}
                </div>
                <div style={{ height: '200px', background: 'var(--color-paper-2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-3)', fontSize: '0.875rem', border: '1px dashed var(--color-line)' }}>
                   [ Data Visualization Appears Here ]
                </div>
             </MockupWindow>
          </div>

        </div>
      </section>

      {/* ── THE LOOP (4 STEPS GRID) ── */}
      <section style={{ padding: '8rem 2rem', background: 'var(--color-paper)', borderTop: '1px solid var(--color-line)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
              fontWeight: 400,
              color: 'var(--color-ink)',
              textAlign: 'center',
              marginBottom: '4rem',
            }}
          >
             <span style={{ fontStyle: 'italic', color: 'var(--color-ink-2)' }}>The Loop:</span> <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '-0.02em' }}>Track. Ask. Score. Act.</span>
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {[
              { n: '01', title: 'Track', desc: 'Paste one snippet. C-thru captures product events and groups users into companies by email domain.' },
              { n: '02', title: 'Ask', desc: 'Ask questions in plain English. See the exact SQL it runs — no black box, ever.' },
              { n: '03', title: 'Score', desc: 'Rank accounts by readiness to pay, using transparent rules you set and can audit.' },
              { n: '04', title: 'Act', desc: "Get a daily brief of ready accounts and drafted outreach — with you always in control." }
            ].map(({ n, title, desc }) => (
              <div key={n} style={{ borderTop: '2px solid var(--color-ink)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--color-ink-3)', fontWeight: 500 }}>{n}</span>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-ink)' }}>{title}</h3>
                </div>
                <p style={{ fontSize: '1rem', color: 'var(--color-ink-2)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEVELOPER SNIPPET SPLIT ── */}
      <section style={{ padding: '8rem 2rem', borderTop: '1px solid var(--color-line)', background: 'var(--color-paper-2)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '6rem', alignItems: 'center' }} className="md:grid-cols-2">
          
          <div>
            <MockupWindow title="c-thru-snippet.html">
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--color-ink)',
                lineHeight: 1.6,
                margin: 0,
                overflowX: 'auto',
              }}>
<span style={{ color: 'var(--color-ink-3)' }}>// 1. Drop the snippet into your app</span>
{`<script src="https://your-app/c.js" data-key="pk_live_..."></script>\n\n`}
<span style={{ color: 'var(--color-ink-3)' }}>// 2. Tell C-thru who logs in</span>
{`cthru.identify("user_123", { email: "priya@razorpay.com" })`}
              </pre>
            </MockupWindow>
          </div>

          <div>
             <h3 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '2.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--color-ink)',
              marginBottom: '1.5rem',
            }}>
              Install in 60 seconds
            </h3>
            <p style={{ fontSize: '1.125rem', color: 'var(--color-ink-2)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              One line to start tracking. Two more to unlock everything. Company grouping, scoring, and the brief work automatically from there.
            </p>
          </div>

        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '8rem 2rem', background: 'transparent', borderTop: '1px solid var(--color-line)' }}>
         <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '2.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              textAlign: 'center',
              marginBottom: '3rem',
            }}>
              FAQ
            </h2>
            
            <div style={{ borderTop: '1px solid var(--color-line)' }}>
               {[
                 'What is C-thru?',
                 'How does the transparent scoring work?',
                 'Can business users access data without knowing SQL?',
                 'How is C-thru different from traditional BI tools like Tableau?',
                 'How is C-thru different from just using an AI assistant for data?',
               ].map((q, i) => (
                 <div key={i} style={{ 
                   padding: '1.5rem 0', 
                   borderBottom: '1px solid var(--color-line)',
                   display: 'flex',
                   justifyContent: 'space-between',
                   alignItems: 'center',
                   cursor: 'pointer',
                 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.125rem', color: 'var(--color-ink)', fontWeight: 500 }}>{q}</span>
                    <span style={{ color: 'var(--color-ink-3)' }}>›</span>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section style={{ padding: '8rem 2rem', borderTop: '1px solid var(--color-line)', textAlign: 'center', background: 'transparent' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '3rem',
            fontWeight: 400,
            lineHeight: 1.1,
            marginBottom: '1rem',
            color: 'var(--color-ink)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '-0.02em' }}>Know who's about to pay.</span> <span style={{ fontStyle: 'italic', color: 'var(--color-ink-2)' }}>Today.</span>
        </h2>
        <p style={{ fontSize: '1.125rem', color: 'var(--color-ink-2)', marginBottom: '2.5rem' }}>
          Open-source, self-hosted, free to run. See it in minutes.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="hex-btn-wrapper">
             <Link
                href="/dashboard"
                style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  background: 'rgba(184,92,72,0.06)',
                  border: '1px solid rgba(184,92,72,0.2)',
                  padding: '0.75rem 2rem',
                  borderRadius: '4px',
                  textDecoration: 'none',
                }}
              >
                Get started
              </Link>
          </div>
        </div>
      </section>
      
      {/* ── FOOTER ── */}
      <footer style={{ padding: '4rem 2rem', background: 'var(--color-paper-2)', borderTop: '1px solid var(--color-line)' }}>
         <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '3rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
                C<span style={{ color: 'var(--color-accent)' }}>—</span>thru
              </span>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)', marginTop: '0.5rem' }}>The open-source PQL engine.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap', color: 'var(--color-ink)' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem' }}>Product</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--color-ink-2)', fontSize: '0.875rem' }}>
                  <li>Features</li>
                  <li>How it works</li>
                </ul>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem' }}>Resources</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--color-ink-2)', fontSize: '0.875rem' }}>
                  <li>Docs</li>
                  <li>GitHub</li>
                </ul>
              </div>
            </div>
         </div>
      </footer>

    </div>
  )
}
