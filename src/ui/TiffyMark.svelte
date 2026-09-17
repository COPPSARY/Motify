<script lang="ts">
  // Tiffy's mark: a soft tile with two eyes and an ease-in-out smile, so the
  // assistant reads as a friendly motion character rather than a generic spark.
  export let size = 24;
  export let title = "";

  const gradientId = `tiffy-mark-${Math.random().toString(36).slice(2, 9)}`;
</script>

<svg
  class="tiffy-mark"
  width={size}
  height={size}
  viewBox="0 0 32 32"
  fill="none"
  role={title ? "img" : undefined}
  aria-hidden={title ? undefined : "true"}
  aria-label={title || undefined}
>
  <defs>
    <linearGradient
      id={gradientId}
      x1="3"
      y1="2"
      x2="29"
      y2="30"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" stop-color="#6cc0ff" />
      <stop offset="0.55" stop-color="#1f7bff" />
      <stop offset="1" stop-color="#5b3dff" />
    </linearGradient>
  </defs>
  <rect
    x="1"
    y="1"
    width="30"
    height="30"
    rx="10"
    fill={`url(#${gradientId})`}
  />
  <rect
    x="1.5"
    y="1.5"
    width="29"
    height="29"
    rx="9.5"
    stroke="#fff"
    stroke-opacity="0.18"
  />
  <rect x="10" y="9.5" width="3.4" height="6.5" rx="1.7" fill="#fff" />
  <rect x="18.6" y="9.5" width="3.4" height="6.5" rx="1.7" fill="#fff" />
  <path
    d="M8.5 20.5C12.5 20.5 12.5 24.5 16 24.5C19.5 24.5 19.5 20.5 23.5 20.5"
    stroke="#fff"
    stroke-width="2.2"
    stroke-linecap="round"
  />
  <path
    d="M25.2 4.6l.55 1.35 1.35.55-1.35.55-.55 1.35-.55-1.35-1.35-.55 1.35-.55z"
    fill="#fff"
    fill-opacity="0.9"
  />
</svg>

<style>
  .tiffy-mark {
    display: block;
    flex: none;
  }
</style>
