<script lang="ts">
    import { link } from "svelte-spa-router";
</script>

<div
    class="font-google relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-paper px-6 py-12"
>
    <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-acc-green/10 blur-3xl"
    ></div>

    <div class="relative flex w-full max-w-sm flex-col items-center gap-10">
        <!-- Branding -->
        <div class="text-center">
            <h1 class="text-5xl font-semibold tracking-[-0.065em] text-primary">
                <span>@the</span><span class="text-acc-green">Nukkad</span>
            </h1>

            <p class="mt-3 text-sm tracking-wide text-muted">
                Advance orders for indie food outlets on campus.
            </p>
        </div>

        <!-- Entry -->
        <div class="flex w-full flex-col items-center gap-5">
            <a
                href="/studentlogin"
                use:link
                class="flex w-full items-center justify-center rounded-lg bg-acc-green px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc-green"
            >
                Log in
            </a>

            <p class="text-sm text-muted">
                New?
                <a
                    href="/studentsignup"
                    use:link
                    class="ml-1 font-medium text-acc-green underline decoration-acc-green/40 underline-offset-4 transition hover:decoration-acc-green"
                >
                    Create an account
                </a>
            </p>
        </div>
    </div>
</div>
