import { ImageResponse } from 'next/og'

// iOS uses the apple-touch-icon for the home-screen app icon. It applies its
// own rounded-corner mask, so this is drawn full-bleed with no rounding of its
// own. Generated at build time as a PNG (iOS ignores SVG touch icons).
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
          color: '#ffffff',
          fontSize: 120,
          fontWeight: 700,
          // Nudge the glyph optically centred.
          paddingBottom: 8,
        }}
      >
        £
      </div>
    ),
    { ...size },
  )
}
