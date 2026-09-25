"use client";

import { useState } from "react";
import { useMessages } from "@/components/i18n/locale-provider";

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  const messages = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-40 w-40 rounded-xl object-cover" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={messages.close}
            onClick={() => setOpen(false)}
          />
          <div className="relative max-h-[90vh] max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[90vh] w-full rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute end-2 top-2 rounded-md bg-white px-3 py-1 text-sm"
            >
              {messages.close}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
