import { Caveat, Inter, Inter_Tight } from 'next/font/google'

// Same type system as the approved public homepage (Inter body, Inter Tight
// display) so auth and onboarding match their reference designs.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const interTight = Inter_Tight({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-inter-tight', display: 'swap' })
const caveat = Caveat({ subsets: ['latin'], weight: '500', variable: '--font-caveat', display: 'swap', preload: false })

export const authFontClass = `${inter.variable} ${interTight.variable} ${caveat.variable} cf-home`
