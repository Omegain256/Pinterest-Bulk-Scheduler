import "./globals.css";

export const metadata = {
  title: 'Pinterest Bulk Scheduler',
  description: 'AI-powered Pinterest Pin Generator',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
