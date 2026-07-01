import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'C-thru', template: '%s · C-thru' },
  description: 'Open-source, self-hosted PQL engine for product-led startups.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
