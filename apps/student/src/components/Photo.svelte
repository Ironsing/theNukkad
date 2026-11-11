<script lang="ts">
    // A picture that may not be there: the URL always names a spot, and whether
    // anything answers at it is what the request finds out for itself. A missing
    // picture is not a fault, so there is no message to show and nothing to
    // retry - it gets the outlet's first letter, or an empty box for a dish. The
    // class sizes the box, so a picture arriving late does not move the page.
    let {
        src,
        alt,
        fallback = 'letter',
        class: className = '',
    }: {
        src: string;
        alt: string;
        // `letter` wears the alt's first letter; `blank` holds the space.
        fallback?: 'letter' | 'blank';
        class?: string;
    } = $props();

    // A flaky network looks the same from here as no picture at all.
    let failed = $state(false);

    const initial = $derived(alt.trim().slice(0, 1).toUpperCase());
</script>

{#if failed}
    <span class={className} aria-hidden="true"
        >{fallback === 'letter' ? initial : ''}</span
    >
{:else}
    <img
        {src}
        {alt}
        loading="lazy"
        decoding="async"
        class={className}
        onerror={() => (failed = true)}
    />
{/if}
