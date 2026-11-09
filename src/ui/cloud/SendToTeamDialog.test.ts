import { flushSync, mount, tick, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { telegramContact } from "../../stores/film-requests";
import { filmRequest } from "../../stores/film-requests.fixture";
import SendToTeamDialog from "./SendToTeamDialog.svelte";

/** The dialog's text with line breaks and indentation collapsed to single spaces. */
const text = (element: Element) =>
  (element.textContent ?? "").replace(/\s+/g, " ");

describe("SendToTeamDialog", () => {
  let component: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    telegramContact.set("");
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    });
  });

  afterEach(async () => {
    if (component) await unmount(component);
    component = null;
    document.body.innerHTML = "";
  });

  function render(send = vi.fn(), onClose = vi.fn()) {
    const target = document.createElement("div");
    document.body.append(target);
    component = mount(SendToTeamDialog, {
      target,
      props: {
        open: true,
        email: "dara@example.com",
        summary: "A launch film for our cold brew",
        attachments: 2,
        send,
        onClose,
      },
    });
    flushSync();
    const dialog = target.querySelector<HTMLDialogElement>("dialog");
    if (!dialog) throw new Error("The dialog did not render.");
    const telegram = dialog.querySelector<HTMLInputElement>(
      'input[inputmode="tel"]',
    );
    if (!telegram) throw new Error("The Telegram field did not render.");
    const submit = async () => {
      dialog.querySelector("form")?.requestSubmit();
      await tick();
      await Promise.resolve();
      flushSync();
    };
    return { dialog, telegram, submit, send, onClose };
  }

  it("shows the account email, what is being sent and the files with it", () => {
    const { dialog } = render();
    expect(
      dialog.querySelector<HTMLInputElement>('input[type="email"]')?.value,
    ).toBe("dara@example.com");
    expect(text(dialog)).toContain("A launch film for our cold brew");
    expect(text(dialog)).toContain("2 files attached");
    expect(text(dialog)).toContain("Telegram (optional)");
  });

  it("sends without Telegram, and says the film will be emailed", async () => {
    const { dialog, submit, send, onClose } = render(
      vi.fn().mockResolvedValue(
        filmRequest({
          telegram: { contact: null, connected: false, connectUrl: null },
        }),
      ),
    );
    await submit();
    expect(send).toHaveBeenCalledWith(undefined);
    expect(text(dialog)).toContain("Got it! Your request is in.");
    expect(text(dialog)).toContain("You're #4 of 15 in line.");
    expect(text(dialog)).toContain(
      "We'll email your film to dara@example.com.",
    );

    dialog
      .querySelector<HTMLButtonElement>(".me-out-of-credits__upgrade")
      ?.click();
    flushSync();
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("sends a Telegram contact, remembers it, and links to the bot", async () => {
    const { dialog, telegram, submit, send } = render(
      vi.fn().mockResolvedValue(filmRequest()),
    );
    telegram.value = "+855 12 345 678";
    telegram.dispatchEvent(new Event("input"));
    await submit();
    expect(send).toHaveBeenCalledWith("+855 12 345 678");
    expect(get(telegramContact)).toBe("+855 12 345 678");
    expect(text(dialog)).toContain(
      "We'll send your film to +85512345678 on Telegram.",
    );
    expect(
      dialog.querySelector<HTMLAnchorElement>("a.me-out-of-credits__upgrade")
        ?.href,
    ).toBe("https://t.me/MotifyBot?start=abc");
  });

  it("refuses a Telegram that is neither a number nor a username", async () => {
    const { dialog, telegram, submit, send } = render();
    telegram.value = "call me";
    telegram.dispatchEvent(new Event("input"));
    await submit();
    expect(send).not.toHaveBeenCalled();
    expect(text(dialog)).toContain(
      "Enter the number or @username you use on Telegram.",
    );
  });

  it("keeps the form and says why when sending fails, and closing reports nothing sent", async () => {
    const { dialog, submit, onClose } = render(
      vi
        .fn()
        .mockRejectedValue(new Error("You have 3 films in the queue already.")),
    );
    await submit();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(
      "You have 3 films in the queue already.",
    );
    expect(dialog.querySelector("form")).not.toBeNull();

    dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.click();
    flushSync();
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
