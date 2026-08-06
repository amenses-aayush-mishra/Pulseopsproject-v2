import './globals.css';

export const metadata = {
  title: 'PulseOps',
  description: 'PulseOps MVP',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
