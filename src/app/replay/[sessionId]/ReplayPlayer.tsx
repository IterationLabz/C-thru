'use client'

import { useEffect, useRef } from 'react'
import rrwebPlayer from 'rrweb-player'
import 'rrweb-player/dist/style.css'
import type { eventWithTime } from '@rrweb/types'

interface ReplayPlayerProps {
  stream: number[]  // serialised Uint8Array — JSON-safe for server→client transfer
}

export function ReplayPlayer({ stream }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Decompress stream and parse rrweb events from the Uint8Array.
    // The stream is the raw decompressed bytes; parse as UTF-8 JSON.
    const bytes = new Uint8Array(stream)
    let events: eventWithTime[]
    try {
      const text = new TextDecoder().decode(bytes)
      events = JSON.parse(text) as eventWithTime[]
    } catch {
      return
    }

    if (!Array.isArray(events) || events.length === 0) return

    // rrweb-player provides play/pause, scrubber, speed controls (D-36).
    const player = new rrwebPlayer({
      target: containerRef.current,
      props: {
        events,
        width: containerRef.current.clientWidth || 800,
        height: 500,
        autoPlay: false,
        showController: true,   // play/pause + scrubber + speed (D-36: 2× speed built-in)
      },
    })

    return () => {
      // rrweb-player's types extend Svelte's SvelteComponent, whose declarations
      // aren't resolvable here (svelte isn't a direct dependency), so $destroy
      // is missing from the declared surface even though it exists at runtime.
      ;(player as unknown as { $destroy(): void }).$destroy()
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [stream])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-gray-200 bg-white"
      style={{ minHeight: 500 }}
    />
  )
}
