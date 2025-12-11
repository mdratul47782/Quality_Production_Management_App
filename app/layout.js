// app/layout.js
import "./globals.css";
import { dbConnect } from "@/services/mongo";
import AuthProvider from "./providers/AuthProvider";
import { Bebas_Neue, Roboto, Poppins } from "next/font/google";
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

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"], // ✅ includes 700
  variable: "--font-poppins",
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
        className={`
          ${poppins.variable}
          ${roboto.variable}
          ${bebasNeue.variable}
          antialiased
        `}
      >
        <AuthProvider>
          <SideNavbar />
          <div className="min-h-screen pl-14">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
