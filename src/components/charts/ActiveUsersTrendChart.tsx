'use client'

import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { chartColors, gridStroke, tickStyle, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './chartTheme'

export interface ActiveUsersPoint {
  date: string   // YYYY-MM-DD
  count: number
}

function formatTick(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function ActiveUsersTrendChart({ data }: { data: ActiveUsersPoint[] }) {
  const router = useRouter()
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          labelFormatter={label => formatTick(String(label))}
          formatter={value => [Number(value).toLocaleString(), 'Active users']}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={chartColors.accent}
          strokeWidth={2}
          dot={false}
          activeDot={{ 
            r: 4, 
            fill: chartColors.accent,
            onClick: (_: any, payload: any) => {
              if (payload && payload.payload && payload.payload.date) {
                router.push(`/ask?q=${encodeURIComponent(`Show active users on ${payload.payload.date}`)}`)
              }
            },
            style: { cursor: 'pointer' }
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
