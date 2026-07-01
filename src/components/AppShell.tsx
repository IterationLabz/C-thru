import Nav from './Nav'

interface AppShellProps {
  children: React.ReactNode
  maxWidth?: string
}

export default function AppShell({ children, maxWidth = '72rem' }: AppShellProps) {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'transparent' }}>
      <Nav />
      <main
        style={{ maxWidth, margin: '0 auto', padding: '4rem 2.5rem 6rem' }}
        className="px-6 md:px-10"
      >
        {children}
      </main>
    </div>
  )
}
