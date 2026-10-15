DROP POLICY IF EXISTS "anyone reads bids" ON public.bids;
CREATE POLICY "bidders read own bids" ON public.bids FOR SELECT TO authenticated USING (auth.uid() = bidder_id);
CREATE POLICY "owners read bids on own listings" ON public.bids FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()));
CREATE POLICY "admins read all bids" ON public.bids FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.bids FROM anon;

DROP POLICY IF EXISTS "anyone can view listing photos" ON storage.objects;
CREATE POLICY "public views approved listing photos" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'listing-photos' AND EXISTS (
    SELECT 1 FROM public.listings l WHERE l.status = 'approved' AND storage.objects.name = ANY(l.photos)));
CREATE POLICY "owners view own photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "admins view all photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'listing-photos' AND public.has_role(auth.uid(), 'admin'));