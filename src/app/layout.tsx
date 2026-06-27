import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'C-thru',
  description: 'Open-source PQL engine for product-led startups',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
