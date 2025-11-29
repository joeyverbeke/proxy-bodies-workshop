import Link from "next/link";
import { useRouter } from "next/router";

const links = [
  { href: "/", label: "Create Your Proxy / 프록시 만들기" },
  { href: "/chat", label: "Talk to Your Proxy / 프록시와 대화" },
  { href: "/proxy-dialogue", label: "Talk Through Your Proxy / 프록시를 통해 대화" },
  { href: "/proxy-autonomous", label: "Your Proxy Talks for You / 프록시가 대신 대화" },
];

export default function NavBar() {
  const router = useRouter();

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <div className="brand">
          Proxy Bodies
          <br />
          <Link href="https://k0j0.com/" className="brand-light">
            [k0j0]
          </Link>
        </div>
        <div className="nav-links">
          {links.map((link) => {
            const active = router.pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={active ? "nav-link active" : "nav-link"}>
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
