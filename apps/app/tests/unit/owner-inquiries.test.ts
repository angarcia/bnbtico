import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { OwnerInquiry } from "../../src/domain/inquiry";
import { PRIVATE_KEYS } from "../../src/client/account";
import { countNew, inquiriesQuery, markInquirySeen, openInquiry } from "../../src/client/inquiries";

const inquiry = (id: string, openedAt: string | null = null): OwnerInquiry => ({
  id,
  listingId: "l",
  publicId: "CT-1001",
  listingTitle: "Casa Cocles",
  clientName: "Ana Prueba",
  clientPhone: "+506 8888 1234",
  arrival: null,
  departure: null,
  people: null,
  message: "Hola",
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: "2026-10-23T12:00:00Z",
  openedAt,
  source: "listing",
});

describe("Mis consultas en el navegador", () => {
  it("la clave es privada (se persiste con sesión y se borra al cerrarla) y se refresca a los 30 s", () => {
    const q = inquiriesQuery("u1");
    expect(q.queryKey).toEqual(["inquiries", "u1"]);
    expect(q.staleTime).toBe(30_000);
    expect(PRIVATE_KEYS.has("inquiries")).toBe(true);
  });

  it("countNew cuenta las que el propietario no ha abierto", () => {
    expect(countNew(undefined)).toBe(0);
    expect(countNew([inquiry("a"), inquiry("b", "2026-10-23T13:00:00Z"), inquiry("c")])).toBe(2);
  });

  it("al verla solo marca esa consulta, y un toque posterior no vuelve a escribir", async () => {
    const client = new QueryClient();
    const key = inquiriesQuery("u1").queryKey;
    const a = inquiry("a");
    client.setQueryData(key, [a, inquiry("b")]);
    const mark = vi.fn(async () => {});
    const assign = vi.fn();
    await markInquirySeen(client, "u1", a, { mark, now: () => "t" });
    expect(client.getQueryData<OwnerInquiry[]>(key)?.map((i) => i.openedAt)).toEqual(["t", null]);
    await openInquiry(client, "u1", a, { mark, assign });
    expect(mark).toHaveBeenCalledExactlyOnceWith("a");
    expect(assign).toHaveBeenCalledWith("https://wa.me/50688881234");
  });

  it("«Abrir WhatsApp»: deja de ser nueva en la caché al momento, pide marcarla y abre wa.me con el cliente, sin texto", async () => {
    const client = new QueryClient();
    const key = inquiriesQuery("u1").queryKey;
    client.setQueryData(key, [inquiry("a"), inquiry("b")]);
    const calls: string[] = [];
    const mark = vi.fn(async (id: string) => void calls.push(`mark:${id}`));
    const assign = vi.fn((url: string) => void calls.push(`open:${url}`));

    const done = openInquiry(client, "u1", inquiry("a"), {
      mark,
      assign,
      now: () => "2026-10-23T14:00:00.000Z",
    });
    // Optimista: antes de que responda la base.
    expect(client.getQueryData<OwnerInquiry[]>(key)?.map((i) => i.openedAt)).toEqual(["2026-10-23T14:00:00.000Z", null]);
    await done;
    expect(calls).toEqual(["mark:a", "open:https://wa.me/50688881234"]);
  });

  it("si la base falla o tarda, WhatsApp se abre igual y no se deshace (se reintenta la próxima vez)", async () => {
    const client = new QueryClient();
    const key = inquiriesQuery("u1").queryKey;
    client.setQueryData(key, [inquiry("a")]);
    const assign = vi.fn();
    await openInquiry(client, "u1", inquiry("a"), {
      mark: async () => Promise.reject(new Error("red")),
      assign,
      now: () => "t",
    });
    expect(assign).toHaveBeenCalledWith("https://wa.me/50688881234");
    expect(client.getQueryData<OwnerInquiry[]>(key)?.[0]?.openedAt).toBe("t");

    client.setQueryData(key, [inquiry("a")]); // una lectura posterior aún la trae como nueva
    const slow = vi.fn();
    await openInquiry(client, "u1", inquiry("a"), {
      mark: () => new Promise(() => {}),
      assign: slow,
      now: () => "t",
      wait: 10,
    });
    expect(slow).toHaveBeenCalledOnce();
  });

  it("una ya abierta no vuelve a marcarse, solo abre el chat", async () => {
    const client = new QueryClient();
    const mark = vi.fn(async () => {});
    const assign = vi.fn();
    await openInquiry(client, "u1", inquiry("a", "2026-10-23T13:00:00Z"), {
      mark,
      assign,
    });
    expect(mark).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("https://wa.me/50688881234");
  });
});
