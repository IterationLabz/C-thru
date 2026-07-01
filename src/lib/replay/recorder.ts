// Block-by-default rrweb masking config (D-32).
// This module is the ONLY place that configures rrweb masking options.
// Callers receive a config object; no caller touches rrweb APIs directly.

// Permanent-block: elements matching this selector are element-blanked in the
// recording. They are NEVER recordable — data-cthru-record has no effect on them.
// D-32: permanent-block always wins over the allow-list.
export const PERMANENT_BLOCK_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete="cc-number"]',
  'input[autocomplete="cc-exp"]',
  'input[autocomplete="cc-exp-month"]',
  'input[autocomplete="cc-exp-year"]',
  'input[autocomplete="cc-csc"]',
  'input[autocomplete="cc-type"]',
  'input[autocomplete^="cc-"]',
].join(', ')

// buildMaskingConfig returns the rrweb RecordOptions for masking.
//
// Rules (D-32):
//  1. maskAllInputs: true  — all <input>/<textarea>/<select> values masked by default
//  2. blockSelector        — permanent-block fields are element-blanked (structure
//                            replaced with a blank placeholder; value never appears)
//  3. maskInputFn          — allow-list: data-cthru-record on a non-permanent-block
//                            field lets the value through; everything else stays '***'
//
// The priority chain is enforced by rrweb: blockSelector wins before maskInputFn runs.
// A password field with data-cthru-record is still element-blanked — permanent-block
// catches it before the allow-list can act.
export function buildMaskingConfig(emit: (event: unknown) => void) {
  return {
    emit,
    // Block-by-default: every input value is masked unless explicitly allowed.
    maskAllInputs: true,
    // maskInputFn runs for inputs NOT caught by blockSelector.
    // Return original text only for allow-listed, non-permanent-block fields.
    maskInputFn: (text: string, element: HTMLElement): string => {
      if (element.hasAttribute('data-cthru-record')) return text
      return '***'
    },
    // Permanent-block: element-blanked, regardless of any data-cthru-record attribute.
    blockSelector: PERMANENT_BLOCK_SELECTOR,
  } as const
}
