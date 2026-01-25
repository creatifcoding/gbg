import { Html } from '@next/html'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Html lang="en">
      <head />
      <body className="min-h-screen bg-black text-green-400 font-mono">
        {children}
      </body>
    </Html>
  )
}
