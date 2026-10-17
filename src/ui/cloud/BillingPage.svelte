<script lang="ts">
  import { ExternalLink } from "lucide-svelte";
  import { PRICING_URL } from "../../api/config";
  import { formatReceiptDate } from "../../api/billing";
  import type { WorkspaceSubscription } from "../../cloud/projects-api";
  import BillingHistory from "./BillingHistory.svelte";
  import CreditsBadge from "./CreditsBadge.svelte";

  /** The account's plan; null while it loads or when it could not be read. */
  export let subscription: WorkspaceSubscription | null;
  export let onOpenReceipt: (paymentId: string) => void;

  $: active = subscription?.status === "active" && Boolean(subscription.plan);
  $: expired = subscription?.status === "expired" && Boolean(subscription.plan);
  $: planName = active || expired ? (subscription?.plan ?? "Free") : "Free";
  $: interval =
    active && subscription?.interval
      ? subscription.interval === "YEAR"
        ? "Yearly"
        : "Monthly"
      : null;
  $: periodEnd = subscription?.currentPeriodEnd
    ? formatReceiptDate(subscription.currentPeriodEnd)
    : null;
</script>

<section class="me-billing-plan" aria-labelledby="billing-plan-title">
  <div class="me-billing-plan__main">
    <h2 id="billing-plan-title" class="me-billing-plan__label">Current plan</h2>
    <p class="me-billing-plan__name">
      <span class="me-sidebar-plan">{planName}</span>
      {#if interval}<span class="me-billing-plan__chip">{interval}</span>{/if}
      {#if expired}<span
          class="me-billing-plan__chip me-billing-plan__chip--muted"
          >Expired</span
        >{/if}
    </p>
    <p class="me-billing-plan__status">
      {#if active && periodEnd}
        Active until {periodEnd}. Plans are one-time Bakong KHQR payments and
        don’t renew automatically.
      {:else if expired && periodEnd}
        Ended on {periodEnd}. Renew it or choose another plan.
      {:else}
        You’re on the free plan. Upgrade for more credits and exports without a
        watermark.
      {/if}
    </p>
  </div>
  <div class="me-billing-plan__side">
    <div class="me-billing-plan__credits">
      <span>Credits</span>
      <CreditsBadge />
    </div>
    <a
      class="me-billing-plan__cta"
      href={PRICING_URL}
      target="_blank"
      rel="noopener"
      >{active ? "Change plan" : expired ? "Renew plan" : "Upgrade"}
      <ExternalLink size={14} /></a
    >
  </div>
</section>

<section class="me-billing-invoices" aria-labelledby="billing-invoices-title">
  <h2 id="billing-invoices-title" class="me-billing-invoices__title">
    Invoices
  </h2>
  <BillingHistory {onOpenReceipt} />
</section>
