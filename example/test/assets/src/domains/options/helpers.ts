export type RgbColor = { r: number; g: number; b: number }

export const MID_VALUE_COLOR: RgbColor = { r: 255, g: 255, b: 255 }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const getGradientColor = (
  value: number,
  min: number,
  max: number,
  maxColor: RgbColor,
  minColor: RgbColor,
) => {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return 'transparent'
  }

  if (max === min) {
    if (value === 0) {
      return `rgb(${MID_VALUE_COLOR.r}, ${MID_VALUE_COLOR.g}, ${MID_VALUE_COLOR.b})`
    }
    const color = value > 0 ? maxColor : minColor
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  if (value === 0) {
    return `rgb(${MID_VALUE_COLOR.r}, ${MID_VALUE_COLOR.g}, ${MID_VALUE_COLOR.b})`
  }

  const negativeMin = Math.min(min, 0)
  const positiveMax = Math.max(max, 0)
  let startColor = MID_VALUE_COLOR
  let endColor = MID_VALUE_COLOR
  let localRatio = 0

  if (value < 0) {
    if (negativeMin === 0) {
      return `rgb(${MID_VALUE_COLOR.r}, ${MID_VALUE_COLOR.g}, ${MID_VALUE_COLOR.b})`
    }
    startColor = minColor
    endColor = MID_VALUE_COLOR
    localRatio = clamp((value - negativeMin) / (0 - negativeMin), 0, 1)
  } else {
    if (positiveMax === 0) {
      return `rgb(${MID_VALUE_COLOR.r}, ${MID_VALUE_COLOR.g}, ${MID_VALUE_COLOR.b})`
    }
    startColor = MID_VALUE_COLOR
    endColor = maxColor
    localRatio = clamp((value - 0) / (positiveMax - 0), 0, 1)
  }
  const r = Math.round(startColor.r + localRatio * (endColor.r - startColor.r))
  const g = Math.round(startColor.g + localRatio * (endColor.g - startColor.g))
  const b = Math.round(startColor.b + localRatio * (endColor.b - startColor.b))

  return `rgb(${r}, ${g}, ${b})`
}

export const getContrastingTextColor = (backgroundColor: string) => {
  if (!backgroundColor.startsWith('rgb')) {
    return '#111111'
  }

  const matches = backgroundColor.match(/\d+/g)
  if (!matches || matches.length < 3) {
    return '#111111'
  }

  const [r, g, b] = matches.slice(0, 3).map(Number)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#111111' : '#f8fafc'
}

export const formatCompactNumber = (input: number, maxLength = 4) => {
  if (!Number.isFinite(input)) {
    return '0'
  }

  const sign = input < 0 ? '-' : ''
  const value = Math.abs(input)
  if (value < 1000) {
    return `${sign}${Math.round(value)}`
  }

  const units = [
    { value: 1e3, suffix: 'K' },
    { value: 1e6, suffix: 'M' },
    { value: 1e9, suffix: 'B' },
    { value: 1e12, suffix: 'T' },
  ]

  const formatScaled = (scaled: number, suffix: string) => {
    const allowed = maxLength - sign.length - suffix.length
    if (allowed <= 0) {
      return null
    }

    for (let decimals = 2; decimals >= 0; decimals -= 1) {
      const fixed = scaled.toFixed(decimals)
      const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
      if (trimmed.length === 0 || Number(trimmed) === 0) {
        continue
      }

      if (trimmed.length <= allowed) {
        return `${sign}${trimmed}${suffix}`
      }
      if (trimmed.startsWith('0.') && trimmed.length === allowed + 1) {
        return `${sign}${trimmed}${suffix}`
      }
    }

    return null
  }

  let preferredIndex = -1
  units.forEach((unit, index) => {
    if (value >= unit.value) {
      preferredIndex = index
    }
  })

  for (let index = preferredIndex; index < units.length; index += 1) {
    const unit = units[index]
    const formatted = formatScaled(value / unit.value, unit.suffix)
    if (formatted) {
      return formatted
    }
  }

  return `${sign}${Math.round(value)}`
}
