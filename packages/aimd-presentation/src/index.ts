export type AimdPresentationDensity = 'comfortable' | 'compact'
export type AimdPresentationIdVisibility = 'auto' | 'show' | 'hide'
export type AimdPresentationLabelStrategy = 'auto' | 'prefer_label' | 'prefer_id'
export type AimdPresentationAssignerVisibility = 'hidden' | 'collapsed' | 'expanded'
export type AimdPresentationStepDetails = 'auto' | 'always' | 'hidden'
export type AimdPresentationOutline = 'full' | 'compact' | 'hidden'

export interface AimdPresentationProfile {
  density: AimdPresentationDensity
  ids: AimdPresentationIdVisibility
  labels: AimdPresentationLabelStrategy
  assigners: AimdPresentationAssignerVisibility
  stepDetails: AimdPresentationStepDetails
  outline: AimdPresentationOutline
}

export type AimdPresentationProfileInput = Partial<AimdPresentationProfile>

export interface AimdPresentationLabelTarget {
  id: string
  label?: string | null | undefined
}

export const defaultAimdPresentationProfile: AimdPresentationProfile = {
  density: 'comfortable',
  ids: 'auto',
  labels: 'auto',
  assigners: 'hidden',
  stepDetails: 'auto',
  outline: 'full',
}

export function resolveAimdPresentationProfile(
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): AimdPresentationProfile {
  return {
    ...defaultAimdPresentationProfile,
    ...(defaults || {}),
    ...(profile || {}),
  }
}

export function isCompactPresentation(
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): boolean {
  return resolveAimdPresentationProfile(profile, defaults).density === 'compact'
}

export function resolvePresentationAssignerVisibility(
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): AimdPresentationAssignerVisibility {
  return resolveAimdPresentationProfile(profile, defaults).assigners
}

export function resolvePresentationStepDetails(
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): AimdPresentationStepDetails {
  return resolveAimdPresentationProfile(profile, defaults).stepDetails
}

export function shouldShowOutlineScope(
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): boolean {
  return resolveAimdPresentationProfile(profile, defaults).outline === 'full'
}

export function shouldShowOutlineBadge(
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): boolean {
  return resolveAimdPresentationProfile(profile, defaults).outline !== 'hidden'
}

export function resolvePresentationPrimaryLabel(
  target: AimdPresentationLabelTarget,
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): string {
  const resolved = resolveAimdPresentationProfile(profile, defaults)
  const trimmedLabel = String(target.label || '').trim()

  if (resolved.labels === 'prefer_id') {
    return target.id
  }

  if (resolved.labels === 'prefer_label') {
    return trimmedLabel || target.id
  }

  return trimmedLabel || target.id
}

export function resolvePresentationSecondaryId(
  target: AimdPresentationLabelTarget,
  primaryLabel: string,
  profile?: AimdPresentationProfileInput,
  defaults?: Partial<AimdPresentationProfile>,
): string | null {
  const resolved = resolveAimdPresentationProfile(profile, defaults)
  if (resolved.ids !== 'show') {
    return null
  }

  return primaryLabel !== target.id ? target.id : null
}
