import "../styles/globals.css";
import NavBar from "../components/NavBar";
import Head from "next/head";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Proxy Bodies: Crafting Mediated Selves</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
      </Head>
      <NavBar />
      <Component {...pageProps} />
    </>
  );
}
