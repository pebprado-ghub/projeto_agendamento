export type BufferPair = { before: number; after: number };

type BusinessBufferFields = {
  booking_buffer_before_minutes?: number | null;
  booking_buffer_after_minutes?: number | null;
};

type ServiceBufferFields = {
  booking_buffer_before_minutes: number;
  booking_buffer_after_minutes: number;
};

export function buffersFromBusiness(business: BusinessBufferFields): BufferPair {
  return {
    before: Math.max(0, Number(business.booking_buffer_before_minutes || 0)),
    after: Math.max(0, Number(business.booking_buffer_after_minutes || 0))
  };
}

export function buffersFromServiceOrBusiness(
  service: ServiceBufferFields | null | undefined,
  business: BufferPair
): BufferPair {
  if (!service) return business;
  return {
    before: Math.max(0, Number(service.booking_buffer_before_minutes)),
    after: Math.max(0, Number(service.booking_buffer_after_minutes))
  };
}

export function expandRangeWithBuffers(
  startIso: string,
  endIso: string,
  buffers: BufferPair
): { start: string; end: string } {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return {
    start: new Date(start.getTime() - buffers.before * 60_000).toISOString(),
    end: new Date(end.getTime() + buffers.after * 60_000).toISOString()
  };
}
