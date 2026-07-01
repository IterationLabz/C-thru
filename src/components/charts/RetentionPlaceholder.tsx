interface RetentionPlaceholderProps {
  title: string
  description: string
}

// No retention engine exists yet (no cohort/return-visit data is computed anywhere
// in the codebase). Rendering fake grid/curve data here would violate the
// "never show fake data as real" rule, so this is an honest, explicit placeholder
// until the retention engine is built (tracked as a later phase).
export default function RetentionPlaceholder({ title, description }: RetentionPlaceholderProps) {
  return (
    <div
      style={{
        border: '1px dashed var(--color-line)',
        borderRadius: '10px',
        padding: '1.5rem',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-3)',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}
