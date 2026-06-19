import "./globals.css";
import Sidebar from "@/components/Sidebar";
import FetchInterceptor from "@/components/FetchInterceptor";

export const metadata = {
  title: "AI Trading Copilot",
  description: "Real-time trading dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <FetchInterceptor />
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
