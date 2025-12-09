// app/layout.js
import "./globals.css";
import { dbConnect } from "@/services/mongo";
import AuthProvider from "./providers/AuthProvider";
import { Bebas_Neue, Roboto } from "next/font/google";
import SideNavbar from "./SideNavBarComponent/SideNavbar";

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas-neue",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata = {
  title: "HKD PRODUCTION APP",
  description: "CREATED BY MD.RATUL",
};

export default async function RootLayout({ children }) {
  await dbConnect();

  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${bebasNeue.variable} antialiased `}
      >
        <AuthProvider>
          {/* Fixed left icon bar */}
          <SideNavbar />
          {/* Content shifted so it's not under the bar */}
          <div className="min-h-screen pl-14">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
