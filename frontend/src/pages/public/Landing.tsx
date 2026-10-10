import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollTrigger } from '@/lib/gsap';
import { api } from '@/lib/api';
import { Hero } from '@/components/marketing/Hero';
import { CategoryIndex, ClosingCta, Manifesto, ParallaxGallery, Programme } from '@/components/marketing/Sections';
import { OrganizerSection } from '@/components/marketing/OrganizerSection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function Landing() {
  useDocumentTitle('Make room for the unexpected');
  const meta = useQuery({ queryKey: ['events', 'meta'], queryFn: api.events.meta });
  const featured = useQuery({ queryKey: ['events', 'featured'], queryFn: () => api.events.search({ featured: true, size: 6, sort: 'date' }) });
  const soon = useQuery({ queryKey: ['events', 'soon'], queryFn: () => api.events.search({ sort: 'date', size: 10 }) });
  const popular = useQuery({ queryKey: ['events', 'popular', 12], queryFn: () => api.events.search({ sort: 'popular', size: 12 }) });

  const lead = featured.data?.content[0];
  const sample = useQuery({
    queryKey: ['events', 'detail', lead?.slug],
    queryFn: () => api.events.detail(lead!.slug),
    enabled: !!lead,
  });

  const galleryEvents = [...(featured.data?.content ?? []), ...(popular.data?.content ?? [])].filter(
    (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i,
  );

  // Sections mount as their data arrives; recompute trigger positions once the layout settles.
  const ready = [meta.data, featured.data, soon.data, popular.data, sample.data].filter(Boolean).length;
  useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(id);
  }, [ready]);

  return (
    <>
      <Hero meta={meta.data} next={soon.data?.content[0]} />
      <Manifesto />
      <ParallaxGallery events={galleryEvents} />
      {meta.data ? <CategoryIndex categories={meta.data.categories} events={popular.data?.content ?? []} /> : null}
      <Programme featured={lead} soon={soon.data?.content ?? []} />
      <OrganizerSection sample={sample.data} />
      <ClosingCta cities={meta.data?.cities ?? []} />
    </>
  );
}
