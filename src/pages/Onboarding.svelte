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

        <!-- Role -->
        <div class="flex w-full flex-col gap-5">
            <p
                class="text-center text-xl font-semibold tracking-[-0.03em] text-primary"
            >
                I am a...
            </p>

            <div class="flex flex-col gap-3">
                <a
                    href="/studentlogin"
                    use:link
                    class="flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-4 text-base font-bold text-primary shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] outline-none transition duration-200 hover:brightness-[0.98] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc-green"
                >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-5 w-5 shrink-0 text-acc-green"
                    >
                        <path
                            d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
                        />
                        <path d="M22 10v6" />
                        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
                    </svg>
                    Student
                </a>

                <a
                    href="/restologin"
                    use:link
                    class="flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-4 text-base font-bold text-primary shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] outline-none transition duration-200 hover:brightness-[0.98] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc-orange"
                >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-5 w-5 shrink-0 text-acc-orange"
                    >
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                        <path d="M7 2v20" />
                        <path
                            d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"
                        />
                    </svg>
                    Restaurant
                </a>
            </div>
        </div>
    </div>
</div>
