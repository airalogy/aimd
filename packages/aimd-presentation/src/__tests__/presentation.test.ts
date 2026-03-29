import { describe, expect, it } from 'vitest'

import {
  defaultAimdPresentationProfile,
  isCompactPresentation,
  resolveAimdPresentationProfile,
  resolvePresentationPrimaryLabel,
  resolvePresentationSecondaryId,
  shouldShowOutlineBadge,
  shouldShowOutlineScope,
} from '../index'

describe('@airalogy/aimd-presentation', () => {
  it('resolves partial profile overrides against defaults', () => {
    const profile = resolveAimdPresentationProfile({
      density: 'compact',
      assigners: 'collapsed',
    })

    expect(profile.density).toBe('compact')
    expect(profile.assigners).toBe('collapsed')
    expect(profile.outline).toBe(defaultAimdPresentationProfile.outline)
  })

  it('derives outline helpers from the resolved profile', () => {
    expect(shouldShowOutlineScope({ outline: 'full' })).toBe(true)
    expect(shouldShowOutlineScope({ outline: 'compact' })).toBe(false)
    expect(shouldShowOutlineBadge({ outline: 'hidden' })).toBe(false)
  })

  it('resolves primary labels and optional secondary ids', () => {
    const primary = resolvePresentationPrimaryLabel(
      { id: 'verify_output', label: 'Verify Output' },
      { labels: 'prefer_label' },
    )

    expect(primary).toBe('Verify Output')
    expect(resolvePresentationSecondaryId(
      { id: 'verify_output', label: 'Verify Output' },
      primary,
      { ids: 'show' },
    )).toBe('verify_output')
  })

  it('detects compact density', () => {
    expect(isCompactPresentation({ density: 'compact' })).toBe(true)
    expect(isCompactPresentation()).toBe(false)
  })
})
