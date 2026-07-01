'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/ask',      label: 'Ask'       },
  { href: '/accounts', label: 'Accounts'  },
  { href: '/brief',    label: 'Brief'     },
  { href: '/funnels',  label: 'Funnels'   },
  { href: '/journey',  label: 'Journey'   },
  { href: '/outreach', label: 'Outreach'  },
  { href: '/settings', label: 'Settings'  },
]

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

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
      <div className="max-w-[72rem] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <Link
          href="/"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase' }}
          className="shrink-0 mr-8"
        >
          C<span style={{ color: 'var(--color-accent)' }}>—</span>thru
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 flex-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                fontWeight: isActive(href) ? 600 : 500,
                color: isActive(href) ? 'var(--color-ink)' : 'var(--color-ink-2)',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1 ml-auto"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <span style={{ display: 'block', width: '20px', height: '1.5px', background: 'var(--color-ink)', transition: 'transform 0.2s', transform: open ? 'rotate(45deg) translateY(4.5px)' : 'none' }} />
          <span style={{ display: 'block', width: '20px', height: '1.5px', background: 'var(--color-ink)', opacity: open ? 0 : 1, transition: 'opacity 0.2s' }} />
          <span style={{ display: 'block', width: '20px', height: '1.5px', background: 'var(--color-ink)', transition: 'transform 0.2s', transform: open ? 'rotate(-45deg) translateY(-4.5px)' : 'none' }} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav
          style={{ background: 'var(--color-paper)', borderTop: '1px solid var(--color-line)' }}
          className="md:hidden px-6 py-4 flex flex-col gap-4"
        >
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9375rem',
                fontWeight: isActive(href) ? 600 : 500,
                color: isActive(href) ? 'var(--color-ink)' : 'var(--color-ink-2)',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
