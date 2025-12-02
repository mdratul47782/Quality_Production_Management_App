// app/layout.js
import "./globals.css";
import { dbConnect } from "@/services/mongo";
import AuthProvider from "./providers/AuthProvider";
import { Bebas_Neue, Roboto } from "next/font/google";

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas-neue",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"], // যেগুলো লাগবে সেগুলো রাখো
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
        className={`${roboto.variable} ${bebasNeue.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
