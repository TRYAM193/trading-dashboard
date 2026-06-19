import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BottomNavbar from "@/components/BottomNavbar";
import PageTransition from "@/components/PageTransition";
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
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <BottomNavbar />
        </div>
      </body>
    </html>
  );
}
