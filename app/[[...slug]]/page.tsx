import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allRoutes, exists, readPage, routeKey } from "@/lib/pages";
import Runtime from "@/components/Runtime";

export const dynamicParams = false;

export function generateStaticParams() {
  return allRoutes().map((r) => ({ slug: r === "index" ? [] : r.split("/") }));
}

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = routeKey((await params).slug);
  if (!exists(key)) return {};
  const { meta } = readPage(key);
  const tag = (k: string) => meta.tags.find((t) => t.name === k || t.property === k)?.content;
  return {
    title: meta.title,
    description: tag("description"),
    alternates: { canonical: meta.canonical },
    // Never indexed until the site is switched live on Whitefox's own domain (set SITE_LIVE=1 in Vercel then).
    robots: process.env.SITE_LIVE === "1" ? tag("robots") : { index: false, follow: false },
    openGraph: { type: "website", url: meta.canonical, title: tag("og:title"), description: tag("og:description"), images: tag("og:image") ? [tag("og:image")!] : [] },
    twitter: { card: "summary_large_image", title: tag("twitter:title"), description: tag("twitter:description"), images: tag("twitter:image") ? [tag("twitter:image")!] : [] },
    icons: {
      icon: meta.icons.filter((i) => i.rel === "icon").map((i) => ({ url: i.href, media: i.media ?? undefined })),
      apple: meta.icons.filter((i) => i.rel === "apple-touch-icon").map((i) => i.href),
    },
  };
}

export default async function Page({ params }: Props) {
  const key = routeKey((await params).slug);
  if (!exists(key)) notFound();
  const { meta, css, html } = readPage(key);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="main" dangerouslySetInnerHTML={{ __html: html }} />
      <Runtime appear={meta.appear} breakpoints={meta.breakpoints} />
    </>
  );
}
