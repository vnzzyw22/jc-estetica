"use client";

import { useEffect } from "react";
import { normalizeCampaign, normalizeSource } from "@/lib/screening";

export const ORIGIN_KEY = "jc-origem";

/**
 * Guarda de onde a pessoa veio (?origem=instagram no link da bio) enquanto ela navega.
 * Quem entra pela home e só depois clica em "Descobrir meu tratamento" não perde a origem.
 */
export function OriginCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("origem") ?? params.get("utm_source");
      if (!raw) return;
      const source = normalizeSource(raw);
      const campaign = normalizeCampaign(params.get("campanha") ?? params.get("utm_campaign"));
      sessionStorage.setItem(ORIGIN_KEY, JSON.stringify({ source, campaign }));
    } catch {
      /* storage indisponível (modo privado): a origem só não é lembrada */
    }
  }, []);
  return null;
}

export function readStoredOrigin(): { source?: string; campaign?: string } {
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { source?: string; campaign?: string | null };
    return { source: parsed.source, campaign: parsed.campaign ?? undefined };
  } catch {
    return {};
  }
}
