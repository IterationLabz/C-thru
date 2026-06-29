// @vitest-environment jsdom
/**
 * D-32 structural masking proof — the v0.5 equivalent of the D-26 grep test.
 *
 * This test proves the masking guarantee at the config level:
 *   - All input values are masked by default (block-by-default).
 *   - data-cthru-record allow-lists a field so its value IS recorded.
 *   - Permanent-block fields (password, cc) are NEVER recorded, even with
 *     data-cthru-record — permanent-block always wins over the allow-list.
 *
 * We test at the buildMaskingConfig / maskInputFn / blockSelector level because
 * that is where the safety guarantee is enforced. The config is the contract;
 * rrweb's runtime behaviour follows from it.
 */
import { describe, it, expect } from 'vitest'
import {
  buildMaskingConfig,
  PERMANENT_BLOCK_SELECTOR,
} from '../replay/recorder'

// ---------------------------------------------------------------------------
// Helpers: create minimal synthetic DOM elements for testing
// ---------------------------------------------------------------------------

function makeInput(attrs: Record<string, string> = {}): HTMLInputElement {
  const el = document.createElement('input')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function makeTextarea(attrs: Record<string, string> = {}): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function makeSelect(attrs: Record<string, string> = {}): HTMLSelectElement {
  const el = document.createElement('select')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

// ---------------------------------------------------------------------------
// 1. Config shape
// ---------------------------------------------------------------------------

describe('buildMaskingConfig — config shape', () => {
  it('sets maskAllInputs: true (block-by-default)', () => {
    const cfg = buildMaskingConfig(() => {})
    expect(cfg.maskAllInputs).toBe(true)
  })

  it('provides a maskInputFn', () => {
    const cfg = buildMaskingConfig(() => {})
    expect(typeof cfg.maskInputFn).toBe('function')
  })

  it('provides a blockSelector string', () => {
    const cfg = buildMaskingConfig(() => {})
    expect(typeof cfg.blockSelector).toBe('string')
    expect(cfg.blockSelector.length).toBeGreaterThan(0)
  })

  it('passes the emit function through', () => {
    const emit = () => {}
    const cfg = buildMaskingConfig(emit)
    expect(cfg.emit).toBe(emit)
  })
})

// ---------------------------------------------------------------------------
// 2. maskInputFn — block-by-default and allow-list
// ---------------------------------------------------------------------------

describe('maskInputFn — block-by-default (D-32)', () => {
  function mask(text: string, element: HTMLElement) {
    const cfg = buildMaskingConfig(() => {})
    return cfg.maskInputFn(text, element)
  }

  it('returns *** for a plain text input (block-by-default)', () => {
    expect(mask('John Doe', makeInput({ type: 'text' }))).toBe('***')
  })

  it('returns *** for an input with no type attribute', () => {
    expect(mask('some value', makeInput())).toBe('***')
  })

  it('returns *** for a textarea element', () => {
    expect(mask('some notes', makeTextarea())).toBe('***')
  })

  it('returns *** for a select element', () => {
    expect(mask('option-a', makeSelect())).toBe('***')
  })

  it('returns *** for an email input', () => {
    expect(mask('user@example.com', makeInput({ type: 'email' }))).toBe('***')
  })
})

describe('maskInputFn — allow-list via data-cthru-record (D-32)', () => {
  function mask(text: string, element: HTMLElement) {
    const cfg = buildMaskingConfig(() => {})
    return cfg.maskInputFn(text, element)
  }

  it('returns original value for a data-cthru-record text input', () => {
    const el = makeInput({ type: 'text', 'data-cthru-record': '' })
    expect(mask('search term', el)).toBe('search term')
  })

  it('returns original value for a data-cthru-record select', () => {
    const el = makeSelect({ 'data-cthru-record': '' })
    expect(mask('plan-pro', el)).toBe('plan-pro')
  })

  it('returns original value for a data-cthru-record textarea', () => {
    const el = makeTextarea({ 'data-cthru-record': '' })
    expect(mask('feedback text', el)).toBe('feedback text')
  })
})

// ---------------------------------------------------------------------------
// 3. PERMANENT_BLOCK_SELECTOR — permanent-block wins over allow-list (D-32)
//
// rrweb applies blockSelector BEFORE maskInputFn. Any element matching
// PERMANENT_BLOCK_SELECTOR is element-blanked and never reaches maskInputFn.
// These tests prove the selector correctly identifies permanent-block fields
// even when data-cthru-record is present — so permanent-block always wins.
// ---------------------------------------------------------------------------

describe('PERMANENT_BLOCK_SELECTOR — matches permanent-block fields (D-32)', () => {
  function isPermanentlyBlocked(el: HTMLElement): boolean {
    return el.matches(PERMANENT_BLOCK_SELECTOR)
  }

  it('blocks input[type=password]', () => {
    expect(isPermanentlyBlocked(makeInput({ type: 'password' }))).toBe(true)
  })

  it('blocks input[autocomplete=cc-number]', () => {
    expect(isPermanentlyBlocked(makeInput({ autocomplete: 'cc-number' }))).toBe(true)
  })

  it('blocks input[autocomplete=cc-exp]', () => {
    expect(isPermanentlyBlocked(makeInput({ autocomplete: 'cc-exp' }))).toBe(true)
  })

  it('blocks input[autocomplete=cc-csc]', () => {
    expect(isPermanentlyBlocked(makeInput({ autocomplete: 'cc-csc' }))).toBe(true)
  })

  it('blocks any input with autocomplete starting with cc-', () => {
    expect(isPermanentlyBlocked(makeInput({ autocomplete: 'cc-type' }))).toBe(true)
  })

  it('does NOT block a plain text input (not a permanent-block field)', () => {
    expect(isPermanentlyBlocked(makeInput({ type: 'text' }))).toBe(false)
  })

  it('does NOT block a textarea (uses maskInputFn path instead)', () => {
    expect(isPermanentlyBlocked(makeTextarea())).toBe(false)
  })
})

describe('PERMANENT_BLOCK_SELECTOR — permanent-block wins over data-cthru-record (D-32)', () => {
  function isPermanentlyBlocked(el: HTMLElement): boolean {
    return el.matches(PERMANENT_BLOCK_SELECTOR)
  }

  it('still blocks input[type=password] even when data-cthru-record is present', () => {
    // A founder adding data-cthru-record to a password field cannot unmask it.
    // blockSelector catches it first; maskInputFn never runs for this element.
    const el = makeInput({ type: 'password', 'data-cthru-record': '' })
    expect(isPermanentlyBlocked(el)).toBe(true)
  })

  it('still blocks cc-number even when data-cthru-record is present', () => {
    const el = makeInput({ autocomplete: 'cc-number', 'data-cthru-record': '' })
    expect(isPermanentlyBlocked(el)).toBe(true)
  })

  it('still blocks cc-exp even when data-cthru-record is present', () => {
    const el = makeInput({ autocomplete: 'cc-exp', 'data-cthru-record': '' })
    expect(isPermanentlyBlocked(el)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Fail-safe: misconfiguration leaves the field masked, never leaked (D-32)
// ---------------------------------------------------------------------------

describe('maskInputFn — fail-safe: misconfiguration masks, never leaks (D-32)', () => {
  function mask(text: string, element: HTMLElement) {
    const cfg = buildMaskingConfig(() => {})
    return cfg.maskInputFn(text, element)
  }

  it('masks a field with a misspelled allow-list attribute', () => {
    const el = makeInput({ type: 'text', 'data-cthru-recrd': '' }) // typo
    expect(mask('sensitive', el)).toBe('***')
  })

  it('masks a field with empty type attribute', () => {
    const el = makeInput({ type: '' })
    expect(mask('sensitive', el)).toBe('***')
  })

  it('masks a field with an unknown attribute (not the allow-list one)', () => {
    const el = makeInput({ type: 'text', 'data-record': '' }) // not data-cthru-record
    expect(mask('sensitive', el)).toBe('***')
  })
})
